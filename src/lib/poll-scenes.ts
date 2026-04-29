import { supabase } from '@/integrations/supabase/client';
import type { AssetId, AssetTransformConfig, AssetTransformMap } from '@/components/poll-create/polling-assets/types';
import { DEFAULT_ASSET_TRANSFORMS } from '@/components/poll-create/polling-assets/types';

/**
 * Scene presets — operator picks one of these when creating a scene inside
 * a folder/poll. Each preset seeds a default visible-asset set, but the
 * operator can rename the scene and (in a later iteration) toggle asset
 * visibility independently per scene.
 *
 * Hierarchy (see mem://features/hierarchy):
 *   Project → Block → Folder/Poll → Scene → Assets
 */
export type ScenePreset = 'fullScreen' | 'liveResults' | 'final';

export interface ScenePresetMeta {
  id: ScenePreset;
  label: string;
  description: string;
  /** Assets seeded as visible when a scene is created from this preset. */
  defaultVisibleAssets: AssetId[];
}

export const SCENE_PRESETS: ScenePresetMeta[] = [
  {
    id: 'fullScreen',
    label: 'Full Screen',
    description: 'Text + QR + Answer Type + Background',
    defaultVisibleAssets: ['question', 'qr', 'answerType', 'background'],
  },
  {
    id: 'liveResults',
    label: 'Live Results',
    description: 'Text + QR + Answer Bars + Tally + Background',
    defaultVisibleAssets: ['question', 'qr', 'answers', 'voterTally', 'background'],
  },
  {
    id: 'final',
    label: 'Final',
    description: 'Text + Answer Bars + Tally + Background',
    defaultVisibleAssets: ['question', 'answers', 'voterTally', 'background'],
  },
];

export function getScenePreset(id: ScenePreset): ScenePresetMeta {
  return SCENE_PRESETS.find((p) => p.id === id) ?? SCENE_PRESETS[0];
}

export interface PollScene {
  id: string;
  pollId: string;
  name: string;
  preset: ScenePreset;
  sortOrder: number;
  /** Set of asset_ids that are visible while this scene is on-air. */
  visibleAssetIds: Set<AssetId>;
  /**
   * Per-asset transforms (position / scale / rotation / opacity / crop)
   * scoped to this scene. Only the broadcast (program) viewport is
   * persisted — Mobile/Desktop overrides are still in-memory only.
   */
  assetTransforms: Partial<Record<AssetId, AssetTransformConfig>>;
}

/* ------------------------------------------------------------------ */
/* Persistence helpers                                                 */
/* ------------------------------------------------------------------ */

interface RawSceneRow {
  id: string;
  poll_id: string;
  name: string;
  preset: string;
  sort_order: number;
}

interface RawSceneAssetRow {
  scene_id: string;
  asset_id: string;
  visible: boolean;
  transform: unknown;
}

function rowToScene(row: RawSceneRow, assets: RawSceneAssetRow[]): PollScene {
  const visible = new Set<AssetId>();
  const transforms: Partial<Record<AssetId, AssetTransformConfig>> = {};
  for (const a of assets) {
    if (a.scene_id !== row.id) continue;
    if (a.visible) visible.add(a.asset_id as AssetId);
    const t = a.transform;
    if (t && typeof t === 'object' && Object.keys(t as object).length > 0) {
      transforms[a.asset_id as AssetId] = t as AssetTransformConfig;
    }
  }
  const preset: ScenePreset =
    row.preset === 'liveResults' || row.preset === 'final' ? row.preset : 'fullScreen';
  return {
    id: row.id,
    pollId: row.poll_id,
    name: row.name,
    preset,
    sortOrder: row.sort_order,
    visibleAssetIds: visible,
    assetTransforms: transforms,
  };
}

export async function loadPollScenes(pollId: string): Promise<PollScene[]> {
  const { data: sceneRows, error: sceneErr } = await supabase
    .from('poll_scenes')
    .select('id, poll_id, name, preset, sort_order')
    .eq('poll_id', pollId)
    .order('sort_order', { ascending: true });
  if (sceneErr) throw sceneErr;
  const scenes = (sceneRows ?? []) as RawSceneRow[];
  if (scenes.length === 0) return [];

  const ids = scenes.map((s) => s.id);
  const { data: assetRows, error: assetErr } = await supabase
    .from('poll_scene_assets')
    .select('scene_id, asset_id, visible, transform')
    .in('scene_id', ids);
  if (assetErr) throw assetErr;

  return scenes.map((s) => rowToScene(s, (assetRows ?? []) as RawSceneAssetRow[]));
}

export async function createPollScene(
  pollId: string,
  preset: ScenePreset,
  name: string,
  sortOrder: number,
): Promise<PollScene> {
  const { data, error } = await supabase
    .from('poll_scenes')
    .insert({ poll_id: pollId, preset, name, sort_order: sortOrder } as never)
    .select('id, poll_id, name, preset, sort_order')
    .single();
  if (error) throw error;

  // Intentionally NOT seeding `poll_scene_assets` from the preset's
  // `defaultVisibleAssets`. Pre-seeding caused assets added later to the
  // folder to auto-appear in every scene whose preset pre-included them,
  // which violated the operator's "asset belongs to the scene I selected"
  // mental model. Scenes start blank; the operator adds assets via the
  // folder "+" menu while the target scene is active.
  return rowToScene(data as RawSceneRow, []);
}

