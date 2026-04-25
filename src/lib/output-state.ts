import { DEFAULT_LAYERS, GraphicLayer, cloneLayers } from './layers';
import { SceneType } from './scenes';
import { Poll, QRPosition } from './types';
import { AssetColorMap, AssetState, DEFAULT_ASSET_COLORS, DEFAULT_ASSET_STATE, AssetTransformMap, DEFAULT_ASSET_TRANSFORMS } from '@/components/poll-create/polling-assets/types';

export const OUTPUT_STATE_STORAGE_KEY = 'mako-output-state';
export const OUTPUT_STATE_CHANNEL = 'mako-output-channel';

export interface OutputAssets {
  qrSize: number;
  qrPosition: QRPosition;
  qrVisible?: boolean;
  qrUrlVisible?: boolean;
  showBranding: boolean;
  brandingPosition: QRPosition;
  enabledAssetIds?: Array<'question' | 'answers' | 'subheadline' | 'background' | 'qr' | 'logo' | 'voterTally' | 'image'>;
  transforms?: AssetTransformMap;
  assetColors?: AssetColorMap;
  wordmarkWeight?: AssetState['wordmarkWeight'];
  wordmarkTracking?: number;
  wordmarkScale?: number;
  wordmarkShowGuides?: boolean;
  /** Lower-third banner height in % of frame */
  lowerThirdHeight?: number;
}

export interface OutputStatePayload {
  poll: Poll;
  scene: SceneType;
  layers: GraphicLayer[];
  assets?: OutputAssets;
}

export function broadcastOutputState(payload: OutputStatePayload) {
  if (typeof window === 'undefined') return;

  const normalizedPayload: OutputStatePayload = {
    ...payload,
    layers: cloneLayers(payload.layers),
    assets: payload.assets ? { ...payload.assets } : undefined,
  };

  const serialized = JSON.stringify(normalizedPayload);
  localStorage.setItem(OUTPUT_STATE_STORAGE_KEY, serialized);
  window.dispatchEvent(new StorageEvent('storage', { key: OUTPUT_STATE_STORAGE_KEY, newValue: serialized }));
  // Realtime mirror: BroadcastChannel reaches other tabs/windows of the
  // same origin reliably (StorageEvent doesn't fire in the writer's tab,
  // and some browsers throttle storage events). The Output page listens
  // on both transports.
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(OUTPUT_STATE_CHANNEL);
      ch.postMessage(normalizedPayload);
      ch.close();
    }
  } catch { /* unsupported — storage path still works */ }
}

export function readOutputState(): OutputStatePayload | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(OUTPUT_STATE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OutputStatePayload>;

    if (!parsed.poll || !parsed.scene) return null;

    return {
      poll: parsed.poll,
      scene: parsed.scene,
      layers: Array.isArray(parsed.layers)
        ? cloneLayers(parsed.layers as GraphicLayer[])
        : cloneLayers(DEFAULT_LAYERS),
      assets: parsed.assets
        ? {
            ...parsed.assets,
              qrVisible: parsed.assets.qrVisible ?? DEFAULT_ASSET_STATE.qrVisible,
              qrUrlVisible: parsed.assets.qrUrlVisible ?? DEFAULT_ASSET_STATE.qrUrlVisible,
              enabledAssetIds: parsed.assets.enabledAssetIds ?? ['question', 'answers', 'logo'],
              transforms: parsed.assets.transforms ?? DEFAULT_ASSET_TRANSFORMS,
               assetColors: parsed.assets.assetColors ?? DEFAULT_ASSET_COLORS,
            wordmarkWeight: parsed.assets.wordmarkWeight ?? DEFAULT_ASSET_STATE.wordmarkWeight,
            wordmarkTracking: parsed.assets.wordmarkTracking ?? DEFAULT_ASSET_STATE.wordmarkTracking,
            wordmarkScale: parsed.assets.wordmarkScale ?? DEFAULT_ASSET_STATE.wordmarkScale,
            wordmarkShowGuides: parsed.assets.wordmarkShowGuides ?? DEFAULT_ASSET_STATE.wordmarkShowGuides,
          }
        : undefined,
    };
  } catch {
    return null;
  }
}
