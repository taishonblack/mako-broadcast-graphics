import { useEffect, useMemo, useState } from 'react';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

interface AnalyticsRow {
  id: string;
  project_id: string;
  poll_id: string;
  answer_id: string | null;
  device_type: string;
  browser: string;
  os: string;
  country: string;
  region: string;
  created_at: string;
}

interface PollLite {
  id: string;
  question: string;
  internal_name: string;
  answers: Array<{ id: string; label: string }>;
  project_id: string | null;
  block_letter?: string | null;
  block_label?: string | null;
}

interface ProjectLite {
  id: string;
  name: string;
}

interface LiveStateLite {
  active_poll_id: string | null;
  voting_state: string;
  project_id: string;
}

// Realtime keeps vote_analytics fresh; this slow interval is just a safety
// net for live_state changes and tab-restore scenarios where the channel may
// have missed a tick. Realtime-driven inserts dominate normal operation.
const REFRESH_MS = 15000;

function downloadCSV(filename: string, rows: AnalyticsRow[], pollLookup: Record<string, PollLite>) {
  const header = ['timestamp', 'project_id', 'poll_id', 'poll_name', 'block', 'answer_id', 'answer_label', 'device_type', 'browser', 'os', 'country', 'region'];
  const escape = (v: string) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  rows.forEach((r) => {
    const poll = pollLookup[r.poll_id];
    const answerLabel = poll?.answers.find((a) => a.id === r.answer_id)?.label ?? '';
    const block = [poll?.block_letter, poll?.block_label].filter(Boolean).join(' · ');
    lines.push(
      [
        r.created_at,
        poll?.project_id ?? '',
        r.poll_id,
        poll?.internal_name || poll?.question || '',
        block,
        r.answer_id ?? '',
        answerLabel,
        r.device_type,
        r.browser,
        r.os,
        r.country,
        r.region,
      ]
        .map(escape)
        .join(','),
    );
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Statistics() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [polls, setPolls] = useState<Record<string, PollLite>>({});
  const [projects, setProjects] = useState<Record<string, ProjectLite>>({});
  const [live, setLive] = useState<LiveStateLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ data: aRows }, { data: pollRows }, { data: liveRows }, { data: projectRows }] = await Promise.all([
        supabase
          .from('vote_analytics' as never)
          .select('*')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('polls')
          .select('id, question, internal_name, answers, project_id, block_letter, block_label')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(200),
        supabase
          .from('project_live_state')
          .select('active_poll_id, voting_state, project_id')
          .order('updated_at', { ascending: false })
          .limit(1),
        supabase
          .from('projects')
          .select('id, name')
          .eq('user_id', user.id)
          .limit(500),
      ]);
      if (cancelled) return;
      setRows((aRows ?? []) as unknown as AnalyticsRow[]);
      const pmap: Record<string, PollLite> = {};
      (pollRows ?? []).forEach((p: any) => {
        pmap[p.id] = {
          id: p.id,
          question: p.question,
          internal_name: p.internal_name,
          answers: [],
          project_id: p.project_id ?? null,
          block_letter: p.block_letter ?? null,
          block_label: p.block_label ?? null,
        };
      });
      // Pull real poll_answers (UUID-keyed) so analytics' answer_id can be
      // resolved to a human-readable label. polls.answers JSONB uses local
      // ids ("1","2") which don't match vote_analytics.answer_id.
      const pollIds = Object.keys(pmap);
      if (pollIds.length) {
        const { data: ansRows } = await supabase
          .from('poll_answers')
          .select('id, poll_id, label, sort_order')
          .in('poll_id', pollIds)
          .order('sort_order', { ascending: true });
        (ansRows ?? []).forEach((a: any) => {
          const target = pmap[a.poll_id];
          if (target) target.answers.push({ id: a.id, label: a.label });
        });
      }
      setPolls(pmap);
      const projmap: Record<string, ProjectLite> = {};
      (projectRows ?? []).forEach((p: any) => { projmap[p.id] = { id: p.id, name: p.name }; });
      setProjects(projmap);
      setLive((liveRows?.[0] as LiveStateLite) ?? null);
      setLoading(false);
    };

    void load();
    const id = window.setInterval(load, REFRESH_MS);

    // Realtime: append new vote_analytics rows as they arrive so the live
    // metrics, audience breakdown, and timeline update without waiting for
    // the polling cycle. We still refresh polls/live_state via the interval
    // since those change rarely and aren't part of this hot path.
    const channel = supabase
      .channel('stats-vote-analytics')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vote_analytics' },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as AnalyticsRow | null;
          if (!row?.id) return;
          setRows((prev) => {
            // De-dup in case the same row arrives via both interval and realtime.
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev].slice(0, 5000);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(id);
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const activePollId = live?.active_poll_id ?? null;
  const isLive = live?.voting_state === 'open';
  const activePoll = activePollId ? polls[activePollId] : null;

  const liveRows = useMemo(
    () => (activePollId ? rows.filter((r) => r.poll_id === activePollId) : []),
    [rows, activePollId],
  );

  const totalVotes = liveRows.length;

  const votesPerMinute = useMemo(() => {
    const cutoff = Date.now() - 60_000;
    return liveRows.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
  }, [liveRows]);

  const answerBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    liveRows.forEach((r) => {
      if (!r.answer_id) return;
      counts.set(r.answer_id, (counts.get(r.answer_id) ?? 0) + 1);
    });
    const items = (activePoll?.answers ?? []).map((a) => ({
      id: a.id,
      label: a.label || 'Untitled',
      votes: counts.get(a.id) ?? 0,
    }));
    const max = Math.max(1, ...items.map((i) => i.votes));
    const total = items.reduce((s, i) => s + i.votes, 0) || 1;
    return items
      .map((i) => ({ ...i, pct: (i.votes / total) * 100, rel: (i.votes / max) * 100 }))
      .sort((a, b) => b.votes - a.votes);
  }, [liveRows, activePoll]);

  const leading = answerBreakdown[0]?.votes ? answerBreakdown[0] : null;

  // Audience breakdown across the entire 24h window (not just active poll)
  const audience = useMemo(() => {
    const tally = (key: keyof AnalyticsRow) => {
      const map = new Map<string, number>();
      rows.forEach((r) => {
        const k = String(r[key] ?? 'Unknown') || 'Unknown';
        map.set(k, (map.get(k) ?? 0) + 1);
      });
      const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
      return entries.map(([label, count]) => ({ label, count, pct: (count / total) * 100 }));
    };
    return {
      device: tally('device_type'),
      browser: tally('browser'),
      os: tally('os'),
      country: tally('country').slice(0, 5),
      region: tally('region').slice(0, 5),
      total: rows.length,
    };
  }, [rows]);

  // Timeline: bucket active poll votes into 1-minute slots over last 30 minutes
  const timeline = useMemo(() => {
    const now = Date.now();
    const buckets: { t: number; votes: number; label: string; iso: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const t = now - i * 60_000;
      const d = new Date(t);
      buckets.push({
        t,
        votes: 0,
        label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        iso: d.toISOString(),
      });
    }
    liveRows.forEach((r) => {
      const ts = new Date(r.created_at).getTime();
      const idx = 29 - Math.floor((now - ts) / 60_000);
      if (idx >= 0 && idx < 30) buckets[idx].votes += 1;
    });
    return buckets;
  }, [liveRows]);

  const peak = useMemo(() => Math.max(0, ...timeline.map((b) => b.votes)), [timeline]);
  const windowStart = timeline[0]?.label ?? '';
  const windowEnd = timeline[timeline.length - 1]?.label ?? '';

  // History — group rows by poll
  const history = useMemo(() => {
    const map = new Map<string, { pollId: string; total: number; latest: string }>();
    rows.forEach((r) => {
      const cur = map.get(r.poll_id);
      if (cur) {
        cur.total += 1;
        if (r.created_at > cur.latest) cur.latest = r.created_at;
      } else {
        map.set(r.poll_id, { pollId: r.poll_id, total: 1, latest: r.created_at });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => (a.latest < b.latest ? 1 : -1))
      .slice(0, 25);
  }, [rows]);

  return (
    <OperatorLayout>
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Statistics</h1>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Anonymous analytics · retained for 24 hours and automatically deleted.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge className="bg-mako-error/20 text-mako-error border-mako-error/30 gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-mako-error animate-pulse" />
                LIVE
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCSV(
                  `vote-analytics-24h-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
                  rows,
                  polls,
                )
              }
            >
              <Download className="h-4 w-4" />
              Export 24h CSV
            </Button>
            {activePoll && liveRows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCSV(
                    `vote-analytics-${(activePoll.internal_name || activePoll.question || activePoll.id).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}-30min.csv`,
                    liveRows.filter((r) => Date.now() - new Date(r.created_at).getTime() <= 30 * 60_000),
                    polls,
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export Active 30min
              </Button>
            )}
          </div>
        </div>

        {/* Live Voting */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-mono">
              Live Voting
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!activePoll ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {loading ? 'Loading…' : 'No active poll. Open voting on a poll to see live metrics.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-6">
                <div className="grid grid-cols-3 gap-6 lg:gap-8 lg:border-r lg:border-border lg:pr-8">
                  <Stat label="Total Votes" value={totalVotes.toLocaleString()} big />
                  <Stat label="Per Minute" value={votesPerMinute.toLocaleString()} />
                  <Stat
                    label="Leading"
                    value={leading ? `${Math.round(leading.pct)}%` : '—'}
                    sub={leading?.label}
                  />
                </div>
                <div className="space-y-2">
                  {answerBreakdown.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Waiting for votes…</div>
                  ) : (
                    answerBreakdown.map((a) => (
                      <div key={a.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-foreground truncate pr-2">{a.label}</span>
                          <span className="font-mono text-muted-foreground">
                            {a.votes} · {Math.round(a.pct)}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-[width] duration-500"
                            style={{ width: `${Math.max(2, a.rel)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audience Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-mono">
              Audience Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audience.total === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No audience data in the last 24 hours.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <BreakdownList title="Device" items={audience.device} />
                <BreakdownList title="Browser" items={audience.browser} />
                <BreakdownList title="OS" items={audience.os} />
                <div className="space-y-3">
                  <BreakdownList title="Country" items={audience.country} />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                    Approximate audience location
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-mono">
                Voting Timeline · Last 30 min
              </CardTitle>
              <p className="text-[11px] font-mono text-muted-foreground">
                Window {windowStart} → {windowEnd}
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground">Peak {peak}/min</span>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={28} />
                  <Tooltip
                    cursor={{ stroke: 'hsl(var(--border))' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { t: number; votes: number };
                      const d = new Date(p.t);
                      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const date = d.toLocaleDateString();
                      return (
                        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
                          <div className="font-mono text-muted-foreground">{date} · {time}</div>
                          <div className="text-foreground font-semibold">{p.votes} vote{p.votes === 1 ? '' : 's'}/min</div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="votes"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Poll History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-mono">
              Poll History · Last 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No polls received votes in the last 24 hours.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground font-mono">
                      <th className="px-3 py-2">Poll</th>
                      <th className="px-3 py-2 w-[180px]">Project</th>
                      <th className="px-3 py-2 w-[120px]">Block</th>
                      <th className="px-3 py-2 w-[100px]">Votes</th>
                      <th className="px-3 py-2 w-[100px]">Status</th>
                      <th className="px-3 py-2 w-[160px]">Last vote</th>
                      <th className="px-3 py-2 w-[110px] text-right">Export</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const p = polls[h.pollId];
                      const status = activePollId === h.pollId && isLive ? 'open' : 'closed';
                      const projectName = p?.project_id ? (projects[p.project_id]?.name ?? '—') : '—';
                      const blockText = [p?.block_letter, p?.block_label].filter(Boolean).join(' · ') || '—';
                      return (
                        <tr key={h.pollId} className="border-t border-border/50">
                          <td className="px-3 py-2 text-foreground truncate max-w-[420px]">
                            {p?.internal_name || p?.question || h.pollId.slice(0, 8)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">
                            {projectName}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs truncate max-w-[120px]">
                            {blockText}
                          </td>
                          <td className="px-3 py-2 font-mono">{h.total}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={
                                status === 'open'
                                  ? 'border-mako-error/40 text-mako-error'
                                  : 'border-border text-muted-foreground'
                              }
                            >
                              {status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                            {new Date(h.latest).toLocaleTimeString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() =>
                                downloadCSV(
                                  `vote-analytics-${(p?.internal_name || p?.question || h.pollId).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.csv`,
                                  rows.filter((r) => r.poll_id === h.pollId),
                                  polls,
                                )
                              }
                            >
                              <Download className="h-3.5 w-3.5" />
                              CSV
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              CSV exports include only anonymous metadata: timestamp, poll, answer, device, browser, OS, and approximate region.
            </p>
          </CardContent>
        </Card>
      </div>
    </OperatorLayout>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className={big ? 'text-4xl font-bold tabular-nums text-foreground' : 'text-2xl font-semibold tabular-nums text-foreground'}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{sub}</div>}
    </div>
  );
}

function BreakdownList({ title, items }: { title: string; items: { label: string; count: number; pct: number }[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">{title}</div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">—</div>
        ) : (
          items.map((i) => (
            <div key={i.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-foreground truncate pr-2">{i.label}</span>
                <span className="font-mono text-muted-foreground">{Math.round(i.pct)}%</span>
              </div>
              <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full bg-primary/70" style={{ width: `${Math.max(2, i.pct)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}