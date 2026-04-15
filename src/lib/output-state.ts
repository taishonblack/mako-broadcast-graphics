import { DEFAULT_LAYERS, GraphicLayer, cloneLayers } from './layers';
import { SceneType } from './scenes';
import { Poll } from './types';

export const OUTPUT_STATE_STORAGE_KEY = 'mako-output-state';

export interface OutputStatePayload {
  poll: Poll;
  scene: SceneType;
  layers: GraphicLayer[];
}

export function broadcastOutputState(payload: OutputStatePayload) {
  if (typeof window === 'undefined') return;

  const normalizedPayload: OutputStatePayload = {
    ...payload,
    layers: cloneLayers(payload.layers),
  };

  const serialized = JSON.stringify(normalizedPayload);
  localStorage.setItem(OUTPUT_STATE_STORAGE_KEY, serialized);
  window.dispatchEvent(new StorageEvent('storage', { key: OUTPUT_STATE_STORAGE_KEY, newValue: serialized }));
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
    };
  } catch {
    return null;
  }
}