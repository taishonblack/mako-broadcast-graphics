import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Activity, RefreshCw, AlertTriangle, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Vote Pipeline Check
 *
 * Diagnostic panel for the Statistics page. Confirms that a test vote
 * travels end-to-end through the same path a real viewer takes:
 *
 *   cast_vote RPC → votes table → poll_answers.live_votes → analytics.
 *
 * Test votes are tagged with a `makovote-healthcheck-{timestamp}` session
 * id so they're trivially identifiable and never get treated as audience
 * analytics (the analytics edge function isn't called from this panel).
 */

const HEALTHCHECK_PREFIX = 'makovote-healthcheck';

interface PipelineSnapshot {
  // From project_live_state
  active_poll_id: string | null;
  live_poll_id: string | null;
  live_slug: string | null;
  voting_state: string | null;
  project_id: string | null;
  // From public_viewer_state (looked up via live_slug)
  pvs_state: string | null;
  pvs_has_snapshot: boolean;
  pvs_snapshot_poll_id: string | null;
  pvs_slug: string | null;
  // From poll_answers
  first_answer_id: string | null;
  first_answer_label: string | null;
  total_live_votes: number;
  // Vote / analytics counts for the active poll
  votes_count: number;
  analytics_count: number;
}

type CheckStatus = 'pending' | 'pass' | 'fail' | 'skip';
interface CheckRow {
  label: string;
  status: CheckStatus;
  detail?: string;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-mako-success shrink-0" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  if (status === 'pending') return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />;
  return <span className="h-4 w-4 inline-block rounded-full border border-border shrink-0" />;
}

export function VotePipelineCheck() {
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  // Collapsed by default once it's healthy — operators want it out of the
  // way when the pipeline is green. Persisted so a refresh keeps the
  // operator's chosen state.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return sessionStorage.getItem('makovote.pipelineCheck.collapsed') === '1'; }
    catch { return false; }
  });
  useEffect(() => {
    try { sessionStorage.setItem('makovote.pipelineCheck.collapsed', collapsed ? '1' : '0'); }
    catch { /* ignore */ }
  }, [collapsed]);

  const refresh = useCallback(async (): Promise<PipelineSnapshot | null> => {
    setLoading(true);
    try {
      // 1. Live state — most-recently-updated row across the operator's projects.
      const { data: liveRow, error: liveErr } = await supabase
        .from('project_live_state')
        .select('active_poll_id, live_poll_id, live_slug, voting_state, project_id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (liveErr) {
        toast.error(`Live state read failed: ${liveErr.message}`);
        return null;
      }

      const live = (liveRow ?? {}) as Partial<PipelineSnapshot>;
      const activePollId = live.active_poll_id ?? null;
      const liveSlug = live.live_slug ?? null;

      // 2. public_viewer_state for that slug.
      let pvsState: string | null = null;
      let pvsSnapshotPollId: string | null = null;
      let pvsHasSnapshot = false;
      let pvsSlug: string | null = null;
      if (liveSlug) {
        const { data: pvsRow } = await supabase
          .from('public_viewer_state' as never)
          .select('state, viewer_slug, poll_snapshot')
          .eq('viewer_slug', liveSlug)
          .maybeSingle();
        const row = pvsRow as { state?: string; viewer_slug?: string; poll_snapshot?: { id?: string } | null } | null;
        pvsState = row?.state ?? null;
        pvsSlug = row?.viewer_slug ?? null;
        pvsHasSnapshot = Boolean(row?.poll_snapshot);
        pvsSnapshotPollId = row?.poll_snapshot?.id ?? null;
      }

      // 3. First answer + tallies for the active poll.
      let firstAnswerId: string | null = null;
      let firstAnswerLabel: string | null = null;
      let totalLive = 0;
      let votesCount = 0;
      let analyticsCount = 0;
      if (activePollId) {
        const { data: answers } = await supabase
          .from('poll_answers')
          .select('id, label, sort_order, live_votes')
          .eq('poll_id', activePollId)
          .order('sort_order', { ascending: true });
        const list = (answers ?? []) as Array<{ id: string; label: string; live_votes: number }>;
        if (list.length) {
          firstAnswerId = list[0].id;
          firstAnswerLabel = list[0].label;
          totalLive = list.reduce((s, a) => s + (a.live_votes ?? 0), 0);
        }

        const [{ count: vc }, { count: ac }] = await Promise.all([
          supabase.from('votes').select('id', { count: 'exact', head: true }).eq('poll_id', activePollId),
          supabase.from('vote_analytics' as never).select('id', { count: 'exact', head: true }).eq('poll_id', activePollId),
        ]);
        votesCount = vc ?? 0;
        analyticsCount = ac ?? 0;
      }

      const snap: PipelineSnapshot = {
        active_poll_id: activePollId,
        live_poll_id: live.live_poll_id ?? null,
        live_slug: liveSlug,
        voting_state: live.voting_state ?? null,
        project_id: live.project_id ?? null,
        pvs_state: pvsState,
        pvs_has_snapshot: pvsHasSnapshot,
        pvs_snapshot_poll_id: pvsSnapshotPollId,
        pvs_slug: pvsSlug,
        first_answer_id: firstAnswerId,
        first_answer_label: firstAnswerLabel,
        total_live_votes: totalLive,
        votes_count: votesCount,
        analytics_count: analyticsCount,
      };
      setSnapshot(snap);
      return snap;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto re-check when the operator returns to the Statistics tab — covers
  // the "open Output Mode in a new tab → Go Live → come back" loop so the
  // checklist updates immediately without a manual click.
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Snapshot/slug mismatch — pvs has a poll_snapshot but its embedded
  // poll id doesn't correspond to the currently published live_slug's
  // expected active_poll_id (or the audience row's slug differs from
  // live_slug). Either way, viewers are looking at the wrong poll.
  const slugMismatch = useMemo(() => {
    if (!snapshot || !snapshot.pvs_has_snapshot) return false;
    if (snapshot.live_slug && snapshot.pvs_slug && snapshot.live_slug !== snapshot.pvs_slug) return true;
    if (snapshot.active_poll_id && snapshot.pvs_snapshot_poll_id && snapshot.active_poll_id !== snapshot.pvs_snapshot_poll_id) return true;
    return false;
  }, [snapshot]);

  // Hard gates for Send Test Vote — every condition must be green or we
  // refuse, otherwise the test would assert against a half-published state
  // and produce misleading pass/fail rows.
  // Per-gate evaluation — drives both the disable logic and the
  // diagnostic breakdown shown under the Send Test Vote button.
  const gates = useMemo(() => {
    const s = snapshot;
    return [
      { key: 'active_poll_id', label: 'active_poll_id present',
        ok: Boolean(s?.active_poll_id),
        detail: s?.active_poll_id ?? 'no active_poll_id in project_live_state' },
      { key: 'pvs_has_snapshot', label: 'public_viewer_state has poll_snapshot',
        ok: Boolean(s?.pvs_has_snapshot),
        detail: s?.pvs_has_snapshot ? `snapshot.id = ${s?.pvs_snapshot_poll_id ?? '—'}` : 'poll_snapshot missing' },
      { key: 'snapshot_matches_slug', label: 'poll_snapshot matches live_slug',
        ok: !slugMismatch,
        detail: slugMismatch
          ? `live_slug=${snapshot?.live_slug ?? '—'} · pvs_slug=${snapshot?.pvs_slug ?? '—'} · snapshot.id=${snapshot?.pvs_snapshot_poll_id ?? '—'}`
          : 'snapshot aligned with live_slug' },
      { key: 'voting_state', label: 'voting_state = open',
        ok: s?.voting_state === 'open',
        detail: `voting_state = ${s?.voting_state ?? 'unknown'}` },
      { key: 'first_answer_id', label: 'at least one poll answer exists',
        ok: Boolean(s?.first_answer_id),
        detail: s?.first_answer_id ? `first answer = ${s?.first_answer_label ?? s?.first_answer_id}` : 'no answers configured' },
    ];
  }, [snapshot, slugMismatch]);

  const canSendTest = useMemo(() => snapshot != null && gates.every((g) => g.ok), [snapshot, gates]);

  const sendTestVote = useCallback(async () => {
    if (!snapshot) return;
    const { active_poll_id, first_answer_id, first_answer_label, voting_state } = snapshot;
    setRunning(true);
    setChecks([
      { label: 'Active poll found', status: active_poll_id ? 'pass' : 'fail',
        detail: active_poll_id ?? 'No active poll_id' },
      { label: 'Voting is open', status: voting_state === 'open' ? 'pass' : 'fail',
        detail: voting_state ?? 'unknown' },
      { label: 'Public viewer state has poll snapshot',
        status: snapshot.pvs_has_snapshot ? 'pass' : 'fail',
        detail: snapshot.pvs_has_snapshot
          ? `pvs.poll_snapshot.id = ${snapshot.pvs_snapshot_poll_id ?? '—'}`
          : (snapshot.live_slug ? 'poll_snapshot missing' : 'Slug has no public_viewer_state') },
      { label: 'Test vote submitted', status: 'pending' },
      { label: 'Row inserted into votes table', status: 'pending' },
      { label: 'poll_answers.live_votes incremented', status: 'pending' },
      { label: 'Statistics refreshed (votes count)', status: 'pending' },
      { label: 'Output Inspector should now show updated tally', status: 'pending' },
    ]);

    const setCheck = (idx: number, patch: Partial<CheckRow>) => {
      setChecks((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    };

    if (!active_poll_id || !first_answer_id || voting_state !== 'open') {
      setRunning(false);
      return;
    }

    const sessionId = `${HEALTHCHECK_PREFIX}-${Date.now()}`;

    // Baseline: votes count + the target answer's live_votes BEFORE the test
    // so we can measure deltas — voted-twice from the same session is a
    // no-op in cast_vote, so the delta is what matters, not the absolute.
    const { count: votesBefore } = await supabase
      .from('votes').select('id', { count: 'exact', head: true }).eq('poll_id', active_poll_id);
    const { data: answerBefore } = await supabase
      .from('poll_answers').select('live_votes').eq('id', first_answer_id).maybeSingle();
    const liveVotesBefore = (answerBefore as { live_votes?: number } | null)?.live_votes ?? 0;

    // Use the SAME RPC the viewer uses — no bypass.
    const { data: rpcData, error: rpcErr } = await supabase.rpc('cast_vote', {
      _poll_id: active_poll_id,
      _answer_id: first_answer_id,
      _session_id: sessionId,
    });
    if (rpcErr) {
      setCheck(3, { status: 'fail', detail: `cast_vote failed: ${rpcErr.message}` });
      setRunning(false);
      return;
    }
    const rpcOk = (rpcData as { ok?: boolean } | null)?.ok === true;
    setCheck(3, {
      status: rpcOk ? 'pass' : 'fail',
      detail: rpcOk
        ? `session ${sessionId} → ${first_answer_label ?? first_answer_id}`
        : `cast_vote returned: ${JSON.stringify(rpcData)}`,
    });
    if (!rpcOk) {
      setRunning(false);
      return;
    }

    // Verify the row landed in votes (server inserted it; we look it up by
    // session_id which is unique-per-poll for cast_vote).
    const { data: voteRow } = await supabase
      .from('votes')
      .select('id, answer_id, session_id, created_at')
      .eq('poll_id', active_poll_id)
      .eq('session_id', sessionId)
      .maybeSingle();
    setCheck(4, voteRow
      ? { status: 'pass', detail: `vote.id ${(voteRow as { id: string }).id.slice(0, 8)}…` }
      : { status: 'fail', detail: 'No row in votes for this healthcheck session' });

    // Verify live_votes incremented on the target answer.
    const { data: answerAfter } = await supabase
      .from('poll_answers').select('live_votes').eq('id', first_answer_id).maybeSingle();
    const liveVotesAfter = (answerAfter as { live_votes?: number } | null)?.live_votes ?? 0;
    const incremented = liveVotesAfter === liveVotesBefore + 1;
    setCheck(5, incremented
      ? { status: 'pass', detail: `live_votes ${liveVotesBefore} → ${liveVotesAfter}` }
      : { status: 'fail', detail: `vote inserted but live_votes did not increment (${liveVotesBefore} → ${liveVotesAfter})` });

    // Refresh the snapshot and confirm the votes count moved.
    const refreshed = await refresh();
    const votesAfter = refreshed?.votes_count ?? 0;
    const baseline = votesBefore ?? 0;
    setCheck(6, votesAfter > baseline
      ? { status: 'pass', detail: `votes count ${baseline} → ${votesAfter}` }
      : { status: 'fail', detail: `Statistics is reading a different poll_id or count did not move (${baseline} → ${votesAfter})` });

    // Inspector parity is realtime-driven; we can't query it directly, but
    // if the previous two checks passed, the same realtime payload that
    // updates Statistics also updates Output Inspector.
    setCheck(7, incremented
      ? { status: 'pass', detail: 'live_votes change broadcast via realtime — Inspector should reflect it' }
      : { status: 'fail', detail: 'live_votes did not move; Inspector will not update' });

    setRunning(false);
    toast.success('Test vote sent');
  }, [snapshot, refresh]);

  // Surfaced when the operator ended a show but a stale slug is lingering.
  // Real cause: live_slug persisted but active_poll_id was cleared. The
  // public_viewer_state row may still be `voting` until the next Go Live
  // overwrites it via the sync trigger.
  const showStaleSlugWarning = Boolean(snapshot && snapshot.live_slug && !snapshot.active_poll_id);

  // Show the "Open Output Mode" helper whenever we can't run the pipeline:
  // either no active poll at all, or voting hasn't been opened yet.
  const showOpenOutputHelper = Boolean(
    snapshot && (!snapshot.active_poll_id || snapshot.voting_state !== 'open'),
  );

  return (
    <Card className="border-mako-orange/30">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left group"
          aria-expanded={!collapsed}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-2">
            <Activity className="h-4 w-4 text-mako-orange" />
            Vote Pipeline Check
            <Badge variant="outline" className="text-[10px] font-mono uppercase">Diagnostic</Badge>
            {collapsed && snapshot && (
              <Badge
                variant="outline"
                className={`text-[10px] font-mono uppercase ${canSendTest ? 'text-mako-success border-mako-success/40' : 'text-mako-warning border-mako-warning/40'}`}
              >
                {canSendTest ? 'Ready' : 'Blocked'}
              </Badge>
            )}
          </CardTitle>
        </button>
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); void refresh(); }} disabled={loading || running}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Re-check Pipeline
        </Button>
      </CardHeader>
      {!collapsed && (
      <CardContent className="space-y-4">
        {/* 1. Active poll status grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
          <Field label="active_poll_id" value={snapshot?.active_poll_id} />
          <Field label="live_slug" value={snapshot?.live_slug} />
          <Field label="voting_state" value={snapshot?.voting_state} highlight={snapshot?.voting_state === 'open' ? 'pass' : 'warn'} />
          <Field label="public_viewer_state" value={snapshot?.pvs_state ?? '—'} highlight={snapshot?.pvs_state ? 'pass' : 'fail'} />
          <Field label="poll_snapshot" value={snapshot?.pvs_has_snapshot ? 'present' : 'missing'} highlight={snapshot?.pvs_has_snapshot ? 'pass' : 'fail'} />
          <Field label="snapshot.poll_id matches" value={
            snapshot?.pvs_snapshot_poll_id && snapshot.active_poll_id
              ? (snapshot.pvs_snapshot_poll_id === snapshot.active_poll_id ? 'yes' : 'NO')
              : '—'
          } highlight={
            snapshot?.pvs_snapshot_poll_id && snapshot.active_poll_id && snapshot.pvs_snapshot_poll_id !== snapshot.active_poll_id
              ? 'fail' : undefined
          } />
          <Field label="votes (poll)" value={snapshot ? String(snapshot.votes_count) : '—'} />
          <Field label="poll_answers Σ live_votes" value={snapshot ? String(snapshot.total_live_votes) : '—'} />
          <Field label="vote_analytics (poll)" value={snapshot ? String(snapshot.analytics_count) : '—'} />
        </div>

        {/* Slug mismatch — pvs_has_snapshot is true but the snapshot's slug
         *  or embedded poll id doesn't match what's currently live. The
         *  audience is voting on the wrong poll until this is fixed. */}
        {slugMismatch && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Snapshot does not match live_slug.</div>
              <div className="text-[11px] font-mono text-foreground/80 mt-0.5">
                live_slug=<span className="text-foreground">{snapshot?.live_slug ?? '—'}</span>
                {' · '}pvs_slug=<span className="text-foreground">{snapshot?.pvs_slug ?? '—'}</span>
                {' · '}snapshot.id=<span className="text-foreground">{snapshot?.pvs_snapshot_poll_id ?? '—'}</span>
              </div>
              <div className="text-[11px] text-foreground/80 mt-1">
                Send Test Vote is blocked. Go Live again on the current draft to re-publish a snapshot for this slug.
              </div>
            </div>
          </div>
        )}

        {/* Stale slug — slug published but no active poll. Operator probably
         *  ended live and the slug pointer wasn't cleared, or Go Live half-
         *  succeeded. Either way, the audience link points to nothing. */}
        {showStaleSlugWarning && (
          <div className="flex items-start gap-2 rounded-md border border-mako-warning/40 bg-mako-warning/10 px-3 py-2 text-xs text-mako-warning">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Live slug exists, but no active poll is published.</div>
              <div className="text-[11px] font-mono text-foreground/80 mt-0.5">
                /vote/{snapshot?.live_slug} → no active_poll_id. Go Live again to publish this slug.
              </div>
            </div>
          </div>
        )}

        {/* Operator helper — shown when there's no active poll OR voting
         *  isn't open yet. Walks the operator through the exact steps to
         *  get the pipeline into a runnable state. */}
        {showOpenOutputHelper && (
          <div className="rounded-md border border-mako-orange/30 bg-mako-orange/5 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-mako-orange" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Get the pipeline live
                </span>
              </div>
              <Button asChild size="sm" variant="default">
                <Link to="/workspace?mode=output" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Output Mode
                </Link>
              </Button>
            </div>
            <ol className="space-y-1 text-[11px] font-mono text-muted-foreground list-decimal pl-5">
              <li>Select a poll / folder</li>
              <li>Confirm viewer slug exists</li>
              <li>Click <span className="text-foreground">Full Screen Output</span></li>
              <li>Click <span className="text-foreground">Go Live</span></li>
              <li>Confirm <span className="text-foreground">voting_state = open</span></li>
              <li>Return to Statistics and click <span className="text-foreground">Re-check Pipeline</span></li>
            </ol>
          </div>
        )}

        {/* 2 + 4. Action row */}
        <div className="flex items-center gap-3">
          <Button onClick={() => void sendTestVote()} disabled={!canSendTest || running} size="sm">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Send Test Vote
          </Button>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            Test session id prefix: <span className="text-foreground">{HEALTHCHECK_PREFIX}-…</span>
          </span>
        </div>

        {/* Per-gate breakdown — directly under the button so the operator
         *  can see which condition is blocking Send Test Vote. */}
        <div className="rounded-md border border-border bg-card/40 divide-y divide-border">
          {gates.map((g) => (
            <div key={g.key} className="flex items-start gap-2 px-3 py-1.5 text-[11px]">
              <StatusIcon status={g.ok ? 'pass' : 'fail'} />
              <div className="flex-1 min-w-0">
                <div className={g.ok ? 'text-foreground' : 'text-mako-warning'}>{g.label}</div>
                <div className="text-[10px] font-mono text-muted-foreground truncate">{g.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 3. Result checklist */}
        {checks.length > 0 && (
          <div className="rounded-md border border-border bg-card/40 divide-y divide-border">
            {checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                <StatusIcon status={c.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-foreground">{c.label}</div>
                  {c.detail && (
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{c.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}

function Field({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: 'pass' | 'fail' | 'warn' }) {
  const tone =
    highlight === 'pass' ? 'text-mako-success' :
    highlight === 'fail' ? 'text-destructive' :
    highlight === 'warn' ? 'text-mako-warning' :
    'text-foreground';
  return (
    <div className="rounded-md border border-border bg-card/40 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-[11px] font-mono truncate ${tone}`}>{value || '—'}</div>
    </div>
  );
}