export async function renamePollScene(sceneId: string, name: string) {
  const { error } = await supabase
    .from('poll_scenes')
    .update({ name } as never)
    .eq('id', sceneId);
  if (error) throw error;
}

export async function deletePollScene(sceneId: string) {
  const { error } = await supabase.from('poll_scenes').delete().eq('id', sceneId);
  if (error) throw error;
}

/**
 * Toggle whether an asset is visible inside a given scene. Upserts a row
 * into `poll_scene_assets` — multiple assets can be visible per scene.
 * Drafts (sceneId starting with `draft-scene-`) are handled in-memory by
 * the hook and skip the DB call.
 */
export async function setPollSceneAssetVisible(
  sceneId: string,
  assetId: AssetId,
  visible: boolean,
) {
  const { error } = await supabase
    .from('poll_scene_assets')
    .upsert(
      { scene_id: sceneId, asset_id: assetId, visible } as never,
      { onConflict: 'scene_id,asset_id' } as never,
    );
  if (error) throw error;
}

/**
 * Persist a single asset's transform within a scene. Upserts on
 * (scene_id, asset_id) so we never duplicate rows. Defaults `visible`
 * to true so an operator can position an asset before flipping it on.
 */
export async function setPollSceneAssetTransform(
  sceneId: string,
  assetId: AssetId,
  transform: AssetTransformConfig,
) {
  const { error } = await supabase
    .from('poll_scene_assets')
    .upsert(
      { scene_id: sceneId, asset_id: assetId, transform: transform as never, visible: true } as never,
      { onConflict: 'scene_id,asset_id' } as never,
    );
  if (error) throw error;
}

/**
 * Bulk-write every asset transform for a scene. Used on autosave so we
 * keep one network round-trip per scene rather than one per asset.
 */
export async function bulkSavePollSceneAssetTransforms(
  sceneId: string,
  transforms: AssetTransformMap,
  visibleAssetIds?: Iterable<AssetId>,
) {
  const visibleSet = visibleAssetIds ? new Set<AssetId>(visibleAssetIds) : null;
  const rows = (Object.keys(transforms) as AssetId[]).map((assetId) => ({
    scene_id: sceneId,
    asset_id: assetId,
    transform: transforms[assetId] as never,
    ...(visibleSet ? { visible: visibleSet.has(assetId) } : {}),
  }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('poll_scene_assets')
    .upsert(rows as never, { onConflict: 'scene_id,asset_id' } as never);
  if (error) throw error;
}

/**
 * Hydrate a partial per-asset transform map into a full AssetTransformMap,
 * filling missing assets from defaults. Used when constructing the
 * in-memory `sceneTransformSets` cache from the DB.
 */
export function hydrateSceneTransformMap(
  partial: Partial<Record<AssetId, AssetTransformConfig>>,
): AssetTransformMap {
  const out: AssetTransformMap = JSON.parse(JSON.stringify(DEFAULT_ASSET_TRANSFORMS));
  for (const [assetId, t] of Object.entries(partial)) {
    if (t) out[assetId as AssetId] = t;
  }
  return out;
}

export async function duplicatePollScene(scene: PollScene, sortOrder: number): Promise<PollScene> {
  const { data, error } = await supabase
    .from('poll_scenes')
    .insert({
      poll_id: scene.pollId,
      preset: scene.preset,
      name: `${scene.name} (copy)`,
      sort_order: sortOrder,
    } as never)
    .select('id, poll_id, name, preset, sort_order')
    .single();
  if (error) throw error;

  const visibleArray = Array.from(scene.visibleAssetIds);
  // Duplicate visibility AND per-asset transforms so the new scene starts
  // identical to the source until the operator edits it.
  const allAssetIds = new Set<AssetId>([
    ...visibleArray,
    ...(Object.keys(scene.assetTransforms) as AssetId[]),
  ]);
  if (allAssetIds.size > 0) {
    const rows = Array.from(allAssetIds).map((asset_id) => ({
      scene_id: (data as RawSceneRow).id,
      asset_id,
      visible: scene.visibleAssetIds.has(asset_id),
      transform: (scene.assetTransforms[asset_id] ?? {}) as never,
    }));
    const { error: insErr } = await supabase
      .from('poll_scene_assets')
      .insert(rows as never);
    if (insErr) throw insErr;
  }

  return rowToScene(
    data as RawSceneRow,
    Array.from(allAssetIds).map((asset_id) => ({
      scene_id: (data as RawSceneRow).id,
      asset_id,
      visible: scene.visibleAssetIds.has(asset_id),
      transform: scene.assetTransforms[asset_id] ?? {},
    })),
  );
}

/** Build a scene name like "Scene 4" that doesn't collide with existing names. */
export function nextSceneName(scenes: PollScene[]): string {
  const used = new Set(scenes.map((s) => s.name));
  let n = scenes.length + 1;
  while (used.has(`Scene ${n}`)) n += 1;
  return `Scene ${n}`;
}
