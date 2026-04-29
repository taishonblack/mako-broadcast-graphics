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
export function useActivePollBinding(
  projectId: string | undefined,
  enabled: boolean,
): { activePollId: string | null; answerUuidsByOrder: string[] } {
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [answerUuidsByOrder, setAnswerUuidsByOrder] = useState<string[]>([]);

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
      setActivePollId((data?.active_poll_id as string | null) ?? null);
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
      setAnswerUuidsByOrder([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('poll_answers')
        .select('id, sort_order')
        .eq('poll_id', activePollId)
        .order('sort_order', { ascending: true });
      if (cancelled || !data) return;
      setAnswerUuidsByOrder(data.map((r) => r.id as string));
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

  return { activePollId, answerUuidsByOrder };
}
