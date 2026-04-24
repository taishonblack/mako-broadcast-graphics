import { LucideIcon } from 'lucide-react';

export type AssetId =
  | 'question'
  | 'answers'
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

export const DEFAULT_ASSET_TRANSFORMS: AssetTransformMap = {
  question: createDefaultTransform(),
  answers: createDefaultTransform(),
  subheadline: createDefaultTransform(),
  background: createDefaultTransform(),
  qr: createDefaultTransform(),
  logo: createDefaultTransform(),
  voterTally: createDefaultTransform(),
  image: createDefaultTransform(),
};

export const DEFAULT_ASSET_COLORS: AssetColorMap = {
  question: { textPrimary: 'hsl(0 0% 100%)' },
  answers: {
    textPrimary: 'hsl(0 0% 100%)',
    textSecondary: 'hsl(215 15% 65%)',
    barColors: ['hsl(24 95% 53%)', 'hsl(210 70% 50%)', 'hsl(142 71% 45%)', 'hsl(280 65% 55%)'],
  },
  subheadline: { textSecondary: 'hsl(215 15% 65%)' },
  background: {},
  qr: { textSecondary: 'hsl(215 15% 65%)' },
  logo: { textSecondary: 'hsl(215 15% 65%)' },
  voterTally: { textPrimary: 'hsl(0 0% 100%)', textSecondary: 'hsl(215 15% 65%)' },
  image: {},
};

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
