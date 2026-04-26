# Plan — Slate flow, viewer states, and folder linking
_Drafted 2026-04-26 — awaiting approval before any code lands._

## Bug being addressed
On Go Live the viewer phone (QR scan) stays on the MakoVote splash instead of switching to the live multiple-choice question. Root cause is suspected to be the viewer page reading from `project_live_state.voting_state` but the Go Live action not transitioning that row to `'open'` (or not including the new active poll's `viewer_slug`). Will be confirmed in Milestone 1.

---

## Milestone 1 — Fix Go Live → viewer transition (bug only)
**Goal:** Pressing Go Live flips the scanned phone from MakoVote slate → the live question.

- Trace operator Go Live path: confirm it sets `project_live_state.voting_state = 'open'` and `active_poll_id`.
- Confirm `ViewerVote.tsx` subscribes to `project_live_state` realtime and re-routes when state flips.
- Verify RLS — `poll_is_publicly_live(active_poll_id)` returns true and `poll_answers` are readable to `anon` once live.
- Add a viewer-side log trail (dev only) to confirm transition.
- **No new features in this milestone.**

## Milestone 2 — Viewer state machine (3 screens)
Per-poll content already lives on `polls` (slate_text, slate_subline_text, slate_image, post_vote_delay_ms, show_thank_you, show_final_results). No schema change.

- **Pre-vote (slate):** voting_state = `not_open` → render `slate_image` + `slate_text` + `slate_subline_text`. Falls back to MakoVote brand if blank.
- **Voting:** voting_state = `open` → render question + answer buttons.
- **Post-vote (thank you):** local "I voted" flag → render "Thank you for voting" (operator-overridable copy in a later pass; v1 hardcoded string).
- **Closed:** voting_state = `closed` + `show_final_results` → final tally; otherwise show thank you.

## Milestone 3 — Slate editor in operator UI
- New "Slate" section in poll Build mode: text + subline inputs (already wired to `polls.slate_text`/`slate_subline_text`), image picker (gallery + upload, reusing `MediaPicker` and the `images` bucket).
- Save updates `polls.slate_image` (already in schema).
- Live-preview slate inside Draft Preview Monitor.

## Milestone 4 — Program Preview: Mobile/Desktop reflects slate
Today the operator's Mobile/Desktop preview mirrors the build canvas. New rule: when previewing on `/output` Program Preview with Mobile or Desktop selected, **and** voting is `not_open`, render the viewer-side slate (not the build canvas). Test Viewer View toggle should also display the slate. This is the only place build-mobile/desktop and viewer-mobile/desktop intentionally diverge.

## Milestone 5 — Folder linking (two strategies)
**A. Clone-and-convert (auto-link):**
- "Duplicate folder as results" action on a folder with answer-type assets.
- Creates a sibling folder with bar/results assets, copies answer set, sets `linked_folder_id` on both rows.
- UI shows a chain-link badge on coupled folders.

**B. Explicit link picker:**
- In folder settings, "Link to another folder" → picker scoped to the **currently open project** only.
- Stores `linked_folder_id` (single nullable FK on the folder row).
- When two folders are linked, they share the same vote tally — voting in either is aggregated and rendered in either.

**Schema change required:** add `linked_folder_id uuid` (nullable, self-FK) to whichever table holds folders. Folders are not a Supabase table today (queues live in mock data); will need to introduce a `poll_folders` table OR extend `polls` with grouping metadata. Will scope this in Milestone 5 kickoff.

## Milestone 6 — Hardening
- Realtime topic check: anonymous users on `viewer-poll-{slug}` only receive their poll.
- Run security audit page; fix any new findings introduced by Milestones 2–5.

---

## Order of operations
1. M1 (bug) — small, ship first.
2. M2 + M3 + M4 together — they share the slate rendering code.
3. M5 — separate session, larger schema work.
4. M6 — close out.
