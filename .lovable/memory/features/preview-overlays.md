---
name: preview-overlays
description: Workspace-only broadcast preview overlays — safe areas, grid, rulers, draggable guides, snap, smart alignment. Never rendered on Program Output.
type: feature
---
**System:** `src/lib/preview-overlays.ts` (state + `usePreviewOverlays` hook + snap helpers), `src/components/broadcast/preview/PreviewOverlays.tsx` (renders safe/grid/rulers/guides/smart guides), `PreviewOverlayToolbar.tsx` (chip row), `PreviewWithOverlays.tsx` (standard mount).

**Where it's mounted:**
- Draft Workspace preview (`DraftPreviewMonitor`)
- Graphics Workspace preview (`GraphicsWorkspace`) — also passes `overlayState` to `LayerPreviewOverlay` for snap + smart guides during drag.
- Dashboard Program Preview (`Dashboard.tsx`)

**Where it's NOT mounted (critical):**
- `src/pages/ProgramOutput.tsx` — live broadcast output. Must remain air-clean. Never import `PreviewWithOverlays` / `PreviewOverlays` / `PreviewOverlayToolbar` here.

**Persistence:** per-user via `localStorage` key `mako-preview-overlays`. Synced across tabs via storage events.

**Snap:** Hold `Alt` while dragging to bypass. Threshold ~1.2% of canvas. Targets include canvas edges/center, Title/Action Safe bounds (when toggled), grid intersections, custom guides, and other layer rects' edges/centers.

**Future plug-ins:** asset locking, grouping, distribute h/v, copy/paste position, template-specific safe presets, multi-resolution canvas — all should hook into the same `PreviewOverlayState` + snap targets API.