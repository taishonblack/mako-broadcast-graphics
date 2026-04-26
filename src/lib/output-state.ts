import { DEFAULT_LAYERS, GraphicLayer, cloneLayers } from './layers';
import { SceneType } from './scenes';
import { Poll, QRPosition } from './types';
import { AssetColorMap, AssetState, DEFAULT_ASSET_COLORS, DEFAULT_ASSET_STATE, AssetTransformMap, DEFAULT_ASSET_TRANSFORMS } from '@/components/poll-create/polling-assets/types';

export const OUTPUT_STATE_STORAGE_KEY = 'mako-output-state';
export const OUTPUT_STATE_CHANNEL = 'mako-output-channel';
/** Snapshot pushed to Output the moment the operator hits Go Live. While the
 *  lock is engaged Output ignores all subsequent OutputStatePayload messages
 *  and renders this frozen payload instead — letting the operator freely
 *  edit / navigate the workspace without leaking changes to broadcast. */
export const OUTPUT_LOCK_STORAGE_KEY = 'mako-output-lock';
export const OUTPUT_LOCK_CHANNEL = 'mako-output-lock-channel';
/** Heartbeat channel — Program Preview pings this on a 1s interval so the
 *  Output page can render a "Live"/"Stalled" mirror status indicator even
 *  when no state change has occurred recently. */
export const OUTPUT_HEARTBEAT_CHANNEL = 'mako-output-heartbeat';
export const OUTPUT_HEARTBEAT_STORAGE_KEY = 'mako-output-heartbeat-ts';

/** Send a lightweight presence ping from the operator to any open Output
 *  windows. Safe to call frequently (cheap string write + postMessage). */
export function broadcastOutputHeartbeat() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  try {
    localStorage.setItem(OUTPUT_HEARTBEAT_STORAGE_KEY, String(now));
  } catch { /* ignore quota */ }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(OUTPUT_HEARTBEAT_CHANNEL);
      ch.postMessage({ ts: now });
      ch.close();
    }
  } catch { /* ignore */ }
}

export interface OutputAssets {
  qrSize: number;
  qrPosition: QRPosition;
  qrVisible?: boolean;
  qrUrlVisible?: boolean;
  showBranding: boolean;
  brandingPosition: QRPosition;
  enabledAssetIds?: AssetId[];
  transforms?: AssetTransformMap;
  assetColors?: AssetColorMap;
  wordmarkWeight?: AssetState['wordmarkWeight'];
  wordmarkTracking?: number;
  wordmarkScale?: number;
  wordmarkShowGuides?: boolean;
  /** Lower-third banner height in % of frame */
  lowerThirdHeight?: number;
  /** Active folder's tally pacing — Output applies this to scenes so the
   *  bars/percentages either track live votes continuously (`live`) or
   *  snap forward every N seconds (`stopMotion`). */
  tallyMode?: 'live' | 'stopMotion';
  tallyIntervalSeconds?: number;
}

export interface OutputStatePayload {
  poll: Poll;
  scene: SceneType;
  layers: GraphicLayer[];
  assets?: OutputAssets;
}

/** Explicit lock messages broadcast separately from regular state updates so
 *  Output can switch between "follow workspace" and "render frozen snapshot"
 *  modes without race conditions. */
export interface OutputLockMessage {
  /** When `true`, Output should render `snapshot` and ignore all subsequent
   *  OutputStatePayload pushes until a `{ locked: false }` message arrives. */
  locked: boolean;
  /** The frozen payload to render while locked. Required when locked=true. */
  snapshot?: OutputStatePayload;
  /** Wall-clock ms when the lock engaged — used as a tiebreaker in Output. */
  lockedAt?: number;
}

export function broadcastOutputLock(message: OutputLockMessage) {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(message);
  try {
    if (message.locked) localStorage.setItem(OUTPUT_LOCK_STORAGE_KEY, serialized);
    else localStorage.removeItem(OUTPUT_LOCK_STORAGE_KEY);
  } catch { /* ignore quota */ }
  // Always emit a storage event so other tabs hear about unlocks too.
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: OUTPUT_LOCK_STORAGE_KEY,
      newValue: message.locked ? serialized : null,
    }));
  } catch { /* ignore */ }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(OUTPUT_LOCK_CHANNEL);
      ch.postMessage(message);
      ch.close();
    }
  } catch { /* ignore */ }
}

export function readOutputLock(): OutputLockMessage | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(OUTPUT_LOCK_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OutputLockMessage;
    if (!parsed || typeof parsed !== 'object' || !parsed.locked) return null;
    return parsed;
  } catch {
    return null;
  }
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
