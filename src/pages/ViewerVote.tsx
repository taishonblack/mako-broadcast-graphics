import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type ViewerStatus = 'loading' | 'not_found' | 'not_open' | 'open' | 'closed';

interface ViewerAnswer {
  id: string;
  label: string;
  short_label: string;
  sort_order: number;
  live_votes: number;
}

interface ViewerPoll {
  id: string;
  project_id: string | null;
  question: string;
  subheadline: string;
  bg_color: string;
  bg_image: string | null;
  show_live_results: boolean;
  show_thank_you: boolean;
  show_final_results: boolean;
  slate_text: string;
  slate_subline_text: string;
  slate_image: string | null;
  post_vote_delay_ms: number;
}

/** Subset of OutputAssets we actually consume on the viewer. Kept loose so a
 *  partial / older snapshot still renders. */
interface ViewerSnapshotAssets {
  enabledAssetIds?: string[];
  assetColors?: {
    question?: { textPrimary?: string };
    answers?: { textPrimary?: string; textSecondary?: string; barColors?: string[] };
    subheadline?: { textSecondary?: string };
  };
}

interface ViewerSnapshot {
  poll?: {
    id?: string;
    projectId?: string;
    project_id?: string;
    slug?: string;
    viewer_slug?: string;
    question?: string;
    subheadline?: string;
    bgColor?: string;
    bgImage?: string;
    showLiveResults?: boolean;
    showThankYou?: boolean;
    showFinalResults?: boolean;
    postVoteDelayMs?: number;
    slateText?: string;
    slate_text?: string;
    slateSublineText?: string;
    slate_subline_text?: string;
    slateImage?: string | null;
    slate_image?: string | null;
    options?: Array<{ id: string; text?: string; label?: string; shortLabel?: string; short_label?: string; votes?: number; live_votes?: number; order?: number; sort_order?: number }>;
    answers?: Array<{ id: string; text?: string; label?: string; shortLabel?: string; short_label?: string; votes?: number; live_votes?: number; order?: number; sort_order?: number }>;
  };
  assets?: ViewerSnapshotAssets;
  slateText?: string;
  slate_text?: string;
  slateSublineText?: string;
  slate_subline_text?: string;
  slateImage?: string | null;
  slate_image?: string | null;
  /** Operator pressed "Polling Slate" — viewer should render the slate
   *  text/image instead of the MakoVote branding or the "Closed" screen. */
  slateActive?: boolean;
}

type LiveStateRow = {
  project_id?: string | null;
  voting_state?: string;
  active_poll_id?: string | null;
  live_poll_snapshot?: ViewerSnapshot | null;
};

function answersFromSnapshot(snapshotPoll?: ViewerSnapshot['poll']): ViewerAnswer[] {
  return (snapshotPoll?.options ?? snapshotPoll?.answers ?? []).map((option, index) => ({
    id: option.id,
    label: option.text || option.label || `Answer ${index + 1}`,
    short_label: option.shortLabel || option.short_label || '',
    sort_order: option.order ?? option.sort_order ?? index,
    live_votes: option.votes ?? option.live_votes ?? 0,
  }));
}

function pollFromLiveSnapshot(row: LiveStateRow, routeSlug: string): ViewerPoll | null {
  const liveSnapshot = row.live_poll_snapshot;
  const snapshotPoll = liveSnapshot?.poll;
  if (!snapshotPoll) return null;
  return {
    id: row.active_poll_id || snapshotPoll.id || `snapshot-${snapshotPoll.viewer_slug || snapshotPoll.slug || routeSlug || 'viewer'}`,
    project_id: row.project_id || snapshotPoll.projectId || snapshotPoll.project_id || null,
    question: snapshotPoll.question || 'Cast your vote',
    subheadline: snapshotPoll.subheadline || '',
    bg_color: snapshotPoll.bgColor || 'hsl(220, 20%, 7%)',
    bg_image: snapshotPoll.bgImage || null,
    show_live_results: snapshotPoll.showLiveResults ?? true,
    show_thank_you: snapshotPoll.showThankYou ?? true,
    show_final_results: snapshotPoll.showFinalResults ?? true,
    slate_text: liveSnapshot.slateText || liveSnapshot.slate_text || snapshotPoll.slateText || snapshotPoll.slate_text || 'Polling will open soon',
    slate_subline_text: liveSnapshot.slateSublineText || liveSnapshot.slate_subline_text || snapshotPoll.slateSublineText || snapshotPoll.slate_subline_text || '',
    slate_image: liveSnapshot.slateImage || liveSnapshot.slate_image || snapshotPoll.slateImage || snapshotPoll.slate_image || null,
    post_vote_delay_ms: snapshotPoll.postVoteDelayMs ?? 1500,
  };
}

