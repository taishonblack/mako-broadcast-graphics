import { useCallback, useEffect, useState } from 'react';

/**
 * Per-user broadcast preview overlay state.
 *
 * These overlays (safe areas, grid, rulers, draggable guides, snap)
 * are workspace-only operator tools. They MUST NEVER be rendered on
 * the live program output (`/output/:id`) — that surface is air-clean.
 */

export interface PreviewGuide {
  id: string;
  axis: 'x' | 'y';
  /** Position in % of the 16:9 canvas (0–100). */
  position: number;
}

export interface PreviewOverlayState {
  titleSafe: boolean;
  actionSafe: boolean;
  grid: boolean;
  centerCrosshair: boolean;
  rulers: boolean;
  guides: boolean;
  snap: boolean;
  /** 0–100 — visual opacity of overlays (does not affect output). */
  overlayOpacity: number;
  /** Number of grid columns on the long axis. Rows scale 16:9. */
  gridDensity: number;
  customGuides: PreviewGuide[];
}

export const DEFAULT_OVERLAY_STATE: PreviewOverlayState = {
  titleSafe: false,
  actionSafe: false,
  grid: false,
  centerCrosshair: false,
  rulers: false,
  guides: true,
  snap: true,
  overlayOpacity: 60,
  gridDensity: 16,
  customGuides: [],
};

const STORAGE_KEY = 'mako-preview-overlays';

function loadState(): PreviewOverlayState {
  if (typeof window === 'undefined') return DEFAULT_OVERLAY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OVERLAY_STATE;
    const parsed = JSON.parse(raw) as Partial<PreviewOverlayState>;
    return {
      ...DEFAULT_OVERLAY_STATE,
      ...parsed,
      customGuides: Array.isArray(parsed.customGuides) ? parsed.customGuides : [],
    };
  } catch {
    return DEFAULT_OVERLAY_STATE;
  }
}

/**
 * React hook that mirrors overlay state to localStorage and across tabs.
 * Same shape used by Draft Workspace, Graphics Editor and Dashboard previews
 * so toggle changes feel consistent across the operator surface.
 */
export function usePreviewOverlays() {
  const [state, setState] = useState<PreviewOverlayState>(loadState);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Live sync across other operator tabs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setState(JSON.parse(e.newValue) as PreviewOverlayState); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const update = useCallback(<K extends keyof PreviewOverlayState>(key: K, value: PreviewOverlayState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggle = useCallback((key: keyof PreviewOverlayState) => {
    setState(prev => {
      const current = prev[key];
      if (typeof current !== 'boolean') return prev;
      return { ...prev, [key]: !current } as PreviewOverlayState;
    });
  }, []);

  const addGuide = useCallback((axis: 'x' | 'y', position: number) => {
    setState(prev => ({
      ...prev,
      customGuides: [...prev.customGuides, { id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, axis, position }],
    }));
  }, []);

  const moveGuide = useCallback((id: string, position: number) => {
    setState(prev => ({
      ...prev,
      customGuides: prev.customGuides.map(g => g.id === id ? { ...g, position } : g),
    }));
  }, []);

  const removeGuide = useCallback((id: string) => {
    setState(prev => ({ ...prev, customGuides: prev.customGuides.filter(g => g.id !== id) }));
  }, []);

  const resetGuides = useCallback(() => {
    setState(prev => ({ ...prev, customGuides: [] }));
  }, []);

  return { state, update, toggle, addGuide, moveGuide, removeGuide, resetGuides };
}

/** Compute the standard safe-area insets in % (SMPTE-style). */
export const TITLE_SAFE_INSET = 10; // 10% inset
export const ACTION_SAFE_INSET = 5; // 5% inset

/**
 * Snap target candidates expressed in % of the canvas, per axis.
 * Used by the layer drag system to attract the dragged asset.
 */
export interface SnapTargets {
  xLines: number[];
  yLines: number[];
}

/** Build canonical snap targets from current overlay state and other layer rects. */
export function buildSnapTargets(
  state: PreviewOverlayState,
  otherLayerRects: { x: number; y: number; w: number; h: number }[],
): SnapTargets {
  const xs = new Set<number>();
  const ys = new Set<number>();

  // Edges + center of canvas
  xs.add(0); xs.add(50); xs.add(100);
  ys.add(0); ys.add(50); ys.add(100);

  if (state.actionSafe) {
    xs.add(ACTION_SAFE_INSET); xs.add(100 - ACTION_SAFE_INSET);
    ys.add(ACTION_SAFE_INSET); ys.add(100 - ACTION_SAFE_INSET);
  }
  if (state.titleSafe) {
    xs.add(TITLE_SAFE_INSET); xs.add(100 - TITLE_SAFE_INSET);
    ys.add(TITLE_SAFE_INSET); ys.add(100 - TITLE_SAFE_INSET);
  }
  if (state.grid) {
    const cols = Math.max(2, state.gridDensity);
    for (let i = 0; i <= cols; i++) xs.add((100 / cols) * i);
    const rows = Math.max(2, Math.round((cols * 9) / 16));
    for (let i = 0; i <= rows; i++) ys.add((100 / rows) * i);
  }
  if (state.guides) {
    for (const g of state.customGuides) {
      if (g.axis === 'x') xs.add(g.position); else ys.add(g.position);
    }
  }
  // Edges/centers of other rendered layers
  for (const r of otherLayerRects) {
    xs.add(r.x); xs.add(r.x + r.w / 2); xs.add(r.x + r.w);
    ys.add(r.y); ys.add(r.y + r.h / 2); ys.add(r.y + r.h);
  }

  return {
    xLines: Array.from(xs).sort((a, b) => a - b),
    yLines: Array.from(ys).sort((a, b) => a - b),
  };
}

/**
 * Snap a candidate position to the nearest target within `threshold` (in %).
 * Returns the snapped value and which target line was hit (for smart guide rendering).
 */
export function snapValue(value: number, targets: number[], threshold: number) {
  let best: { value: number; target: number; delta: number } | null = null;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d <= threshold && (!best || d < best.delta)) {
      best = { value: t, target: t, delta: d };
    }
  }
  return best;
}