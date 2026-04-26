import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PublicViewerStateName, PublicViewerPollSnapshot } from '@/lib/public-viewer-state';

interface ViewerStateRow {
  project_id: string;
  viewer_slug: string;
  state: PublicViewerStateName;
  poll_snapshot: PublicViewerPollSnapshot | null;
  slate_text: string;
  version: number;
  updated_at?: string;
}

type LocalStage = 'idle' | 'received' | 'thank_you';

/** Audience-only viewer page. Renders solely from `public_viewer_state` —
 *  never infers from project_live_state, enabledAssets, mirror mode, or slug
 *  matching beyond the initial fetch. */
export default function ViewerVote() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [row, setRow] = useState<ViewerStateRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [localStage, setLocalStage] = useState<LocalStage>('idle');
  const lastVersionRef = useRef<number>(-1);

  // Load row by slug. Highest version wins (defensive in case duplicate rows exist).
  const fetchRow = useCallback(async () => {
    if (!slug) return;
    const { data } = await supabase
      .from('public_viewer_state' as never)
      .select('project_id, viewer_slug, state, poll_snapshot, slate_text, version, updated_at')
      .eq('viewer_slug', slug)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLoaded(true);
    const next = (data ?? null) as ViewerStateRow | null;
    setRow((current) => {
      if (!next) return current ?? null;
      // Only replace if newer (or first load).
      if (!current || next.version >= current.version) return next;
      return current;
    });
  }, [slug]);

  // Reset local vote state when operator publishes a new state version.
  useEffect(() => {
    if (!row) return;
    if (lastVersionRef.current === row.version) return;
    lastVersionRef.current = row.version;
    setSelectedAnswerId(null);
    setLocalStage('idle');
  }, [row]);

  // Initial load.
  useEffect(() => { void fetchRow(); }, [fetchRow]);

  // 1.5s polling fallback for Safari/mobile reliability.
  useEffect(() => {
    const id = window.setInterval(() => { void fetchRow(); }, 1500);
    return () => window.clearInterval(id);
  }, [fetchRow]);

  // Realtime subscription scoped to this slug.
  useEffect(() => {
    if (!slug) return;
    const channel = supabase
      .channel(`public-viewer-${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'public_viewer_state', filter: `viewer_slug=eq.${slug}` },
        () => { void fetchRow(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug, fetchRow]);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    try { await fetchRow(); } finally { setRefreshing(false); }
  }, [fetchRow]);

  const handleVote = (answerId: string) => {
    setSelectedAnswerId(answerId);
    setLocalStage('received');
  };

  // After a vote: hold the highlighted selection for 3s, then thank you.
  useEffect(() => {
    if (localStage !== 'received') return;
    const t = window.setTimeout(() => setLocalStage('thank_you'), 3000);
    return () => window.clearTimeout(t);
  }, [localStage]);

  // Background style derived from snapshot.
  const snapshot = row?.poll_snapshot ?? null;
  const bgStyle: React.CSSProperties = snapshot?.bgImage
    ? { backgroundImage: `url(${snapshot.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: snapshot?.bgColor || 'hsl(220, 20%, 7%)' };

  // Determine effective render state.
  // Local override: voter just tapped → keep voting/thank-you visible regardless
  // of operator state until the next version arrives.
  const operatorState: PublicViewerStateName = row?.state ?? 'branding';
  const effective: PublicViewerStateName | 'thank_you' =
    localStage === 'thank_you' ? 'thank_you' : operatorState;

  const decision = effective; // 1:1 mapping; the switch below renders it.

  console.log('Viewer decision', {
    state: operatorState,
    version: row?.version,
    answerCount: snapshot?.answers?.length,
    routeSlug: slug,
    rowSlug: row?.viewer_slug,
    decision,
    loaded,
  });

  // ---- Render ----
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={bgStyle}>
        <RefreshButton onClick={refreshNow} busy={refreshing} />
        <MakoVoteSlate />
      </div>
    );
  }

  switch (decision) {
    case 'slate':
      return (
        <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
          <RefreshButton onClick={refreshNow} busy={refreshing} />
          <div className="text-center space-y-6 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-12 border border-white/10 w-full max-w-md">
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              {row?.slate_text || 'Polling will open soon'}
            </h1>
          </div>
        </div>
      );

    case 'voting':
      return (
        <VotingView
          snapshot={snapshot}
          bgStyle={bgStyle}
          selectedAnswerId={selectedAnswerId}
          onVote={handleVote}
          onRefresh={refreshNow}
          refreshing={refreshing}
        />
      );

    case 'thank_you':
      return (
        <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
          <RefreshButton onClick={refreshNow} busy={refreshing} />
          <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10 w-full max-w-sm">
            <div className="w-16 h-16 rounded-full bg-mako-success/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-mako-success" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Thank you for voting</h1>
            <p className="text-sm text-muted-foreground">Your vote has been counted</p>
            <BrandBug />
          </div>
        </div>
      );

    case 'closed':
      return (
        <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
          <RefreshButton onClick={refreshNow} busy={refreshing} />
          <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10 w-full max-w-sm">
            <h1 className="text-xl font-bold text-foreground">Voting is closed</h1>
            <BrandBug />
          </div>
        </div>
      );

    case 'branding':
    default:
      return (
        <div className="min-h-screen flex items-center justify-center px-6 animate-fade-in" style={bgStyle}>
          <RefreshButton onClick={refreshNow} busy={refreshing} />
          <div className="text-center space-y-4 bg-background/40 backdrop-blur-md rounded-2xl px-8 py-10 border border-white/10">
            <MakoVoteSlate />
          </div>
        </div>
      );
  }
}

function VotingView({
  snapshot,
  bgStyle,
  selectedAnswerId,
  onVote,
  onRefresh,
  refreshing,
}: {
  snapshot: PublicViewerPollSnapshot | null;
  bgStyle: React.CSSProperties;
  selectedAnswerId: string | null;
  onVote: (id: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const answers = useMemo(() => snapshot?.answers ?? [], [snapshot]);
  const colors = snapshot?.assetColors;
  const questionColor = colors?.question?.textPrimary;
  const subColor = colors?.subheadline?.textSecondary;
  const hasVoted = selectedAnswerId !== null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in" style={bgStyle}>
      <RefreshButton onClick={onRefresh} busy={refreshing} />
      <div className="w-full max-w-sm space-y-8 bg-background/40 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="text-center">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: questionColor || 'hsl(var(--foreground))' }}>
            {snapshot?.question || 'Cast your vote'}
          </h1>
          {snapshot?.subheadline && (
            <p className="text-sm mt-2" style={{ color: subColor || 'hsl(var(--muted-foreground))' }}>{snapshot.subheadline}</p>
          )}
        </div>
        <div className="space-y-3">
          {answers.map((option) => {
            const isSelected = selectedAnswerId === option.id;
            const isOtherSelected = hasVoted && !isSelected;
            return (
              <button
                key={option.id}
                onClick={() => onVote(option.id)}
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
        <BrandBug />
      </div>
    </div>
  );
}

function MakoVoteSlate() {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-center font-bold leading-none select-none text-4xl">
        <span className="text-foreground/90">Mako</span>
        <span className="text-primary">Vote</span>
      </div>
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

function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Refresh"
      className="fixed top-4 right-4 z-50 inline-flex items-center justify-center w-10 h-10 rounded-full bg-background/60 backdrop-blur-md border border-white/15 text-foreground/80 hover:text-foreground hover:bg-background/80 transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
    </button>
  );
}