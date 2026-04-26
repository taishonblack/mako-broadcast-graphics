import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';

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
    slug?: string;
    question?: string;
    subheadline?: string;
    options?: Array<{ id: string; text?: string; shortLabel?: string; votes?: number; order?: number }>;
  };
  assets?: ViewerSnapshotAssets;
}

export default function ViewerVote() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [poll, setPoll] = useState<ViewerPoll | null>(null);
  const [answers, setAnswers] = useState<ViewerAnswer[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [postVoteStage, setPostVoteStage] = useState<'received' | 'after'>('received');
  const [, setSelectedOption] = useState<string | null>(null);
  /** Operator's color + enabled-asset choices, mirrored from the live state
   *  snapshot. When present we apply them so mobile/desktop voters see the
   *  same palette as the on-air program. */
  const [snapshot, setSnapshot] = useState<ViewerSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!slug) { setStatus('not_found'); return; }
      // Public viewers cannot SELECT directly from `polls` anymore — that
      // table is locked down to its owner. Instead we call a SECURITY
      // DEFINER RPC that returns ONLY the safe viewer-facing columns for
      // the requested slug. Prevents enumeration of other operators' polls.
      const { data: rpcRows } = await supabase
        .rpc('get_viewer_poll_by_slug', { _slug: slug });
      const pollRow = Array.isArray(rpcRows) ? rpcRows[0] : null;
      if (cancelled) return;
      if (!pollRow) { setStatus('not_found'); return; }
      setPoll(pollRow as ViewerPoll);

      const [{ data: answerRows }, liveStateRes] = await Promise.all([
        supabase
          .from('poll_answers')
          .select('id, label, short_label, sort_order, live_votes')
          .eq('poll_id', pollRow.id)
          .order('sort_order', { ascending: true }),
        pollRow.project_id
          ? supabase
              .from('project_live_state')
              .select('voting_state, active_poll_id, live_poll_snapshot')
              .eq('project_id', pollRow.project_id)
              .maybeSingle()
          : Promise.resolve({ data: null } as { data: null }),
      ]);
      if (cancelled) return;

      setAnswers((answerRows ?? []) as ViewerAnswer[]);

      const live = (liveStateRes as { data: { voting_state?: string; active_poll_id?: string | null; live_poll_snapshot?: ViewerSnapshot | null } | null }).data;
      const votingState = live?.voting_state ?? 'not_open';
      const liveSnapshot = live?.live_poll_snapshot;
      const snapshotPoll = liveSnapshot?.poll;
      const snapshotMatchesSlug = snapshotPoll?.slug === slug;
      const isThisPollLive = !live || live.active_poll_id === pollRow.id || snapshotMatchesSlug;
      if (live?.live_poll_snapshot) setSnapshot(live.live_poll_snapshot);
      if ((answerRows ?? []).length === 0 && snapshotPoll?.options?.length) {
        setAnswers(snapshotPoll.options.map((option, index) => ({
          id: option.id,
          label: option.text || `Answer ${index + 1}`,
          short_label: option.shortLabel || '',
          sort_order: option.order ?? index,
          live_votes: option.votes ?? 0,
        })));
      }

      if (votingState === 'open' && isThisPollLive) setStatus('open');
      else if (votingState === 'closed' && isThisPollLive) setStatus('closed');
      else setStatus('not_open');
    };
    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Realtime: stream live vote totals + voting state changes so the viewer
  // reflects open/close transitions and tally updates without refresh.
  useEffect(() => {
    if (!poll?.id) return;
    const channel = supabase
      .channel(`viewer-poll-${poll.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_answers', filter: `poll_id=eq.${poll.id}` }, (payload) => {
        const row = payload.new as Partial<ViewerAnswer> | undefined;
        if (!row?.id) return;
        setAnswers((current) => current.map((a) => a.id === row.id ? { ...a, live_votes: row.live_votes ?? a.live_votes } : a));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_live_state', filter: poll.project_id ? `project_id=eq.${poll.project_id}` : undefined }, (payload) => {
        const row = payload.new as { voting_state?: string; active_poll_id?: string | null; live_poll_snapshot?: ViewerSnapshot | null } | undefined;
        if (!row) return;
        const snapshotPoll = row.live_poll_snapshot?.poll;
        const isThisPollLive = !row.active_poll_id || row.active_poll_id === poll.id || snapshotPoll?.slug === slug;
        if (row.live_poll_snapshot !== undefined) setSnapshot(row.live_poll_snapshot ?? null);
        if (snapshotPoll?.options?.length) {
          setAnswers(snapshotPoll.options.map((option, index) => ({
            id: option.id,
            label: option.text || `Answer ${index + 1}`,
            short_label: option.shortLabel || '',
            sort_order: option.order ?? index,
            live_votes: option.votes ?? 0,
          })));
        }
        if (row.voting_state === 'open' && isThisPollLive) setStatus('open');
        else if (row.voting_state === 'closed' && isThisPollLive) setStatus('closed');
        else setStatus('not_open');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [poll?.id, poll?.project_id]);

  const handleVote = (optionId: string) => {
    setSelectedOption(optionId);
    setPostVoteStage('received');
    setHasVoted(true);
  };

  // After "Vote Received" shows, wait the configured delay then transition
  // to the thank-you / results screen (same hasVoted view, second stage).
  useEffect(() => {
    if (!hasVoted || postVoteStage !== 'received') return;
    const delay = Math.max(0, poll?.post_vote_delay_ms ?? 1500);
    const timer = window.setTimeout(() => setPostVoteStage('after'), delay);
    return () => window.clearTimeout(timer);
  }, [hasVoted, postVoteStage, poll?.post_vote_delay_ms]);

  const totalVotes = useMemo(() => answers.reduce((sum, a) => sum + (a.live_votes ?? 0), 0), [answers]);
  const showLiveResults = Boolean(poll?.show_live_results);
  const showThankYou = poll?.show_thank_you !== false; // default on
  const showFinalResults = Boolean(poll?.show_final_results);

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
  const enabled = snapshot?.assets?.enabledAssetIds;
  const folderCollectsVotes = Array.isArray(enabled) && (enabled.includes('answerType') || enabled.includes('qr'));
  const isMirrorMode = Array.isArray(enabled) && !folderCollectsVotes;

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

  // ---- Slug not found OR not open: show MakoVote slate ----
  if (status === 'not_found' || status === 'not_open') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10">
          {status === 'not_open' && (
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          {status === 'not_open' && poll?.slate_image && (
            <img
              src={poll.slate_image}
              alt="Polling slate"
              className="mx-auto max-h-64 max-w-full rounded-lg border border-white/10 object-contain"
            />
          )}
          <MakoVoteSlate sublabel={status === 'not_open' ? (poll?.slate_text || 'Polling will open soon') : undefined} />
          {status === 'not_open' && poll?.slate_subline_text && (
            <p className="text-sm text-muted-foreground">{poll.slate_subline_text}</p>
          )}
        </div>
      </div>
    );
  }

  // ---- Closed: optionally show final results ----
  if (status === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10 w-full max-w-sm">
          <div className="w-16 h-16 rounded-full bg-mako-warning/20 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8 text-mako-warning" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Polling is Closed</h1>
          <p className="text-sm text-muted-foreground">Thanks for participating!</p>
          {showFinalResults && answers.length > 0 && (
            <ResultsList answers={answers} totalVotes={totalVotes} />
          )}
          <BrandBug />
        </div>
      </div>
    );
  }

  // ---- Vote received: thank-you screen + optional live results ----
  if (hasVoted) {
    // Stage 1: brief "Vote Received" confirmation before the configured delay
    // elapses, regardless of which post-vote screen is configured.
    if (postVoteStage === 'received') {
      return (
        <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
          <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10 w-full max-w-sm">
            <div className="w-16 h-16 rounded-full bg-mako-success/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-mako-success" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Vote Received</h1>
            <p className="text-sm text-muted-foreground">Your vote has been counted</p>
            <BrandBug />
          </div>
        </div>
      );
    }

    // Stage 2: after the configured delay — show thank-you and/or live results.
    return (
      <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
        <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10 w-full max-w-sm">
          {showThankYou && (
            <>
              <div className="w-16 h-16 rounded-full bg-mako-success/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-mako-success" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Thank You</h1>
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
  if (status === 'open' && isMirrorMode) {
    const voteUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/vote/${slug}`
      : `/vote/${slug}`;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in" style={bgStyle}>
        <div className="w-full max-w-sm space-y-8 bg-background/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-center">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: questionColor || 'hsl(var(--foreground))' }}>
            {poll?.question || snapshot?.poll?.question || 'Stand by'}
          </h1>
          {poll?.subheadline && (
            <p className="text-sm" style={{ color: subColor || 'hsl(var(--muted-foreground))' }}>{poll.subheadline}</p>
          )}
          <div className="bg-white p-4 rounded-xl inline-block">
            <QRCodeSVG value={voteUrl} size={180} level="M" />
          </div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Scan to follow along
          </p>
          <BrandBug />
        </div>
      </div>
    );
  }

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
            {answers.map((option) => (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                className="w-full p-4 rounded-2xl text-left font-medium text-foreground transition-all active:scale-[0.98] border border-border/50 hover:border-primary/50 hover:bg-primary/5"
                style={{ background: 'hsla(220, 18%, 13%, 0.8)' }}
              >
                <span className="text-base">{option.label}</span>
              </button>
            ))}
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
