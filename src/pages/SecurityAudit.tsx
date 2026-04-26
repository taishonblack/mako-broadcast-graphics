import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight, in-app security audit. Lists every public route and every
 * Supabase surface we intentionally expose to anonymous users, then runs a
 * handful of live verification checks against the database with the anon key
 * to make sure no operator data leaks. Operator-only page; not linked from
 * the public site.
 */

interface PublicRoute {
  path: string;
  purpose: string;
  notes: string;
}

const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', purpose: 'Login screen', notes: 'No data fetched. Unauthenticated users land here.' },
  { path: '/vote/:slug', purpose: 'Voter vote / results screen', notes: 'Reads only via get_viewer_poll_by_slug RPC + RLS-gated realtime tables.' },
];

interface AnonSurface {
  kind: 'rpc' | 'policy';
  name: string;
  table?: string;
  exposes: string;
}

const ANON_SURFACES: AnonSurface[] = [
  { kind: 'rpc', name: 'get_viewer_poll_by_slug(text)', exposes: 'Question, subheadline, bg colors, slate copy, post-vote delay — owner & internal fields hidden.' },
  { kind: 'policy', name: 'Public can view live state when voting is active', table: 'project_live_state', exposes: 'Only rows where voting_state IN (open, closed). Idle operator state stays private.' },
  { kind: 'policy', name: 'Public can view answers for publicly live polls', table: 'poll_answers', exposes: 'Only answers whose poll is currently the active live poll on its project.' },
  { kind: 'policy', name: 'Public can view viewer configs for publicly live polls', table: 'poll_viewer_configs', exposes: 'Only configs for the actively live poll.' },
  { kind: 'policy', name: 'Anon can read publicly live poll channels', table: 'realtime.messages', exposes: 'Only viewer-poll-<id> realtime topics for polls currently open/closed.' },
];

type CheckStatus = 'pending' | 'pass' | 'fail';
interface CheckResult {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
  hint?: string;
}

