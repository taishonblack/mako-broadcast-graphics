import { useEffect, useState } from 'react';

/**
 * Operator's personal saved color palette. Persisted in localStorage and
 * shared between the Build inspector ("Use Swatch" dropdown) and the
 * Operator Settings → Swatch Manager. Backward-compatible with the v1
 * string-only format used by earlier builds.
 */

export interface ColorSwatch {
  id: string;
  name: string;
  value: string; // any CSS color string the operator typed (hex, hsl(...), rgb(...))
}

const LEGACY_KEY = 'mako-color-swatches-v1';
const STORAGE_KEY = 'mako-color-swatches-v2';
const SWATCHES_EVENT = 'mako:swatches-changed';
export const MAX_SWATCHES = 48;

function makeId() {
  return `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readRaw(): ColorSwatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((s) => (s && typeof s === 'object' && typeof s.value === 'string'
            ? {
                id: typeof s.id === 'string' ? s.id : makeId(),
                name: typeof s.name === 'string' ? s.name : '',
                value: s.value,
              }
            : null))
          .filter((s): s is ColorSwatch => Boolean(s));
      }
    }
    // Migrate from v1 (string[]).
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy)) {
        const migrated: ColorSwatch[] = parsedLegacy
          .filter((v): v is string => typeof v === 'string')
          .map((value, i) => ({ id: makeId(), name: `Swatch ${i + 1}`, value }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch { /* ignore */ }
  return [];
}

function writeRaw(next: ColorSwatch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
  // Notify listeners in this tab (storage event only fires in OTHER tabs).
  try { window.dispatchEvent(new CustomEvent(SWATCHES_EVENT)); } catch { /* ignore */ }
}

export function loadSwatches(): ColorSwatch[] {
  return readRaw();
}

export function saveSwatches(next: ColorSwatch[]) {
  writeRaw(next.slice(0, MAX_SWATCHES));
}

export function useColorSwatches() {
  const [swatches, setSwatches] = useState<ColorSwatch[]>(() => readRaw());

  useEffect(() => {
    const refresh = () => setSwatches(readRaw());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === LEGACY_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SWATCHES_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SWATCHES_EVENT, refresh as EventListener);
    };
  }, []);

  const addSwatch = (value: string, name?: string) => {
    if (!value) return;
    const current = readRaw();
    // De-dupe by value (case-insensitive). Move existing match to the front
    // and keep its name unless the caller passed a fresh one.
    const existing = current.find((s) => s.value.toLowerCase() === value.toLowerCase());
    let next: ColorSwatch[];
    if (existing) {
      next = [
        { ...existing, name: name ?? existing.name },
        ...current.filter((s) => s.id !== existing.id),
      ];
    } else {
      next = [
        { id: makeId(), name: name ?? `Swatch ${current.length + 1}`, value },
        ...current,
      ].slice(0, MAX_SWATCHES);
    }
    writeRaw(next);
    setSwatches(next);
  };

  const renameSwatch = (id: string, name: string) => {
    const next = readRaw().map((s) => (s.id === id ? { ...s, name } : s));
    writeRaw(next);
    setSwatches(next);
  };

  const updateSwatchValue = (id: string, value: string) => {
    const next = readRaw().map((s) => (s.id === id ? { ...s, value } : s));
    writeRaw(next);
    setSwatches(next);
  };

  const removeSwatch = (id: string) => {
    const next = readRaw().filter((s) => s.id !== id);
    writeRaw(next);
    setSwatches(next);
  };

  const clearSwatches = () => {
    writeRaw([]);
    setSwatches([]);
  };

  return { swatches, addSwatch, renameSwatch, updateSwatchValue, removeSwatch, clearSwatches };
}