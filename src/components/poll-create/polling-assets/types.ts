import { LucideIcon } from 'lucide-react';

export type AssetId =
  | 'question'
  | 'answers'
  | 'subheadline'
  | 'background'
  | 'qr'
  | 'logo'
  | 'voterTally';

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
  logoUrl?: string;
  logoPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  voterTallyFormat: 'number' | 'compact' | 'percent';
  voterTallyShow: boolean;
}

export const DEFAULT_ASSET_STATE: AssetState = {
  qrPosition: 'bottom-right',
  qrSize: 120,
  logoUrl: undefined,
  logoPosition: 'bottom-left',
  voterTallyFormat: 'number',
  voterTallyShow: true,
};
