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