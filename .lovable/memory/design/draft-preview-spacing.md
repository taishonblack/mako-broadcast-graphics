---
name: draft-preview-spacing
description: Spacing/padding for the Draft Workspace preview area — keeps the broadcast monitor lifted toward the header
type: design
---
**Rule:** In `src/components/poll-create/DraftPreviewMonitor.tsx`, the preview area wrapper must use:

`flex-1 flex flex-col items-center justify-start pt-2 px-4 pb-4 bg-background/30 min-h-0 overflow-auto gap-2`

**Why:** The user explicitly asked to lift the broadcast preview toward the "Broadcast Preview" label and template mode toggles. Do NOT revert to centered layout (`justify-center`, `p-4`, `gap-3`) or add extra top padding. The tightened layout is the canonical look.
