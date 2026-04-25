import { useEffect, useRef, useState } from 'react';

/**
 * Convert a stream of "true" vote counts into a display-ready stream that
 * either tracks them in real time (`live`) or snaps forward on a fixed
 * interval (`stopMotion`). The latter is the broadcast-style "stop motion
 * tally" the operator can use during dramatic reveals or when raw votes
 * are too sparse to look animated.
 *
 * The returned arrays mirror the shape of `liveVotes` / total — components
 * can drop these into the same render path that previously consumed the
 * live numbers without further changes.
 */
export function useTallyDisplay(
  liveVotes: number[],
  liveTotal: number,
  mode: 'live' | 'stopMotion',
  intervalSeconds: number,
) {
  const [displayVotes, setDisplayVotes] = useState<number[]>(liveVotes);
  const [displayTotal, setDisplayTotal] = useState<number>(liveTotal);
  const latest = useRef({ votes: liveVotes, total: liveTotal });

  // Always keep the latest "true" values in a ref so the interval picks up
  // the freshest snapshot when it next fires.
  useEffect(() => {
    latest.current = { votes: liveVotes, total: liveTotal };
  }, [liveVotes, liveTotal]);

  // Live mode: pass through immediately.
  useEffect(() => {
    if (mode !== 'live') return;
    setDisplayVotes(liveVotes);
    setDisplayTotal(liveTotal);
  }, [mode, liveVotes, liveTotal]);

  // Stop Motion: snap-update every N seconds.
  useEffect(() => {
    if (mode !== 'stopMotion') return;
    // Push an immediate snapshot so the bars don't sit empty until the
    // first tick — operators expect to see *something* the moment they
    // flip the toggle.
    setDisplayVotes(latest.current.votes);
    setDisplayTotal(latest.current.total);
    const ms = Math.max(1, intervalSeconds) * 1000;
    const id = window.setInterval(() => {
      setDisplayVotes(latest.current.votes);
      setDisplayTotal(latest.current.total);
    }, ms);
    return () => window.clearInterval(id);
  }, [mode, intervalSeconds]);

  return { displayVotes, displayTotal };
}