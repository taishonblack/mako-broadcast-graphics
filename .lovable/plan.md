

# MakoVote — Broadcast Live Polling Graphics System

## Vision
A dual-surface live audience graphics system for broadcast sports/TV — not a generic poll app. Three surfaces: Operator Control, Program Display (1080p on-air output), and Viewer Voting.

## Design Language
- **Dark broadcast control-room aesthetic** — charcoal, graphite, deep navy, steel gray, icy whites
- **Inter** for UI text, **JetBrains Mono** for technical labels/timers/counts
- **Orange accent** from the Mako brand identity (shark fin logo embedded as asset)
- Rounded-xl cards, clean borders, soft shadows, restrained motion
- Feels like Ross/Viz/EVS companion software

## Login Screen
- Split layout: illustration (shark fin + bars) on left, glass-panel login form on right
- "Mako Systems" top-left in JetBrains Mono, "MakoVote v0.1" bottom-left
- Subtle vertical divider, gradient overlay on illustration side
- Orange button + focus states, polished inputs

## Surface 1: Operator Control Display

### Screen 1 — Dashboard (`/dashboard`)
- **Top bar**: MakoVote logo, poll status chip, program display status chip, 1920×1080 chip, Open Output Window, Go Live, Close Poll
- **3-column grid**:
  - Left: Active Poll panel (question, answers with live counts/bars/percentages, votes/sec, timer)
  - Center: 16:9 broadcast preview frame with optional safe-area guide overlays
  - Right: Quick Actions (New/Load/Duplicate Poll, Open/Close Voting, Reset, Show/Hide QR, template/theme dropdowns)
- **Bottom**: Recent Polls table (name, date, template, votes, state, edit/reopen buttons)

### Screen 2 — Create/Edit Poll (`/polls/new`, `/polls/:id/edit`)
- 2-column layout with sticky right summary panel
- Left form: Poll Details, Answer Setup (2–4 draggable answer cards), Poll Logic (thresholds, auto-close, scheduling), Viewer Experience toggles
- Right panel: live mini summary, QR preview, selected template/theme
- Sticky action bar: Save Draft / Save Ready / Go Live

### Screen 3 — Graphics Editor (`/graphics/:id`)
- **Left rail**: Template selector cards (Horizontal Bar, Vertical Bar, Pie/Donut, Progress Bar, Puck Slider, Fullscreen Hero, Lower Third)
- **Center**: Large 16:9 broadcast preview with dark studio surround, optional safe-area overlays
- **Right rail**: Collapsible theme controls — Background (upload/fit/position/dim/blur/tint), Colors (12+ color pickers), Data Display, Animation, Output Controls

### Screen 4 — Output Control (integrated into dashboard/graphics)
- Open Output Window, fullscreen guidance, connection status, fallback content selection

## Surface 2: Viewer Voting (`/vote/:slug`)
- Mobile-first, extremely simple
- State 1: Large question + big tap-target answer buttons
- State 2: "Vote received" with optional live percentages
- State 3: "Voting has ended" with optional final results

## Surface 3: Program Display (`/output/:id`)
- Clean 1920×1080 fullscreen output — zero UI chrome
- Layered composition: background image → overlay/tint → question → chart → labels → QR → bug
- Graceful states: Live poll, Poll closed, Standby slate
- Designed for second monitor → HDMI → SDI workflow

## Chart/Template Components
- **Horizontal Bar** — fast reads, track + fill colors
- **Vertical Bar** — 3–4 answer polls, per-bar colors
- **Pie/Donut** — full-frame analysis, custom slice colors
- **Progress Bar** — simple fill visualization
- **Puck Slider** — hockey-native, sleek puck on ice track
- **Fullscreen Hero** — large question with chart
- **Lower Third** — compact studio-safe strip

## Reusable Components
PollStatusChip, OutputStatusChip, BroadcastPreviewFrame, SafeAreaOverlay, TemplateCard, ThemeControlPanel, PollResultsList, QRPreviewCard, OutputWindowLauncher, ViewerAnswerButton

## Demo Data (Mock/Local State for MVP)
- 3 sample polls: "Was that a penalty?", "Who wins tonight?", "What matters more tonight?"
- Realistic vote counts and percentages
- 3 theme presets: Broadcast Clean, Dark Ice, Silver/Team Neutral
- Smooth animated transitions on all chart data

## Data Model (Local state, Supabase-ready structure)
- Polls, PollOptions, Votes, Themes, Templates — all typed and structured for future realtime backend
- Theme fields include all 15+ color/background/animation properties

## Routing
- `/` → Login
- `/dashboard` → Operator dashboard
- `/polls/new` → Create poll
- `/polls/:id/edit` → Edit poll
- `/graphics/:id` → Graphics editor
- `/output/:id` → Clean program display
- `/vote/:slug` → Viewer voting

