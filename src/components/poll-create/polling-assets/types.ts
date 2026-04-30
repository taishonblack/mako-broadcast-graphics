import { LucideIcon } from 'lucide-react';

export type AssetId =
  | 'question'
  | 'answers'
  | 'answerType'
  | 'subheadline'
  | 'background'
  | 'qr'
  | 'logo'
  | 'voterTally'
  | 'image';

export interface AssetMeta {
  id: AssetId;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Seeded modules cannot be removed (Question + Answers). */
  required?: boolean;
}

export interface AssetState {
  qrPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  qrSize: number;
  qrVisible: boolean;
  qrUrlVisible: boolean;
  logoUrl?: string;
  logoPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  voterTallyFormat: 'number' | 'compact' | 'percent';
  voterTallyShow: boolean;
  wordmarkWeight: 'medium' | 'semibold' | 'bold';
  wordmarkTracking: number;
  wordmarkScale: number;
  wordmarkShowGuides: boolean;
  imageUrl?: string;
  imagePosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
}

export interface AssetColorConfig {
  textPrimary?: string;
  textSecondary?: string;
  barColors?: string[];
  /**
   * Per-viewport pill style overrides for the polling graphic family
   * (Answer Bars + Answer Type voter buttons). Operators tweak these on
   * the inspector; falsy values fall back to the shared
   * POLLING_GRAPHIC_DEFAULTS so existing polls keep their look.
   */
  barPaddingY?: number;
  barPaddingX?: number;
  barBorderRadius?: number;
  /**
   * Explicit pill / bar height (px). When set, the renderer applies it as
   * a fixed height on each Answer Bar so the operator can shrink thick
   * defaults (useful when many bars need to fit in the same slot). Leave
   * unset to size naturally from font + padding.
   */
  barHeight?: number;
  /**
   * When `barHeight` is set and the constrained box is shorter than the
   * pill's natural content height, auto-shrink the label / percent font so
   * the text always fits. Defaults to `true` (the previous behavior).
   * Set to `false` to keep the font fixed at the surface's design size —
   * useful when the operator wants the bar to clip rather than rescale,
   * or when matching a brand spec that requires fixed type.
   */
  barAutoScaleText?: boolean;
  /**
   * Horizontal text alignment inside each pill. Used by the Voter
   * Selection / Answer Bars renderer (AnswerChoices). Defaults to
   * the global PGD answer alignment when unset.
   */
  textAlign?: 'left' | 'center' | 'right';
}

export type TransformField =
  | 'x'
  | 'y'
  | 'scale'
  | 'opacity'
  | 'rotation'
  | 'cropLeft'
  | 'cropRight'
  | 'cropTop'
  | 'cropBottom';

export interface AssetTransformConfig {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  locks: Record<TransformField, boolean>;
}

export type AssetTransformMap = Record<AssetId, AssetTransformConfig>;
export type AssetColorMap = Record<AssetId, AssetColorConfig>;

/**
 * Output viewports the operator can target with independent transforms.
 * - `program`: broadcast composition (1920×1080) — this is the canonical set
 *   that scenes render from.
 * - `mobile`:  voter mobile viewport overrides
 * - `desktop`: voter desktop viewport overrides
 *
 * Scenes should always read from `set.program` unless they explicitly opt
 * into a different viewport. The inspector edits the active viewport's
 * slice so a slider change on the Mobile tab only affects Mobile.
 */
export type TransformViewport = 'program' | 'mobile' | 'desktop';

export type AssetTransformSet = Record<TransformViewport, AssetTransformMap>;

const DEFAULT_TRANSFORM_LOCKS: Record<TransformField, boolean> = {
  x: false,
  y: false,
  scale: false,
  opacity: false,
  rotation: false,
  cropLeft: false,
  cropRight: false,
  cropTop: false,
  cropBottom: false,
};

const createDefaultTransform = (): AssetTransformConfig => ({
  x: 0,
  y: 0,
  scale: 1,
  opacity: 1,
  rotation: 0,
  cropLeft: 0,
  cropRight: 0,
  cropTop: 0,
  cropBottom: 0,
  locks: { ...DEFAULT_TRANSFORM_LOCKS },
});

