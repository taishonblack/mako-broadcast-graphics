export type SceneType = 'fullscreen' | 'lowerThird' | 'qr' | 'results';

export interface SceneConfig {
  id: SceneType;
  label: string;
  shortLabel: string;
}

export const scenes: SceneConfig[] = [
  { id: 'fullscreen', label: 'Fullscreen Poll', shortLabel: 'Fullscreen' },
  { id: 'lowerThird', label: 'Lower Third', shortLabel: 'Lower Third' },
  { id: 'qr', label: 'QR Screen', shortLabel: 'QR' },
  { id: 'results', label: 'Results Reveal', shortLabel: 'Results' },
];
