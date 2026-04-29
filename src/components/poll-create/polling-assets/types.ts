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
 * Operator-validated baseline transforms so that — without touching any
 * sliders — the question, answer type buttons, answer bars, and QR all land
 * in the visually agreed-upon position for each surface (Program / Mobile /
 * Desktop). Operators can still customize each scene afterward.
 *
 * Rules captured here:
 *   • Question text:  program y=182, mobile y=40, desktop y=117
 *   • Answer Type:    program y=113 (matches scene 1), mobile y=-47, desktop y=113
 *   • Answer Bars:    Mobile/Desktop mirror Answer Type so switching scenes
 *                     between AnswerType ↔ AnswerBars feels like the same
 *                     graphic family.
 *   • QR code:        program x=-796, y=-314, scale=1.63
 */
const withTransform = (overrides: Partial<AssetTransformConfig>): AssetTransformConfig => ({
  ...createDefaultTransform(),
  ...overrides,
});

const QUESTION_DEFAULTS = {
  program: withTransform({ y: 182 }),
  mobile: withTransform({ y: 40 }),
  desktop: withTransform({ y: 117 }),
};

const ANSWER_TYPE_DEFAULTS = {
  program: withTransform({ y: 113 }),
  mobile: withTransform({ y: -47 }),
  desktop: withTransform({ y: 113 }),
};

// Answer Bars: Mobile + Desktop mirror Answer Type so X/Y/Scale match.
// Program keeps the neutral default (operators position bars per show).
const ANSWER_BARS_DEFAULTS = {
  program: createDefaultTransform(),
  mobile: withTransform({ y: ANSWER_TYPE_DEFAULTS.mobile.y }),
  desktop: withTransform({ y: ANSWER_TYPE_DEFAULTS.desktop.y }),
};

const QR_DEFAULTS = {
  program: withTransform({ x: -796, y: -314, scale: 1.63 }),
  mobile: createDefaultTransform(),
  desktop: createDefaultTransform(),
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
  question: QUESTION_DEFAULTS.program,
  answers: ANSWER_BARS_DEFAULTS.program,
  answerType: ANSWER_TYPE_DEFAULTS.program,
  subheadline: createDefaultTransform(),
  background: createDefaultBackgroundTransform(),
  qr: QR_DEFAULTS.program,
  logo: createDefaultTransform(),
  voterTally: createDefaultTransform(),
  image: createDefaultTransform(),
};

/** Build a fresh per-viewport transform set seeded with the same defaults. */
export const createDefaultTransformSet = (): AssetTransformSet => ({
  program: { question: QUESTION_DEFAULTS.program, answers: ANSWER_BARS_DEFAULTS.program, answerType: ANSWER_TYPE_DEFAULTS.program, subheadline: createDefaultTransform(), background: createDefaultBackgroundTransform(), qr: QR_DEFAULTS.program, logo: createDefaultTransform(), voterTally: createDefaultTransform(), image: createDefaultTransform() },
  mobile:  { question: QUESTION_DEFAULTS.mobile,  answers: ANSWER_BARS_DEFAULTS.mobile,  answerType: ANSWER_TYPE_DEFAULTS.mobile,  subheadline: createDefaultTransform(), background: createDefaultBackgroundTransform(), qr: QR_DEFAULTS.mobile,  logo: createDefaultTransform(), voterTally: createDefaultTransform(), image: createDefaultTransform() },
  desktop: { question: QUESTION_DEFAULTS.desktop, answers: ANSWER_BARS_DEFAULTS.desktop, answerType: ANSWER_TYPE_DEFAULTS.desktop, subheadline: createDefaultTransform(), background: createDefaultBackgroundTransform(), qr: QR_DEFAULTS.desktop, logo: createDefaultTransform(), voterTally: createDefaultTransform(), image: createDefaultTransform() },
});

export const DEFAULT_ASSET_TRANSFORM_SET: AssetTransformSet = createDefaultTransformSet();

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