/**
 * Polling-graphic-family seeded defaults.
 *
 * CENTER-BASED COORDINATE SYSTEM.
 *
 * X = 0, Y = 0 means dead center of the active viewport for EVERY asset.
 * Positive Y = down, positive X = right. Defaults below are pure offsets
 * from center and are applied identically by every renderer (Program,
 * Mobile, Desktop) — no asset is allowed to use a different origin.
 *
 * The previous defaults baked an internal `translateY(...)` lift on top of
 * the transform, so X=0/Y=0 meant "asset's hard-coded slot" instead of
 * "canvas center". That made values non-portable between assets. Those
 * internal lifts have been removed; the same visual placement is now
 * encoded directly in the offsets below.
 *
 * Rules captured here (all values are offsets from CANVAS CENTER):
 *   • Question text:    program y=-164,  mobile y=-173,  desktop y=-139
 *   • Subheadline:      program y=-78,   mobile y=-83,   desktop y=-67
 *   • Answer Type:      program y=113,   mobile y=-47,   desktop y=113
 *   • Answer Bars:      mirror Answer Type on every viewport
 *   • QR / Logo:        x=0, y=0, scale=1 (dead center) — operators move
 *                       these explicitly per scene
 *   • Voter Tally:      program y=207   (lower third under the Q)
 */
const withTransform = (overrides: Partial<AssetTransformConfig>): AssetTransformConfig => ({
  ...createDefaultTransform(),
  ...overrides,
});

// Factory functions (NOT const objects) so each scene gets its own
// independent transform instance. Shared object refs would let one scene's
// edit leak into other scenes.
const QUESTION_DEFAULTS = {
  program: () => withTransform({ y: -164 }),
  mobile:  () => withTransform({ y: -173 }),
  desktop: () => withTransform({ y: -139 }),
};

const SUBHEADLINE_DEFAULTS = {
  program: () => withTransform({ y: -78 }),
  mobile:  () => withTransform({ y: -83 }),
  desktop: () => withTransform({ y: -67 }),
};

const ANSWER_TYPE_DEFAULTS = {
  program: () => withTransform({ y: 113 }),
  mobile: () => withTransform({ y: -47 }),
  desktop: () => withTransform({ y: 113 }),
};

// Answer Bars MIRROR Answer Type on every viewport — switching a scene from
// AnswerType to AnswerBars must feel like a clean reveal, not a reposition.
const ANSWER_BARS_DEFAULTS = {
  program: () => withTransform({ y: 113 }),
  mobile:  () => withTransform({ y: -47 }),
  desktop: () => withTransform({ y: 113 }),
};

// QR + Logo defaults: dead center on every viewport. Operators move them
// to a corner / slot intentionally per scene.
const QR_DEFAULTS = {
  program: () => createDefaultTransform(),
  mobile:  () => createDefaultTransform(),
  desktop: () => createDefaultTransform(),
};

// Voter tally sits under the question on Program (y=207 keeps the visual
// position from the prior internal translate). Mobile / Desktop default
// to center; the tally is rarely shown on voter views.
const VOTER_TALLY_DEFAULTS = {
  program: () => withTransform({ y: 207 }),
  mobile:  () => createDefaultTransform(),
  desktop: () => createDefaultTransform(),
};

/**
 * Background defaults: lock X / Y / Scale so the operator can't accidentally
 * nudge the backplate while editing other assets. They can unlock from the
 * inspector when intentional repositioning is needed.
 */
const createDefaultBackgroundTransform = (): AssetTransformConfig => ({
  ...createDefaultTransform(),
  locks: { ...DEFAULT_TRANSFORM_LOCKS, x: true, y: true, scale: true },
});

export const DEFAULT_ASSET_TRANSFORMS: AssetTransformMap = {
  question: QUESTION_DEFAULTS.program(),
  answers: ANSWER_BARS_DEFAULTS.program(),
  answerType: ANSWER_TYPE_DEFAULTS.program(),
  subheadline: SUBHEADLINE_DEFAULTS.program(),
  background: createDefaultBackgroundTransform(),
  qr: QR_DEFAULTS.program(),
  logo: createDefaultTransform(),
  voterTally: VOTER_TALLY_DEFAULTS.program(),
  image: createDefaultTransform(),
};

