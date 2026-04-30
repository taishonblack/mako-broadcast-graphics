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
  /** When true, the scene appears in the bar but is not yet wired up.
   *  The selector renders it greyed out and ignores clicks. */
  disabled?: boolean;
}

const BASE: AssetId[] = ['question', 'subheadline', 'background', 'logo'];

export const BROADCAST_SCENES: BroadcastScene[] = [
  {
    id: 'questionQr',
    label: 'Full Frame',
    shortLabel: 'Full Frame',
    sceneType: 'fullscreen',
    // Voting screen. Voter Selection (`answerType`) is allowed in the
    // visible set so it propagates to Mobile/Desktop voter views; on
    // Program output the FullscreenScene renderer never draws it.
    // `answers` (Answer Bars) is also allowed: the renderer respects
    // the folder-level enable, so operators who add bars to a Voting
    // scene see them on Program. Without this, Output stripped the
    // answer-bars asset even when the folder had it enabled — Build
    // showed bars but Output went blank.
    visibleAssets: [...BASE, 'qr', 'answerType', 'answers'],
  },
  {
    id: 'liveResults',
    label: 'Results',
    shortLabel: 'Results',
    sceneType: 'results',
    // Live results: Program shows Answer Bars; voters keep seeing Voter
    // Selection while voting remains open.
    visibleAssets: [...BASE, 'qr', 'answers', 'voterTally', 'answerType'],
  },
  {
    id: 'lowerThird',
    label: 'Lower Third',
    shortLabel: 'L3',
    sceneType: 'lowerThird',
    visibleAssets: [...BASE],
    disabled: true,
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