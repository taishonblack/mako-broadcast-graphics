import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to real voter tallies for a poll.
 *
 * Pulls the current `live_votes` for each answer from `poll_answers` and
 * keeps them up-to-date in realtime via a Postgres-changes subscription.
 * Returns a map of `answerId → live_votes` so callers can merge real
 * counts into their existing answer arrays without restructuring state.
 *
 * Pass `enabled = false` (typical when not on-air) to skip the network
 * subscription and return an empty map — callers can keep showing test
 * data instead.
 */
export function useLiveVotes(pollId: string | undefined, enabled: boolean) {
  const [voteMap, setVoteMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!enabled || !pollId) {
      setVoteMap({});
      return;
    }

    let cancelled = false;

    // Initial fetch — gives us the starting tallies even before the first
    // realtime delta arrives.
    void (async () => {
      const { data, error } = await supabase
        .from('poll_answers')
        .select('id, live_votes')
        .eq('poll_id', pollId);
      if (cancelled || error || !data) return;
      const next: Record<string, number> = {};
      for (const row of data) next[row.id as string] = (row.live_votes as number) ?? 0;
      setVoteMap(next);
    })();

    // Realtime: scope to this poll so we don't get noise from other polls.
    const channel = supabase
      .channel(`poll-answers-${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_answers', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; live_votes?: number } | null;
          if (!row?.id) return;
          setVoteMap((prev) => ({ ...prev, [row.id as string]: (row.live_votes as number) ?? 0 }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [pollId, enabled]);

  return voteMap;
}