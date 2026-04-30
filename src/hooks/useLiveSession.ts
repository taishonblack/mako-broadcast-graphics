import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { writePublicViewerState } from '@/lib/public-viewer-state';
import { broadcastOutputLock } from '@/lib/output-state';

export type LiveVotingState = 'not_open' | 'open' | 'closed';

export interface LiveSession {
  /** True when the project's output is on-air. Mirrors `output_state === 'program_live'`. */
  isLive: boolean;
  /** Voting state mirrored from `project_live_state.voting_state`. */
  votingState: LiveVotingState;
  /** The active project id (if known). */
  projectId: string | null;
  /** End the live session. Mirrors PollCreate.handleEndPoll's DB writes — kept
   *  in this hook so the global LIVE badge can trigger End Live from any page. */
  endLive: () => Promise<void>;
  /** True while the End Live mutation is in flight. */
  ending: boolean;
}

/**
 * Subscribes to `project_live_state` for the active project and exposes a
 * persistent live/voting status. Reads the active project from
 * localStorage('mako-active-project') so it works on every operator page.
 *
 * The DB row is the source of truth; we also subscribe to realtime updates
 * so the badge reflects state changes coming from PollCreate or another
 * operator surface without a refresh.
 */
export function useLiveSession(): LiveSession {
  const [projectId, setProjectId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('mako-active-project'),
  );
  const [isLive, setIsLive] = useState(false);
  const [votingState, setVotingState] = useState<LiveVotingState>('not_open');
  const [viewerSlug, setViewerSlug] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  // Watch localStorage in case the active project changes from another tab.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'mako-active-project') {
        setProjectId(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    // Re-read on focus too — same-tab writes don't fire StorageEvent.
    const onFocus = () => setProjectId(localStorage.getItem('mako-active-project'));
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Initial load + realtime subscription.
  useEffect(() => {
    if (!projectId) {
      setIsLive(false);
      setVotingState('not_open');
      setViewerSlug(null);
      return;
    }
    let cancelled = false;
    const apply = (row: { output_state?: string; voting_state?: string; live_poll_snapshot?: unknown } | null) => {
      if (!row) {
        setIsLive(false);
        setVotingState('not_open');
        return;
      }
      setIsLive(row.output_state === 'program_live');
      const v = row.voting_state;
      setVotingState(v === 'open' || v === 'closed' || v === 'not_open' ? v : 'not_open');
      // Capture viewer slug from snapshot so endLive can also reset the
      // audience-facing viewer state to branding.
      try {
        const snap = row.live_poll_snapshot as { poll?: { viewer_slug?: string; slug?: string } } | null;
        const slug = snap?.poll?.viewer_slug ?? snap?.poll?.slug ?? null;
        if (slug) setViewerSlug(slug);
      } catch { /* ignore */ }
    };

    void supabase
      .from('project_live_state')
      .select('output_state, voting_state, live_poll_snapshot')
      .eq('project_id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) apply(data as never);
      });

    const channel = supabase
      .channel(`live-session-${projectId}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_live_state', filter: `project_id=eq.${projectId}` },
        (payload) => apply((payload.new ?? null) as never),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  const endLive = useCallback(async () => {
    if (!projectId || ending) return;
    setEnding(true);
    try {
      await supabase
        .from('project_live_state')
        .upsert({
          project_id: projectId,
          live_poll_snapshot: null,
          live_folder_id: null,
          voting_state: 'closed',
          output_state: 'preview',
        } as never);
      if (viewerSlug) {
        await writePublicViewerState({
          projectId,
          viewerSlug,
          state: 'branding',
          pollSnapshot: null,
        });
      }
      // Release the Program lock so any open Output window resumes
      // mirroring the workspace (matches PollCreate.handleEndPoll).
      broadcastOutputLock({ locked: false });
      // Drop the persisted live-session crumbs PollCreate uses for instant
      // rehydration so the workspace doesn't bounce back to "live" on remount.
      try { sessionStorage.removeItem('mako-live-session'); } catch { /* ignore */ }
      setIsLive(false);
      setVotingState('closed');
    } finally {
      setEnding(false);
    }
  }, [projectId, viewerSlug, ending]);

  return { isLive, votingState, projectId, endLive, ending };
}