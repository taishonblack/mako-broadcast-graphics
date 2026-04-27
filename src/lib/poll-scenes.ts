import { supabase } from '@/integrations/supabase/client';
import type { AssetId } from '@/components/poll-create/polling-assets/types';

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
}

function rowToScene(row: RawSceneRow, assets: RawSceneAssetRow[]): PollScene {
  const visible = new Set<AssetId>();
  for (const a of assets) {
    if (a.scene_id === row.id && a.visible) visible.add(a.asset_id as AssetId);
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
    .select('scene_id, asset_id, visible')
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

  const meta = getScenePreset(preset);
  if (meta.defaultVisibleAssets.length > 0) {
    const rows = meta.defaultVisibleAssets.map((asset_id) => ({
      scene_id: (data as RawSceneRow).id,
      asset_id,
      visible: true,
    }));
    const { error: insErr } = await supabase
      .from('poll_scene_assets')
      .insert(rows as never);
    if (insErr) throw insErr;
  }

  return rowToScene(
    data as RawSceneRow,
    meta.defaultVisibleAssets.map((asset_id) => ({
      scene_id: (data as RawSceneRow).id,
      asset_id,
      visible: true,
    })),
  );
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
  if (visibleArray.length > 0) {
    const rows = visibleArray.map((asset_id) => ({
      scene_id: (data as RawSceneRow).id,
      asset_id,
      visible: true,
    }));
    const { error: insErr } = await supabase
      .from('poll_scene_assets')
      .insert(rows as never);
    if (insErr) throw insErr;
  }

  return rowToScene(
    data as RawSceneRow,
    visibleArray.map((asset_id) => ({ scene_id: (data as RawSceneRow).id, asset_id, visible: true })),
  );
}

/** Build a scene name like "Scene 4" that doesn't collide with existing names. */
export function nextSceneName(scenes: PollScene[]): string {
  const used = new Set(scenes.map((s) => s.name));
  let n = scenes.length + 1;
  while (used.has(`Scene ${n}`)) n += 1;
  return `Scene ${n}`;
}
