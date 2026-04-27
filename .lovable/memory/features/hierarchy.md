---
name: Project hierarchy
description: Canonical Project > Block > Folder/Poll > Scene > Assets hierarchy for MakoVote
type: feature
---
Canonical structure for MakoVote content:

Project
  └─ Block (A / B / C / D / E)
      └─ Folder / Poll
          └─ Scenes
              ├─ Scene 1: Full Screen   → Text, QR, Answer Type, Background
              ├─ Scene 2: Live Results  → Text, QR, Answer Bars, Tally, Background
              └─ Scene 3: Final         → Text, Answer Bars, Tally, Background

Rules:
- A Poll owns ALL its assets. Scenes are visibility filters over those assets — never duplicate poll data per scene.
- Blocks (A–E) group polls within a Project; they are NOT scenes.
- Scene switching must not affect voting state.
- Hardcoded broadcast scene presets live in src/lib/scene-presets.ts; extend that file when scene definitions change.
