import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Single source of truth for "what poll is on-air right now."
 *
 * Reads `project_live_state.active_poll_id` for the given project and
 * subscribes to changes. Also loads the on-air poll's `poll_answers`
 * UUIDs ordered by `sort_order` so callers can map their local answer
 * index → real answer UUID without guessing or string-id bridging.
 *
 * Output Mode and Program Preview MUST use this binding rather than the
 * workspace's currently-loaded poll. Otherwise switching the workspace
 * to a different poll mid-show silently disconnects the bars from the
 * actual live tallies (the bug this hook exists to fix).
 */
export interface ActivePollAnswer {
  id: string;
  label: string;
  short_label: string;
  color: string;
  sort_order: number;
}

export function useActivePollBinding(
  projectId: string | undefined,
  enabled: boolean,
): {
  activePollId: string | null;
  answerUuidsByOrder: string[];
  activeAnswers: ActivePollAnswer[];
} {
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [activeAnswers, setActiveAnswers] = useState<ActivePollAnswer[]>([]);

  // Subscribe to project_live_state for active_poll_id changes.
  useEffect(() => {
    if (!enabled || !projectId) {
      setActivePollId(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from('project_live_state')
        .select('active_poll_id')
        .eq('project_id', projectId)
        .maybeSingle();
      if (cancelled) return;
      const next = (data?.active_poll_id as string | null) ?? null;
      console.log('[active poll]', { project_id: projectId, active_poll_id: next });
      setActivePollId(next);
    })();

    const channel = supabase
      .channel(`active-poll-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_live_state', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { active_poll_id?: string | null } | null;
          setActivePollId((row?.active_poll_id as string | null) ?? null);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [projectId, enabled]);

  // Load ordered answer UUIDs for the active poll.
  useEffect(() => {
    if (!enabled || !activePollId) {
      setActiveAnswers([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('poll_answers')
        .select('id, label, short_label, color, sort_order')
        .eq('poll_id', activePollId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (cancelled || !data) return;
      setActiveAnswers(
        data.map((r) => ({
          id: r.id as string,
          label: (r.label as string) ?? '',
          short_label: (r.short_label as string) ?? '',
          color: (r.color as string) ?? '',
          sort_order: (r.sort_order as number) ?? 0,
        })),
      );
    };

    void load();

    const channel = supabase
      .channel(`active-poll-answers-${activePollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_answers', filter: `poll_id=eq.${activePollId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activePollId, enabled]);

  return {
    activePollId,
    answerUuidsByOrder: activeAnswers.map((a) => a.id),
    activeAnswers,
  };
}
