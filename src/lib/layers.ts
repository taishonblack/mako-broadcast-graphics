export type LayerType = 'background' | 'question' | 'subheadline' | 'answerBars' | 'votesText' | 'qrCode' | 'logo';

export interface LayerZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LAYER_FRAME_ZONES: Record<LayerType, LayerZone> = {
  background: { x: 0, y: 0, w: 100, h: 100 },
  question: { x: 15, y: 12, w: 70, h: 16 },
  subheadline: { x: 20, y: 26, w: 60, h: 8 },
  answerBars: { x: 15, y: 38, w: 70, h: 40 },
  votesText: { x: 30, y: 82, w: 40, h: 8 },
  qrCode: { x: 78, y: 70, w: 18, h: 24 },
  logo: { x: 2, y: 2, w: 12, h: 8 },
};

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

export function cloneLayers(layers: GraphicLayer[] = DEFAULT_LAYERS): GraphicLayer[] {
  return layers.map((layer) => ({
    ...layer,
    transform: { ...layer.transform },
    textProps: layer.textProps ? { ...layer.textProps } : undefined,
    barProps: layer.barProps ? { ...layer.barProps } : undefined,
    qrProps: layer.qrProps ? { ...layer.qrProps } : undefined,
  }));
}

export const DEFAULT_LAYERS: GraphicLayer[] = [
  {
    id: 'logo',
    label: 'Logo',
    visible: true,
    locked: false,
    transform: { x: LAYER_FRAME_ZONES.logo.x, y: LAYER_FRAME_ZONES.logo.y, scale: 1, opacity: 0.8 },
  },
  {
    id: 'qrCode',
    label: 'QR Code',
    visible: true,
    locked: false,
    transform: { x: LAYER_FRAME_ZONES.qrCode.x, y: LAYER_FRAME_ZONES.qrCode.y, scale: 1, opacity: 1 },
    qrProps: { size: 120, anchor: 'bottom-right', padding: 24 },
  },
  {
    id: 'votesText',
    label: 'Votes Text',
    visible: true,
    locked: false,
    transform: { x: LAYER_FRAME_ZONES.votesText.x, y: LAYER_FRAME_ZONES.votesText.y, scale: 1, opacity: 0.7 },
    textProps: { fontSize: 12, fontWeight: 'normal', textAlign: 'center', maxWidth: 40, lineHeight: 1.2 },
  },
  {
    id: 'answerBars',
    label: 'Answer Bars',
    visible: true,
    locked: false,
    transform: { x: LAYER_FRAME_ZONES.answerBars.x, y: LAYER_FRAME_ZONES.answerBars.y, scale: 1, opacity: 1 },
    barProps: { barThickness: 28, spacing: 8, smoothing: true },
  },
  {
    id: 'subheadline',
    label: 'Subheadline',
    visible: true,
    locked: false,
    transform: { x: LAYER_FRAME_ZONES.subheadline.x, y: LAYER_FRAME_ZONES.subheadline.y, scale: 1, opacity: 0.7 },
    textProps: { fontSize: 14, fontWeight: 'normal', textAlign: 'center', maxWidth: 60, lineHeight: 1.3 },
  },
  {
    id: 'question',
    label: 'Question Text',
    visible: true,
    locked: false,
    transform: { x: LAYER_FRAME_ZONES.question.x, y: LAYER_FRAME_ZONES.question.y, scale: 1, opacity: 1 },
    textProps: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', maxWidth: 70, lineHeight: 1.3 },
  },
  {
    id: 'background',
    label: 'Background',
    visible: true,
    locked: true,
    transform: { x: LAYER_FRAME_ZONES.background.x, y: LAYER_FRAME_ZONES.background.y, scale: 1, opacity: 1 },
  },
];
