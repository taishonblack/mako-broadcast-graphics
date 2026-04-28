import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  PollScene,
  ScenePreset,
  bulkSavePollSceneAssetTransforms,
  createPollScene,
  deletePollScene,
  duplicatePollScene,
  getScenePreset,
  loadPollScenes,
  nextSceneName,
  renamePollScene,
  setPollSceneAssetVisible,
} from '@/lib/poll-scenes';
import type { AssetId, AssetTransformMap } from '@/components/poll-create/polling-assets/types';

const SCENE_STORAGE_PREFIX = 'mako-poll-scenes-v2';

interface StoredPollScene {
  id: string;
  pollId: string;
  name: string;
  preset: ScenePreset;
  sortOrder: number;
  visibleAssetIds: AssetId[];
  assetTransforms: PollScene['assetTransforms'];
}

function sceneStorageKey(pollId: string | undefined, draftScopeKey: string) {
  return `${SCENE_STORAGE_PREFIX}:${pollId ? `poll:${pollId}` : `draft:${draftScopeKey}`}`;
}

function serializeScenes(scenes: PollScene[]): StoredPollScene[] {
  return scenes.map((scene) => ({
    id: scene.id,
    pollId: scene.pollId,
    name: scene.name,
    preset: scene.preset,
    sortOrder: scene.sortOrder,
    visibleAssetIds: Array.from(scene.visibleAssetIds),
    assetTransforms: scene.assetTransforms ?? {},
  }));
}

