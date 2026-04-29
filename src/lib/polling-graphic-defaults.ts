/**
 * Shared layout / typography / color tokens for the **polling graphic family**.
 *
 * The polling graphic family is the set of assets that present the question +
 * answers as a single coherent on-air composition:
 *   - `answers`     → Answer Bars (results graphic, percent + bar)
 *   - `answerType`  → Answer Type (voter-style choice buttons)
 *
 * They are independent assets (operators add them to scenes independently),
 * but they MUST share a default footprint so that switching scenes between
 * "Answer Type on Scene 1" and "Answer Bars on Scene 2" feels like a clean
 * reveal of the SAME graphic family — not a repositioned new graphic.
 *
 * Operators can still customize each per scene afterward via the inspector;
 * these are only the *defaults* used at first render.
 *
 * IMPORTANT: do not couple this to scene visibility logic. Scenes still own
 * `visibleAssetIds` independently (poll_scene_assets). These tokens only
 * govern visual defaults applied inside the renderer.
 */

export const POLLING_GRAPHIC_DEFAULTS = {
  /** Outer container max width (px on the 1920×1080 program canvas). */
  pollGraphicWidth: 1600,
  /** Outer container max width on the voter (mobile/desktop) viewport. */
  pollGraphicWidthVoter: 420,
  /** Vertical gap between adjacent answers (px @ program scale). */
  answerSpacing: 32,
  /** Vertical gap between adjacent answers on voter viewport (px). */
  answerSpacingVoter: 12,
  /** Question font size on the broadcast composition (px). */
  questionFontSize: 88,
  /** Question max-width as a percentage of the action-safe stage. */
  questionMaxWidthPct: 84,
  /** Answer label font size on the broadcast composition (px). */
  answerFontSize: 44,
  /** Answer label font size on voter buttons (mobile/desktop, px). */
  answerFontSizeVoter: 20,
  /** Pill border radius (px) — same value used by both bars and buttons. */
  answerBorderRadius: 24,
  /** Bar height for Answer Bars (px). */
  answerBarHeight: 32,
  /** Inner padding for Answer Type buttons (px @ program scale). */
  answerButtonPaddingY: 36,
  /** Default color pair (used when the operator has not set per-asset
   *  bar colors). Same primary / accent on both assets so they read as
   *  one family. */
  answerColorA: 'hsl(24 95% 53%)',  // brand orange
  answerColorB: 'hsl(210 70% 50%)', // complementary blue
  answerColorRest: ['hsl(142 71% 45%)', 'hsl(280 65% 55%)'],
  /** Idle / unselected button background for Answer Type. */
  answerButtonIdleBg: 'hsla(220, 18%, 13%, 0.85)',
} as const;

/** Convenience accessor for the default ordered color palette shared by
 *  `answers` and `answerType` so per-option chips/bars match index-by-index. */
export function getDefaultAnswerColors(count: number): string[] {
  const base = [
    POLLING_GRAPHIC_DEFAULTS.answerColorA,
    POLLING_GRAPHIC_DEFAULTS.answerColorB,
    ...POLLING_GRAPHIC_DEFAULTS.answerColorRest,
  ];
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(base[i % base.length]);
  return out;
}