import { useEffect, useRef, useState } from 'react';
import { PollOption } from '@/lib/types';

/**
 * Continuously interpolate vote counts toward their latest target so the
 * bar graph animates smoothly during Go Live instead of jumping in
 * realtime-delta-sized bursts. Uses requestAnimationFrame with an
 * exponential ease (critically damped feel) — every render the displayed
 * value advances a fraction of the remaining gap, giving a continuous
 * "leaking toward truth" motion that looks great even when the underlying
 * stream is bursty (a batch of votes arrives, then nothing for a second).
 *
 * When `enabled` is false (not on-air) we pass the target through
 * unchanged so the build/preview workflow is unaffected.
 *
 * `halfLifeMs` controls the perceived speed: smaller = snappier, larger =
 * silkier. ~280ms feels broadcast-natural for vote tallies.
 */
export function useSmoothedVotes(
  options: PollOption[],
  enabled: boolean,
  halfLifeMs = 280,
): PollOption[] {
  const [smoothed, setSmoothed] = useState<PollOption[]>(options);
  const targetRef = useRef<PollOption[]>(options);
  const displayRef = useRef<number[]>(options.map((o) => o.votes));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  // Always keep the latest target snapshot in a ref so the RAF loop reads
  // the freshest numbers without re-subscribing.
  useEffect(() => {
    targetRef.current = options;
    // If the option set changed identity (length / ids), reset the
    // display buffer so a new bar doesn't tween in from a stale value.
    if (displayRef.current.length !== options.length) {
      displayRef.current = options.map((o) => o.votes);
      setSmoothed(options);
      return;
    }
    for (let i = 0; i < options.length; i += 1) {
      if (smoothed[i]?.id !== options[i].id) {
        displayRef.current[i] = options[i].votes;
      }
    }
    // Pass through immediately when smoothing is off.
    if (!enabled) {
      displayRef.current = options.map((o) => o.votes);
      setSmoothed(options);
    }
    // We intentionally don't depend on `smoothed` to avoid re-running on
    // every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Half-life decay: per-frame factor = 0.5 ^ (dt / halfLife).
    const tick = (ts: number) => {
      const dt = lastTsRef.current === 0 ? 16 : Math.min(64, ts - lastTsRef.current);
      lastTsRef.current = ts;
      const decay = Math.pow(0.5, dt / halfLifeMs);
      const targets = targetRef.current;
      const display = displayRef.current;
      let stillMoving = false;
      const next: PollOption[] = new Array(targets.length);
      for (let i = 0; i < targets.length; i += 1) {
        const tgt = targets[i].votes;
        const cur = display[i] ?? tgt;
        const gap = tgt - cur;
        // Snap when within 0.05 of a vote — avoids endless sub-pixel drift.
        const stepped = Math.abs(gap) < 0.05 ? tgt : cur + gap * (1 - decay);
        display[i] = stepped;
        if (Math.abs(tgt - stepped) >= 0.05) stillMoving = true;
        next[i] = { ...targets[i], votes: stepped };
      }
      setSmoothed(next);
      if (stillMoving) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        lastTsRef.current = 0;
      }
    };
    // Always kick a tick when targets change; the effect below handles that.
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
    };
  }, [enabled, halfLifeMs, options]);

  return enabled ? smoothed : options;
}