function deserializeScenes(raw: unknown): PollScene[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((scene): scene is StoredPollScene => Boolean(scene && typeof scene === 'object'))
    .map((scene): PollScene => {
      const preset: ScenePreset = scene.preset === 'liveResults' || scene.preset === 'final' ? scene.preset : 'fullScreen';
      return {
        id: typeof scene.id === 'string' ? scene.id : `draft-scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pollId: typeof scene.pollId === 'string' ? scene.pollId : 'draft',
        name: typeof scene.name === 'string' && scene.name.trim() ? scene.name : 'Scene',
        preset,
        sortOrder: typeof scene.sortOrder === 'number' ? scene.sortOrder : 0,
        visibleAssetIds: new Set(Array.isArray(scene.visibleAssetIds) ? scene.visibleAssetIds : []),
        assetTransforms: scene.assetTransforms ?? {},
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function loadCachedScenes(key: string): { exists: boolean; scenes: PollScene[] } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { exists: false, scenes: [] };
    return { exists: true, scenes: deserializeScenes(JSON.parse(raw)) };
  } catch {
    return { exists: false, scenes: [] };
  }
}

function cacheScenes(key: string, scenes: PollScene[]) {
  try {
    localStorage.setItem(key, JSON.stringify(serializeScenes(scenes)));
  } catch {
    // Local cache is a resilience layer only; persistence still works via DB.
  }
}

/**
 * Hook for managing scenes attached to a single poll.
 *
 * - When `pollId` is set, scenes are loaded from / written to the DB.
 * - When `pollId` is undefined (a brand-new draft that hasn't been saved
 *   yet) we hold scenes in memory only. Once the poll gets saved the
 *   parent should pass the new id and the in-memory scenes will be
 *   flushed to the DB.
 */
export function usePollScenes(pollId: string | undefined) {
  const [scenes, setScenes] = useState<PollScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const draftScenesRef = useRef<PollScene[]>([]);

  // Load whenever pollId becomes available.
  useEffect(() => {
    if (!pollId) {
      // Restore draft state if the user navigated back.
      setScenes(draftScenesRef.current);
      setActiveSceneId(draftScenesRef.current[0]?.id ?? null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPollScenes(pollId)
      .then((rows) => {
        if (cancelled) return;
        setScenes(rows);
        setActiveSceneId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
      })
      .catch((err) => {
        console.error('[usePollScenes] load failed', err);
        toast.error('Failed to load scenes');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pollId]);

  const addScene = useCallback(async (preset: ScenePreset) => {
    const meta = getScenePreset(preset);
    const name = nextSceneName(scenes);
    const sortOrder = scenes.length;
    if (pollId) {
      try {
        const created = await createPollScene(pollId, preset, name, sortOrder);
        setScenes((prev) => [...prev, created]);
        setActiveSceneId(created.id);
        toast.success(`Added ${meta.label}`);
      } catch (err) {
        console.error('[usePollScenes] create failed', err);
        toast.error('Failed to create scene');
      }
    } else {
      // Draft mode — store in memory.
      const draft: PollScene = {
        id: `draft-scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pollId: 'draft',
        name,
        preset,
        sortOrder,
        visibleAssetIds: new Set<AssetId>(meta.defaultVisibleAssets),
        assetTransforms: {},
      };
      const next = [...scenes, draft];
      draftScenesRef.current = next;
      setScenes(next);
      setActiveSceneId(draft.id);
      toast.success(`Added ${meta.label}`);
    }
  }, [pollId, scenes]);

  const renameScene = useCallback(async (sceneId: string, name: string) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, name } : s)));
    if (pollId && !sceneId.startsWith('draft-scene-')) {
      try { await renamePollScene(sceneId, name); }
      catch (err) { console.error(err); toast.error('Failed to rename scene'); }
    } else {
      draftScenesRef.current = draftScenesRef.current.map((s) => (s.id === sceneId ? { ...s, name } : s));
    }
  }, [pollId]);

  const removeScene = useCallback(async (sceneId: string) => {
    const remaining = scenes.filter((s) => s.id !== sceneId);
    setScenes(remaining);
    setActiveSceneId((prev) => (prev === sceneId ? remaining[0]?.id ?? null : prev));
    if (pollId && !sceneId.startsWith('draft-scene-')) {
      try { await deletePollScene(sceneId); }
      catch (err) { console.error(err); toast.error('Failed to delete scene'); }
    } else {
      draftScenesRef.current = draftScenesRef.current.filter((s) => s.id !== sceneId);
    }
  }, [pollId, scenes]);

  const duplicateScene = useCallback(async (sceneId: string) => {
    const source = scenes.find((s) => s.id === sceneId);
    if (!source) return;
    const sortOrder = scenes.length;
    if (pollId && !sceneId.startsWith('draft-scene-')) {
      try {
        const created = await duplicatePollScene(source, sortOrder);
        setScenes((prev) => [...prev, created]);
        setActiveSceneId(created.id);
      } catch (err) { console.error(err); toast.error('Failed to duplicate scene'); }
    } else {
      const draft: PollScene = {
        ...source,
        id: `draft-scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${source.name} (copy)`,
        sortOrder,
        visibleAssetIds: new Set(source.visibleAssetIds),
        assetTransforms: JSON.parse(JSON.stringify(source.assetTransforms ?? {})),
      };
      const next = [...scenes, draft];
      draftScenesRef.current = next;
      setScenes(next);
      setActiveSceneId(draft.id);
    }
  }, [pollId, scenes]);

  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? null;

  /**
   * Toggle a single asset's visibility within a scene. Updates local state
   * immediately and persists to the DB when the scene is real (not a draft).
   */
  const setSceneAssetVisible = useCallback(
    async (sceneId: string, assetId: AssetId, visible: boolean) => {
      setScenes((prev) =>
        prev.map((s) => {
          if (s.id !== sceneId) return s;
          const next = new Set(s.visibleAssetIds);
          if (visible) next.add(assetId);
          else next.delete(assetId);
          return { ...s, visibleAssetIds: next };
        }),
      );
      const isDraft = sceneId.startsWith('draft-scene-');
      if (isDraft) {
        draftScenesRef.current = draftScenesRef.current.map((s) => {
          if (s.id !== sceneId) return s;
          const next = new Set(s.visibleAssetIds);
          if (visible) next.add(assetId);
          else next.delete(assetId);
          return { ...s, visibleAssetIds: next };
        });
        return;
      }
      try { await setPollSceneAssetVisible(sceneId, assetId, visible); }
      catch (err) { console.error('[usePollScenes] toggle asset failed', err); toast.error('Failed to update scene asset'); }
    },
    [],
  );

  /**
   * Persist the full per-asset transform map for a scene. Updates local
   * state in lockstep so the next render of `scenes` already reflects the
   * saved values. Drafts skip the network round-trip.
   */
  const saveSceneAssetTransforms = useCallback(
    async (sceneId: string, transforms: AssetTransformMap) => {
      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, assetTransforms: { ...transforms } } : s)),
      );
      const isDraft = sceneId.startsWith('draft-scene-');
      if (isDraft) {
        draftScenesRef.current = draftScenesRef.current.map((s) =>
          s.id === sceneId ? { ...s, assetTransforms: { ...transforms } } : s,
        );
        return;
      }
      try { await bulkSavePollSceneAssetTransforms(sceneId, transforms); }
      catch (err) {
        console.error('[usePollScenes] save transforms failed', err);
        toast.error('Failed to save scene layout');
      }
    },
    [],
  );

  return {
    scenes,
    activeScene,
    activeSceneId,
    setActiveSceneId,
    addScene,
    renameScene,
    removeScene,
    duplicateScene,
    setSceneAssetVisible,
    saveSceneAssetTransforms,
    loading,
    /** True when there are zero scenes — UI should grey out asset editing. */
    requiresScene: scenes.length === 0,
  };
}
