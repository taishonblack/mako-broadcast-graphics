import type { AssetId } from '@/components/poll-create/polling-assets/types';
import type { SceneType } from './scenes';

/**
 * Broadcast scene presets — the operator-facing scene model.
 *
 * A poll owns ALL of its assets (question, answers, qr, logo, voter tally,
 * etc.). A scene is just a *visibility filter* applied to those assets,
 * plus the underlying scene template the canvas should render.
 *
 * Scene changes never affect voting state — voting can keep running while
 * the operator switches between Question+QR, Live Results, Final Results
 * and Lower Third.
 */
export type BroadcastSceneId =
  | 'questionQr'
  | 'liveResults'
  | 'finalResults'
  | 'lowerThird';

export interface BroadcastScene {
  id: BroadcastSceneId;
  /** Operator-facing label shown in the scene bar. */
  label: string;
  shortLabel: string;
  /** Underlying scene template the canvas renders. */
  sceneType: SceneType;
  /** Asset IDs visible while this scene is on-air. The renderer
   *  intersects this with the poll's enabled assets, so an asset that
   *  isn't part of the poll never shows up even if a scene allows it. */
  visibleAssets: AssetId[];
}

const BASE: AssetId[] = ['question', 'subheadline', 'background', 'logo'];

export const BROADCAST_SCENES: BroadcastScene[] = [
  {
    id: 'questionQr',
    label: 'Question + QR',
    shortLabel: 'Q + QR',
    sceneType: 'fullscreen',
    // Show the full scene frame (including answer bars + voter tally).
    // Operators who want a stripped-down Q+QR-only layout should build
    // a dedicated scene with those assets disabled instead of having
    // the preset hide them silently.
    visibleAssets: [...BASE, 'qr', 'answerType', 'answers', 'voterTally'],
  },
  {
    id: 'liveResults',
    label: 'Live Results',
    shortLabel: 'Live Results',
    sceneType: 'results',
    // QR stays visible — voting is still open during live results.
    visibleAssets: [...BASE, 'qr', 'answers', 'voterTally', 'answerType'],
  },
  {
    id: 'finalResults',
    label: 'Final Results',
    shortLabel: 'Final',
    sceneType: 'results',
    visibleAssets: [...BASE, 'answers', 'voterTally', 'answerType'],
  },
  {
    id: 'lowerThird',
    label: 'Lower Third',
    shortLabel: 'L3',
    sceneType: 'lowerThird',
    visibleAssets: [...BASE],
  },
];

const BY_ID: Record<BroadcastSceneId, BroadcastScene> =
  BROADCAST_SCENES.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {} as Record<BroadcastSceneId, BroadcastScene>);

const BY_SCENE_TYPE: Record<SceneType, BroadcastSceneId> = {
  fullscreen: 'questionQr',
  results: 'liveResults',
  lowerThird: 'lowerThird',
  qr: 'questionQr',
};

export function getBroadcastScene(id: BroadcastSceneId): BroadcastScene {
  return BY_ID[id];
}

/** Map a low-level SceneType back to a broadcast scene id. Used to resolve
 *  the active scene when only the underlying template is known (legacy
 *  state, restored snapshots). */
export function broadcastSceneFromSceneType(scene: SceneType): BroadcastSceneId {
  return BY_SCENE_TYPE[scene] ?? 'questionQr';
}

/** Filter a poll's enabled asset list down to what the given scene shows.
 *  Result preserves the original ordering so renderers can iterate the
 *  poll's asset list directly. */
export function filterAssetsForScene(
  enabledAssetIds: readonly AssetId[] | readonly string[] | undefined,
  sceneId: BroadcastSceneId,
): AssetId[] {
  const scene = getBroadcastScene(sceneId);
  const allowed = new Set<string>(scene.visibleAssets);
  const ids = (enabledAssetIds ?? []) as readonly string[];
  return ids.filter((id) => allowed.has(id)) as AssetId[];
}