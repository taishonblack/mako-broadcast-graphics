/**
 * Single source of truth for the operator-controlled "Use Test Vote Bars"
 * preference. When `false` (the default) every bar graph in Program
 * Preview, the Output Inspector, and the Fullscreen Output window must
 * read tallies exclusively from `poll_answers.live_votes` (mirrored into
 * the `liveVoteMap`). When `true`, the operator has explicitly opted in
 * to seeing per-answer test counts so they can rehearse layouts off-air.
 *
 * This preference is intentionally global (not per-poll) and persisted to
 * `localStorage` so it survives reloads. Components subscribe via the
 * `useMockVoteDataPreference` hook below and a custom `storage`-style
 * event so toggling in the Inspector flips the preview/output canvas
 * immediately, with no full-page refresh required.
 */
import { useEffect, useState } from 'react';

export const USE_MOCK_VOTE_DATA_KEY = 'mako:operator:use-mock-vote-data';
const CHANGE_EVENT = 'mako:use-mock-vote-data:changed';

export function readUseMockVoteData(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(USE_MOCK_VOTE_DATA_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeUseMockVoteData(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USE_MOCK_VOTE_DATA_KEY, value ? '1' : '0');
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

/** React hook — returns the current value and re-renders whenever the
 *  preference changes (in this tab via the custom event, or in another
 *  tab via the native `storage` event). */
export function useMockVoteDataPreference(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => readUseMockVoteData());

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') setValue(detail);
      else setValue(readUseMockVoteData());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === USE_MOCK_VOTE_DATA_KEY) setValue(readUseMockVoteData());
    };
    window.addEventListener(CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setAndPersist = (next: boolean) => {
    setValue(next);
    writeUseMockVoteData(next);
  };

  return [value, setAndPersist];
}