/** Build a fresh per-viewport transform set seeded with the same defaults. */
export const createDefaultTransformSet = (): AssetTransformSet => ({
  program: { question: QUESTION_DEFAULTS.program(), answers: ANSWER_BARS_DEFAULTS.program(), answerType: ANSWER_TYPE_DEFAULTS.program(), subheadline: SUBHEADLINE_DEFAULTS.program(), background: createDefaultBackgroundTransform(), qr: QR_DEFAULTS.program(), logo: createDefaultTransform(), voterTally: VOTER_TALLY_DEFAULTS.program(), image: createDefaultTransform() },
  mobile:  { question: QUESTION_DEFAULTS.mobile(),  answers: ANSWER_BARS_DEFAULTS.mobile(),  answerType: ANSWER_TYPE_DEFAULTS.mobile(),  subheadline: SUBHEADLINE_DEFAULTS.mobile(),  background: createDefaultBackgroundTransform(), qr: QR_DEFAULTS.mobile(),  logo: createDefaultTransform(), voterTally: VOTER_TALLY_DEFAULTS.mobile(),  image: createDefaultTransform() },
  desktop: { question: QUESTION_DEFAULTS.desktop(), answers: ANSWER_BARS_DEFAULTS.desktop(), answerType: ANSWER_TYPE_DEFAULTS.desktop(), subheadline: SUBHEADLINE_DEFAULTS.desktop(), background: createDefaultBackgroundTransform(), qr: QR_DEFAULTS.desktop(), logo: createDefaultTransform(), voterTally: VOTER_TALLY_DEFAULTS.desktop(), image: createDefaultTransform() },
});

export const DEFAULT_ASSET_TRANSFORM_SET: AssetTransformSet = createDefaultTransformSet();

/**
 * Standard (Scene-1-equivalent) transform for the given asset on the given
 * viewport. The "Apply Standard Defaults" inspector button writes this back
 * into the active slice so operators can recover the canonical pose without
 * resetting the whole scene.
 */
export function getStandardTransform(
  assetId: AssetId,
  viewport: TransformViewport,
): AssetTransformConfig {
  return createDefaultTransformSet()[viewport][assetId];
}

export const DEFAULT_ASSET_COLORS: AssetColorMap = {
  question: { textPrimary: 'hsl(0 0% 100%)' },
  answers: {
    textPrimary: 'hsl(0 0% 100%)',
    textSecondary: 'hsl(215 15% 65%)',
    // Mirror Answer Type's button tints so Answer 1/2 (and beyond) on the
    // bars graphic share the same color scheme as the voter buttons by
    // default. Operators can override per-bar via the inspector.
    barColors: ['hsla(220, 18%, 13%, 0.85)', 'hsla(220, 18%, 13%, 0.85)', 'hsla(220, 18%, 13%, 0.85)', 'hsla(220, 18%, 13%, 0.85)'],
  },
  answerType: {
    textPrimary: 'hsl(0 0% 100%)',
    textSecondary: 'hsl(215 15% 65%)',
    // Voter button background tints — independent of bar colors so the
    // operator can theme the on-device buttons separately from the
    // broadcast bars graphic.
    barColors: ['hsla(220, 18%, 13%, 0.85)', 'hsla(220, 18%, 13%, 0.85)', 'hsla(220, 18%, 13%, 0.85)', 'hsla(220, 18%, 13%, 0.85)'],
  },
  subheadline: { textSecondary: 'hsl(215 15% 65%)' },
  background: {},
  qr: { textSecondary: 'hsl(215 15% 65%)' },
  logo: { textSecondary: 'hsl(215 15% 65%)' },
  voterTally: { textPrimary: 'hsl(0 0% 100%)', textSecondary: 'hsl(215 15% 65%)' },
  image: {},
};

/**
 * Per-viewport color overrides. Mirrors AssetTransformSet so the operator can
 * tune answer-bar colors, text colors, etc. independently for the broadcast
 * Program composition vs the Mobile / Desktop voter views. Scenes / mirrored
 * Output always read from `set.program`; the in-app preview reads the slice
 * matching the active preview tab.
 */
export type AssetColorSet = Record<TransformViewport, AssetColorMap>;

const cloneDefaultColors = (): AssetColorMap => JSON.parse(JSON.stringify(DEFAULT_ASSET_COLORS));

export const createDefaultColorSet = (): AssetColorSet => ({
  program: cloneDefaultColors(),
  mobile: cloneDefaultColors(),
  desktop: cloneDefaultColors(),
});

export const DEFAULT_ASSET_COLOR_SET: AssetColorSet = createDefaultColorSet();

export const DEFAULT_ASSET_STATE: AssetState = {
  qrPosition: 'bottom-right',
  qrSize: 120,
  qrVisible: true,
  qrUrlVisible: false,
  logoUrl: undefined,
  logoPosition: 'bottom-left',
  voterTallyFormat: 'number',
  voterTallyShow: true,
  wordmarkWeight: 'semibold',
  wordmarkTracking: 0,
  wordmarkScale: 1,
  wordmarkShowGuides: false,
  imageUrl: undefined,
  imagePosition: 'center',
};
