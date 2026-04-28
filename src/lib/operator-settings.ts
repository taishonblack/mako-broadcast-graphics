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

/**
 * Broadcast hotkey bindings — operator-remappable.
 *   takeKey / cutKey: a single character (a-z, 0-9) or 'Space' / 'Enter'.
 *   spaceTakesOnFocusedToggle: when ON, SPACE fires TAKE even if a button
 *     or switch currently has focus (default OFF — focused controls win).
 * Stored as JSON so we can grow this object without new keys later.
 */
export const OPERATOR_HOTKEYS_KEY = 'mako-operator-hotkeys';

export interface OperatorHotkeys {
  takeKey: string;            // 'Space' | 'Enter' | single char (lower-cased)
  cutKey: string;             // same shape as takeKey
  spaceTakesOnFocusedToggle: boolean;
}

export const DEFAULT_HOTKEYS: OperatorHotkeys = {
  takeKey: 't',
  cutKey: 'c',
  spaceTakesOnFocusedToggle: false,
};

function normalizeKey(raw: string): string {
  if (!raw) return '';
  const v = raw.trim();
  if (v.length === 0) return '';
  if (v.toLowerCase() === 'space') return 'Space';
  if (v.toLowerCase() === 'enter') return 'Enter';
  // Single printable char — lowercase for consistent matching.
  return v.length === 1 ? v.toLowerCase() : '';
}

export function loadHotkeys(): OperatorHotkeys {
  if (typeof window === 'undefined') return { ...DEFAULT_HOTKEYS };
  try {
    const raw = window.localStorage.getItem(OPERATOR_HOTKEYS_KEY);
    if (!raw) return { ...DEFAULT_HOTKEYS };
    const parsed = JSON.parse(raw) as Partial<OperatorHotkeys>;
    const takeKey = normalizeKey(parsed.takeKey ?? DEFAULT_HOTKEYS.takeKey) || DEFAULT_HOTKEYS.takeKey;
    const cutKey = normalizeKey(parsed.cutKey ?? DEFAULT_HOTKEYS.cutKey) || DEFAULT_HOTKEYS.cutKey;
    return {
      takeKey,
      cutKey: cutKey === takeKey ? DEFAULT_HOTKEYS.cutKey : cutKey,
      spaceTakesOnFocusedToggle: Boolean(parsed.spaceTakesOnFocusedToggle),
    };
  } catch {
    return { ...DEFAULT_HOTKEYS };
  }
}

export function saveHotkeys(hotkeys: OperatorHotkeys) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OPERATOR_HOTKEYS_KEY, JSON.stringify(hotkeys));
  // Notify any in-page listeners (SceneSelector subscribes to refresh
  // its key matchers without a remount).
  window.dispatchEvent(new CustomEvent('mako:hotkeys-changed', { detail: hotkeys }));
}

/** Human-readable label for a stored key value. */
export function formatHotkey(key: string): string {
  if (!key) return '—';
  if (key === 'Space') return 'SPACE';
  if (key === 'Enter') return 'ENTER';
  return key.toUpperCase();
}