function snapshotSlug(snapshot?: ViewerSnapshot | null) {
  return snapshot?.poll?.viewer_slug || snapshot?.poll?.slug || '';
}

export default function ViewerVote() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [poll, setPoll] = useState<ViewerPoll | null>(null);
  const [answers, setAnswers] = useState<ViewerAnswer[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [postVoteStage, setPostVoteStage] = useState<'received' | 'after'>('received');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  /** Operator's color + enabled-asset choices, mirrored from the live state
   *  snapshot. When present we apply them so mobile/desktop voters see the
   *  same palette as the on-air program. */
  const [snapshot, setSnapshot] = useState<ViewerSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: liveRows } = await supabase
        .from('project_live_state')
        .select('project_id, voting_state, active_poll_id, live_poll_snapshot')
        .in('voting_state', ['open', 'closed']);
      if (cancelled) return;

      const rows = (liveRows ?? []) as LiveStateRow[];
      const exactMatch = rows.find((row) => snapshotSlug(row.live_poll_snapshot) === slug);
      const liveMatch = exactMatch ?? rows.find((row) => Boolean(row.live_poll_snapshot));
      const voting_state = liveMatch?.voting_state ?? 'not_open';
      const live_poll_snapshot = liveMatch?.live_poll_snapshot ?? null;
      console.log('Viewer live state', {
        voting_state,
        hasSnapshot: Boolean(live_poll_snapshot),
        slateActive: live_poll_snapshot?.slateActive,
        snapshotSlug: live_poll_snapshot?.poll?.viewer_slug || live_poll_snapshot?.poll?.slug,
        routeSlug: slug,
      });

      if (!liveMatch || !live_poll_snapshot) {
        setSnapshot(null);
        setPoll(null);
        setAnswers([]);
        setStatus('not_open');
        return;
      }

      setSnapshot(live_poll_snapshot);
      setPoll(pollFromLiveSnapshot(liveMatch, slug));
      setAnswers(answersFromSnapshot(live_poll_snapshot.poll));
      setStatus(voting_state === 'open' ? 'open' : 'closed');
    };
    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Realtime: stream live vote totals + voting state changes so the viewer
  // reflects open/close transitions and tally updates without refresh.
  //
  // Scope each subscription to the row that actually drives this viewer:
  //  - project_live_state filtered by the current project_id
  //  - poll_answers filtered by the current poll_id
  // This avoids cross-poll noise when multiple viewer tabs (different slugs
  // / different projects) are open in the same browser session.
  const projectId = poll?.project_id ?? null;
  const pollId = poll?.id ?? null;
  useEffect(() => {
    if (!projectId && !pollId) return;

    const channel = supabase.channel(
      `viewer-live-${projectId ?? 'noproj'}-${pollId ?? 'nopoll'}`,
    );

    if (pollId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_answers', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          const row = payload.new as Partial<ViewerAnswer> | undefined;
          if (!row?.id) return;
          setAnswers((current) =>
            current.map((a) => (a.id === row.id ? { ...a, live_votes: row.live_votes ?? a.live_votes } : a)),
          );
        },
      );
    }

    if (projectId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_live_state', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as LiveStateRow | undefined;
          if (!row) return;
        const live_poll_snapshot = row.live_poll_snapshot ?? null;
        console.log('Viewer live state', {
          voting_state: row.voting_state ?? 'not_open',
          hasSnapshot: Boolean(live_poll_snapshot),
          slateActive: live_poll_snapshot?.slateActive,
          snapshotSlug: live_poll_snapshot?.poll?.viewer_slug || live_poll_snapshot?.poll?.slug,
          routeSlug: slug,
        });

        if (!live_poll_snapshot) {
          setSnapshot(null);
          setPoll(null);
          setAnswers([]);
          setStatus('not_open');
          setHasVoted(false);
          setSelectedOption(null);
          setPostVoteStage('received');
          return;
        }

        setSnapshot(live_poll_snapshot);
        setPoll(pollFromLiveSnapshot(row, slug));
        setAnswers(answersFromSnapshot(live_poll_snapshot.poll));
        setStatus(row.voting_state === 'open' ? 'open' : 'closed');
        },
      );
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, pollId, slug]);

  // Discovery subscription: when the viewer has not yet matched a project
  // (e.g. the operator hasn't pressed Go Live / Polling Slate for the first
  // time on this slug), listen broadly to project_live_state INSERT/UPDATE
  // and re-run the initial loader to pick up the snapshot. This keeps the
  // scoped subscriptions above noise-free during normal operation.
  useEffect(() => {
    if (projectId) return; // already scoped — skip discovery
    const channel = supabase
      .channel(`viewer-discover-${slug || 'default'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_live_state' },
        (payload) => {
          const row = payload.new as LiveStateRow | undefined;
          const snap = row?.live_poll_snapshot ?? null;
          if (!snap) return;
          // Only act if this row could be ours (slug matches or no slug yet).
          const snapSlug = snapshotSlug(snap);
          if (slug && snapSlug && snapSlug !== slug) return;
          setSnapshot(snap);
          setPoll(pollFromLiveSnapshot(row as LiveStateRow, slug));
          setAnswers(answersFromSnapshot(snap.poll));
          setStatus(row?.voting_state === 'open' ? 'open' : 'closed');
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, slug]);

  const handleVote = (optionId: string) => {
    setSelectedOption(optionId);
    setPostVoteStage('received');
    setHasVoted(true);
  };

  // After the voter taps an answer, keep the highlighted selection visible
  // for ~3 seconds so they see which choice they cast, then transition to
  // the Thank You screen. (Per product spec — overrides per-poll delay.)
  useEffect(() => {
    if (!hasVoted || postVoteStage !== 'received') return;
    const timer = window.setTimeout(() => setPostVoteStage('after'), 3000);
    return () => window.clearTimeout(timer);
  }, [hasVoted, postVoteStage]);

  const totalVotes = useMemo(() => answers.reduce((sum, a) => sum + (a.live_votes ?? 0), 0), [answers]);
  const showLiveResults = Boolean(poll?.show_live_results);
  const showThankYou = poll?.show_thank_you !== false; // default on
  // Final results are no longer rendered on close — operator-stop reverts
  // viewers to the MakoVote slate per product spec.

  // Operator-assigned colors. Falls back to the design tokens used in the
  // existing viewer if the operator hasn't customized anything.
  const colors = snapshot?.assets?.assetColors;
  const questionColor = colors?.question?.textPrimary;
  const subColor = colors?.subheadline?.textSecondary;
  const barColors = colors?.answers?.barColors;

  // Results-only folders mirror the Program composition: if the live folder
  // has answer bars but no viewer answer type / QR entry point, show a mirror
  // slate instead of vote buttons. Folders with `answerType` or `qr` collect
  // votes and must render the answer UI when voting is open.
  // Operator broadcast: when the Polling Slate button is ON, show the
  // operator-authored slate text/image instead of MakoVote branding or the
  // "Polling is Closed" screen. The flag rides on the live snapshot so we
  // only render the slate when the operator explicitly turned it on for
  // this poll's slug.
  const slateBroadcastActive = Boolean(snapshot?.slateActive);

  const bgStyle: React.CSSProperties = poll?.bg_image
    ? { backgroundImage: `url(${poll.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: poll?.bg_color || 'hsl(220, 20%, 7%)' };

  // ---- Loading ----
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={{ background: 'hsl(220, 20%, 7%)' }}>
        <MakoVoteSlate sublabel="Loading…" />
      </div>
    );
  }

  // ---- Polling Slate broadcast (operator pressed "Polling Slate") ----
  // Render the operator's slate copy/image instead of MakoVote.
  if (slateBroadcastActive) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10 w-full max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          {poll?.slate_image && (
            <img
              src={poll.slate_image}
              alt="Polling slate"
              className="mx-auto max-h-64 max-w-full rounded-lg border border-white/10 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            {poll?.slate_text || 'Polling will open soon'}
          </h1>
          {poll?.slate_subline_text && (
            <p className="text-sm text-muted-foreground">{poll.slate_subline_text}</p>
          )}
          <BrandBug />
        </div>
      </div>
    );
  }

  // ---- Slug not found, not open, OR closed without slate: MakoVote slate ----
  // When the operator stops Go Live, voting_state goes to 'closed' and the
  // snapshot is cleared — viewers should see MakoVote branding again
  // (NOT the "Polling is Closed" screen).
  if (status === 'not_found' || status === 'not_open' || status === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10">
          <MakoVoteSlate />
        </div>
      </div>
    );
  }

  // ---- Vote received → Thank You (stage 2 only). Stage 1 keeps the
  //      answer types visible with the operator's choice highlighted so the
  //      voter sees what they tapped for ~3s before this Thank You appears. ----
  if (hasVoted && postVoteStage === 'after') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10 w-full max-w-sm">
          {showThankYou && (
            <>
              <div className="w-16 h-16 rounded-full bg-mako-success/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-mako-success" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Thank you for voting</h1>
              <p className="text-sm text-muted-foreground">Your vote has been counted</p>
            </>
          )}
          {showLiveResults && answers.length > 0 && (
            <ResultsList answers={answers} totalVotes={totalVotes} />
          )}
          <BrandBug />
        </div>
      </div>
    );
  }

  // ---- Active voting ----
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in" style={bgStyle}>
      <div className="w-full max-w-sm space-y-8 bg-background/40 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="text-center">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: questionColor || 'hsl(var(--foreground))' }}>
            {poll?.question || 'Cast your vote'}
          </h1>
          {poll?.subheadline && (
            <p className="text-sm mt-2" style={{ color: subColor || 'hsl(var(--muted-foreground))' }}>{poll.subheadline}</p>
          )}
        </div>
        {answers.length > 0 ? (
          <div className="space-y-3">
            {answers.map((option) => {
              const isSelected = selectedOption === option.id;
              const isOtherSelected = hasVoted && !isSelected;
              return (
                <button
                  key={option.id}
                  onClick={() => handleVote(option.id)}
                  disabled={hasVoted}
                  className={[
                    'w-full p-4 rounded-2xl text-left font-medium text-foreground transition-all border',
                    isSelected
                      ? 'border-primary bg-primary/20 ring-2 ring-primary shadow-[0_0_24px_hsl(var(--primary)/0.45)]'
                      : isOtherSelected
                        ? 'border-border/30 opacity-40'
                        : 'border-border/50 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]',
                  ].join(' ')}
                  style={{ background: isSelected ? undefined : 'hsla(220, 18%, 13%, 0.8)' }}
                >
                  <span className="text-base flex items-center justify-between gap-2">
                    <span>{option.label}</span>
                    {isSelected && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-mako-warning/40 bg-mako-warning/10 px-4 py-3 text-left"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-mako-warning" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-mako-warning">No answers loaded</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Voting is open but answer choices haven&apos;t arrived yet. Hold tight — they&apos;ll appear automatically.
              </p>
            </div>
          </div>
        )}
        {showLiveResults && totalVotes > 0 && (
          <ResultsList answers={answers} totalVotes={totalVotes} barColors={barColors} />
        )}
        <BrandBug />
      </div>
    </div>
  );
}

function ResultsList({ answers, totalVotes, barColors }: { answers: ViewerAnswer[]; totalVotes: number; barColors?: string[] }) {
  return (
    <div className="space-y-2 text-left">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Live Results</span>
        <span className="text-[10px] font-mono text-muted-foreground">{totalVotes} vote{totalVotes === 1 ? '' : 's'}</span>
      </div>
      {answers.map((a, i) => {
        const pct = totalVotes > 0 ? Math.round(((a.live_votes ?? 0) / totalVotes) * 100) : 0;
        const fill = barColors?.[i % barColors.length];
        return (
          <div key={a.id} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-foreground truncate pr-2">{a.label}</span>
              <span className="font-mono text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: fill || 'hsl(var(--primary))' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MakoVoteSlate({ sublabel }: { sublabel?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-center font-bold leading-none select-none text-4xl">
        <span className="text-foreground/90">Mako</span>
        <span className="text-primary">Vote</span>
      </div>
      {sublabel && <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground/80 pt-1">{sublabel}</p>}
    </div>
  );
}

function BrandBug() {
  return (
    <div className="flex items-center justify-center gap-2 pt-4 opacity-30">
      <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-[8px]">M</span>
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">MakoVote</span>
    </div>
  );
}