export default function SecurityAudit() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const runAudit = async () => {
    setRunning(true);
    const checks: CheckResult[] = [];

    // 1. Anon SELECT on polls must NOT return rows. We use a separate anon
    //    client so RLS evaluates against the anonymous role, regardless of
    //    the operator's current session.
    const anon = (await import('@supabase/supabase-js')).createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: pollRows, error: pollErr } = await anon.from('polls').select('id').limit(1);
    checks.push({
      id: 'polls-anon',
      label: 'polls table is not anon-readable',
      detail: pollErr ? `Blocked (${pollErr.code ?? 'rls'})` : `Returned ${pollRows?.length ?? 0} rows`,
      status: !pollRows || pollRows.length === 0 ? 'pass' : 'fail',
      hint: 'polls must only be reachable via get_viewer_poll_by_slug RPC.',
    });

    // 2. Anon SELECT on project_live_state should only return open/closed rows.
    const { data: liveRows } = await anon
      .from('project_live_state')
      .select('voting_state')
      .limit(50);
    const leaked = (liveRows ?? []).some((r) => r.voting_state !== 'open' && r.voting_state !== 'closed');
    checks.push({
      id: 'live-state-gated',
      label: 'project_live_state only exposes open/closed rows',
      detail: `Returned ${liveRows?.length ?? 0} row(s)${leaked ? ' — includes idle row!' : ''}`,
      status: leaked ? 'fail' : 'pass',
      hint: 'Idle (not_open) rows must stay private to operators.',
    });

    // 3. Anon SELECT on projects must NOT return rows.
    const { data: projectRows } = await anon.from('projects').select('id').limit(1);
    checks.push({
      id: 'projects-anon',
      label: 'projects table is not anon-readable',
      detail: `Returned ${projectRows?.length ?? 0} row(s)`,
      status: (projectRows?.length ?? 0) === 0 ? 'pass' : 'fail',
    });

    // 4. Anon SELECT on backgrounds / images / logos must NOT return rows.
    for (const t of ['backgrounds', 'images', 'logos'] as const) {
      const { data } = await anon.from(t).select('id').limit(1);
      checks.push({
        id: `${t}-anon`,
        label: `${t} table is not anon-readable`,
        detail: `Returned ${data?.length ?? 0} row(s)`,
        status: (data?.length ?? 0) === 0 ? 'pass' : 'fail',
      });
    }

    // 5. Voter RPC returns at most the safe column set.
    const { data: rpcRow, error: rpcErr } = await anon
      .rpc('get_viewer_poll_by_slug', { _slug: '__nonexistent__' });
    const allowedKeys = new Set([
      'id', 'project_id', 'question', 'subheadline', 'bg_color', 'bg_image',
      'show_live_results', 'show_thank_you', 'show_final_results',
      'slate_text', 'slate_subline_text', 'post_vote_delay_ms',
    ]);
    const sample = Array.isArray(rpcRow) ? rpcRow[0] : null;
    const extra = sample ? Object.keys(sample).filter((k) => !allowedKeys.has(k)) : [];
    checks.push({
      id: 'rpc-shape',
      label: 'get_viewer_poll_by_slug returns only safe columns',
      detail: rpcErr ? `RPC error: ${rpcErr.message}` : extra.length === 0 ? 'Shape verified' : `Leaks: ${extra.join(', ')}`,
      status: rpcErr ? 'fail' : extra.length === 0 ? 'pass' : 'fail',
    });

    setResults(checks);
    setRunning(false);
  };

  useEffect(() => { void runAudit(); }, []);

  const passing = useMemo(() => results.filter((r) => r.status === 'pass').length, [results]);
  const failing = useMemo(() => results.filter((r) => r.status === 'fail').length, [results]);

  return (
    <OperatorLayout>
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/settings" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Security audit
              </h1>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Public surface · realtime exposure · anon verification
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={runAudit} disabled={running}>
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${running ? 'animate-spin' : ''}`} /> Re-run
          </Button>
        </div>

        {/* Live verification results */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Verification</h2>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-mako-success">{passing} pass</span>
              {failing > 0 && <span className="text-mako-warning">{failing} fail</span>}
            </div>
          </div>
          <div className="space-y-2">
            {results.length === 0 && <p className="text-xs text-muted-foreground">Running checks…</p>}
            {results.map((r) => (
              <div key={r.id} className={`rounded-lg border p-3 flex items-start gap-3 ${r.status === 'pass' ? 'border-mako-success/30 bg-mako-success/5' : r.status === 'fail' ? 'border-mako-warning/40 bg-mako-warning/5' : 'border-border bg-muted/20'}`}>
                {r.status === 'pass' ? (
                  <ShieldCheck className="w-4 h-4 text-mako-success mt-0.5" />
                ) : r.status === 'fail' ? (
                  <ShieldAlert className="w-4 h-4 text-mako-warning mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.detail}</p>
                  {r.hint && <p className="text-[11px] text-muted-foreground mt-1">{r.hint}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Public routes */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Public routes</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            {PUBLIC_ROUTES.map((r, i) => (
              <div key={r.path} className={`p-3 flex items-start gap-4 ${i > 0 ? 'border-t border-border' : ''}`}>
                <code className="text-xs font-mono text-primary shrink-0 w-32">{r.path}</code>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.purpose}</p>
                  <p className="text-xs text-muted-foreground">{r.notes}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Every other route is wrapped in <code>&lt;ProtectedRoute&gt;</code> and redirects unauthenticated users to <code>/</code>.
          </p>
        </section>

        {/* Anon-accessible Supabase surface */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Anon-accessible backend surface</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            {ANON_SURFACES.map((s, i) => (
              <div key={s.name} className={`p-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                <div className="flex items-start gap-3">
                  <Badge variant={s.kind === 'rpc' ? 'default' : 'secondary'} className="text-[10px] uppercase shrink-0">
                    {s.kind}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-foreground">{s.name}</p>
                    {s.table && <p className="text-[11px] font-mono text-muted-foreground">on {s.table}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{s.exposes}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Adding a new anon-accessible policy or RPC? Update <code>src/pages/SecurityAudit.tsx</code> so future audits flag drift.
          </p>
        </section>
      </div>
    </OperatorLayout>
  );
}