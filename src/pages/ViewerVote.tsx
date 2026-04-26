import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
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
    projectId?: string;
    slug?: string;
    question?: string;
    subheadline?: string;
    bgColor?: string;
    bgImage?: string;
    showLiveResults?: boolean;
    showThankYou?: boolean;
    showFinalResults?: boolean;
    postVoteDelayMs?: number;
    options?: Array<{ id: string; text?: string; shortLabel?: string; votes?: number; order?: number }>;
  };
  assets?: ViewerSnapshotAssets;
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
  return (snapshotPoll?.options ?? []).map((option, index) => ({
    id: option.id,
    label: option.text || `Answer ${index + 1}`,
    short_label: option.shortLabel || '',
    sort_order: option.order ?? index,
    live_votes: option.votes ?? 0,
  }));
}

function pollFromLiveSnapshot(row: LiveStateRow, slug: string): ViewerPoll | null {
  const snapshotPoll = row.live_poll_snapshot?.poll;
  if (!snapshotPoll || snapshotPoll.slug !== slug) return null;
  return {
    id: row.active_poll_id || snapshotPoll.id || `snapshot-${slug}`,
    project_id: row.project_id || snapshotPoll.projectId || null,
    question: snapshotPoll.question || 'Cast your vote',
    subheadline: snapshotPoll.subheadline || '',
    bg_color: snapshotPoll.bgColor || 'hsl(220, 20%, 7%)',
    bg_image: snapshotPoll.bgImage || null,
    show_live_results: snapshotPoll.showLiveResults ?? true,
    show_thank_you: snapshotPoll.showThankYou ?? true,
    show_final_results: snapshotPoll.showFinalResults ?? true,
    slate_text: 'Polling will open soon',
    slate_subline_text: '',
    slate_image: null,
    post_vote_delay_ms: snapshotPoll.postVoteDelayMs ?? 1500,
  };
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
      if (!slug) { setStatus('not_found'); return; }
      // Public viewers cannot SELECT directly from `polls` anymore — that
      // table is locked down to its owner. Instead we call a SECURITY
      // DEFINER RPC that returns ONLY the safe viewer-facing columns for
      // the requested slug. Prevents enumeration of other operators' polls.
      const { data: rpcRows } = await supabase
        .rpc('get_viewer_poll_by_slug', { _slug: slug });
      const pollRow = Array.isArray(rpcRows) ? rpcRows[0] : null;
      if (cancelled) return;
      if (!pollRow) {
        const { data: liveRows } = await supabase
          .from('project_live_state')
          .select('project_id, voting_state, active_poll_id, live_poll_snapshot')
          .in('voting_state', ['open', 'closed']);
        if (cancelled) return;
        const liveMatch = ((liveRows ?? []) as LiveStateRow[]).find((row) => row.live_poll_snapshot?.poll?.slug === slug);
        const snapshotPoll = liveMatch?.live_poll_snapshot?.poll;
        const fallbackPoll = liveMatch ? pollFromLiveSnapshot(liveMatch, slug) : null;
        if (!liveMatch || !fallbackPoll) { setStatus('not_found'); return; }
        setPoll(fallbackPoll);
        setSnapshot(liveMatch.live_poll_snapshot ?? null);
        setAnswers(answersFromSnapshot(snapshotPoll));
        setStatus(liveMatch.voting_state === 'closed' ? 'closed' : 'open');
        return;
      }
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
        setAnswers(answersFromSnapshot(snapshotPoll));
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
        const snapshotMatchesSlug = snapshotPoll?.slug === slug;
        const isThisPollLive = !row.active_poll_id || row.active_poll_id === poll.id || snapshotMatchesSlug;
        if (row.live_poll_snapshot !== undefined) setSnapshot(row.live_poll_snapshot ?? null);
        if (snapshotMatchesSlug) {
          const snapshotPollRow = pollFromLiveSnapshot(row, slug);
          if (snapshotPollRow) setPoll((current) => ({ ...snapshotPollRow, ...current, id: snapshotPollRow.id }));
        }
        if (snapshotPoll?.options?.length) {
          setAnswers(answersFromSnapshot(snapshotPoll));
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
  const enabled = snapshot?.assets?.enabledAssetIds;
  const folderCollectsVotes = Array.isArray(enabled) && (enabled.includes('answerType') || enabled.includes('qr'));
  const isMirrorMode = Array.isArray(enabled) && !folderCollectsVotes;

  // Operator broadcast: when the Polling Slate button is ON, show the
  // operator-authored slate text/image instead of MakoVote branding or the
  // "Polling is Closed" screen. The flag rides on the live snapshot so we
  // only render the slate when the operator explicitly turned it on for
  // this poll's slug.
  const slateBroadcastActive = Boolean(snapshot?.slateActive)
    && (snapshot?.poll?.slug === slug);

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
  if (slateBroadcastActive && status !== 'open') {
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
