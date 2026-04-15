export type LayerType = 'background' | 'question' | 'subheadline' | 'answerBars' | 'votesText' | 'qrCode' | 'logo';

export interface LayerTransform {
  x: number;       // 0-100 percentage
  y: number;       // 0-100 percentage
  scale: number;   // 0.1 - 3
  opacity: number;  // 0-1
}

export interface TextLayerProps {
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  maxWidth: number;     // percentage of frame
  lineHeight: number;
}

export interface BarLayerProps {
  barThickness: number;   // px
  spacing: number;        // px
  smoothing: boolean;
}

export interface QRLayerProps {
  size: number;           // px
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  padding: number;        // px from edge
}

export interface GraphicLayer {
  id: LayerType;
  label: string;
  visible: boolean;
  locked: boolean;
  transform: LayerTransform;
  textProps?: TextLayerProps;
  barProps?: BarLayerProps;
  qrProps?: QRLayerProps;
}

export const DEFAULT_LAYERS: GraphicLayer[] = [
  {
    id: 'logo',
    label: 'Logo',
    visible: true,
    locked: false,
    transform: { x: 5, y: 5, scale: 1, opacity: 0.8 },
  },
  {
    id: 'qrCode',
    label: 'QR Code',
    visible: true,
    locked: false,
    transform: { x: 85, y: 75, scale: 1, opacity: 1 },
    qrProps: { size: 120, anchor: 'bottom-right', padding: 24 },
  },
  {
    id: 'votesText',
    label: 'Votes Text',
    visible: true,
    locked: false,
    transform: { x: 50, y: 88, scale: 1, opacity: 0.7 },
    textProps: { fontSize: 12, fontWeight: 'normal', textAlign: 'center', maxWidth: 40, lineHeight: 1.2 },
  },
  {
    id: 'answerBars',
    label: 'Answer Bars',
    visible: true,
    locked: false,
    transform: { x: 50, y: 58, scale: 1, opacity: 1 },
    barProps: { barThickness: 28, spacing: 8, smoothing: true },
  },
  {
    id: 'subheadline',
    label: 'Subheadline',
    visible: true,
    locked: false,
    transform: { x: 50, y: 30, scale: 1, opacity: 0.7 },
    textProps: { fontSize: 14, fontWeight: 'normal', textAlign: 'center', maxWidth: 60, lineHeight: 1.3 },
  },
  {
    id: 'question',
    label: 'Question Text',
    visible: true,
    locked: false,
    transform: { x: 50, y: 22, scale: 1, opacity: 1 },
    textProps: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', maxWidth: 70, lineHeight: 1.3 },
  },
  {
    id: 'background',
    label: 'Background',
    visible: true,
    locked: true,
    transform: { x: 50, y: 50, scale: 1, opacity: 1 },
  },
];
