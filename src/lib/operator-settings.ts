export const OPERATOR_AUTOSAVE_MINUTES_KEY = 'mako-operator-autosave-minutes';
export const DEFAULT_AUTOSAVE_MINUTES = 5;
export const AUTOSAVE_MINUTE_OPTIONS = [1, 5, 10, 15] as const;

export function loadAutosaveMinutes() {
  if (typeof window === 'undefined') return DEFAULT_AUTOSAVE_MINUTES;

  const rawValue = window.localStorage.getItem(OPERATOR_AUTOSAVE_MINUTES_KEY);
  const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

  return AUTOSAVE_MINUTE_OPTIONS.includes(parsedValue as (typeof AUTOSAVE_MINUTE_OPTIONS)[number])
    ? parsedValue
    : DEFAULT_AUTOSAVE_MINUTES;
}

export function saveAutosaveMinutes(minutes: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OPERATOR_AUTOSAVE_MINUTES_KEY, String(minutes));
}

/**
 * Quick Switch (a.k.a. confirmationless TAKE/CUT) — when ON, the operator
 * can fire TAKE / CUT during Go Live without the safety confirm() dialog,
 * BUT only when the per-session "Bus Safe" arm switch is engaged AND the
 * Program Output mirror is healthy. The mode is a saved preference; the
 * arm switch lives in session memory and auto-disarms on End Live so a
 * forgotten armed state can't carry into the next show.
 */
export const OPERATOR_CONFIRMATIONLESS_KEY = 'mako-operator-confirmationless-cuts';

export function loadConfirmationlessMode() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(OPERATOR_CONFIRMATIONLESS_KEY) === '1';
}

export function saveConfirmationlessMode(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OPERATOR_CONFIRMATIONLESS_KEY, enabled ? '1' : '0');
}