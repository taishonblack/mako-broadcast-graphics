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

async function persistDraftScenesToPoll(pollId: string, draftScenes: PollScene[]): Promise<PollScene[]> {
  const createdScenes: PollScene[] = [];
  for (const draft of draftScenes) {
    const created = await createPollScene(pollId, draft.preset, draft.name, draft.sortOrder);
    const meta = getScenePreset(draft.preset);
    const assetIds = new Set<AssetId>([
      ...meta.defaultVisibleAssets,
      ...Array.from(draft.visibleAssetIds),
      ...(Object.keys(draft.assetTransforms ?? {}) as AssetId[]),
    ]);

    await Promise.all(Array.from(assetIds).map((assetId) =>
      setPollSceneAssetVisible(created.id, assetId, draft.visibleAssetIds.has(assetId)),
    ));
    if (Object.keys(draft.assetTransforms ?? {}).length > 0) {
      await bulkSavePollSceneAssetTransforms(created.id, draft.assetTransforms as AssetTransformMap);
    }

    createdScenes.push({
      ...created,
      name: draft.name,
      sortOrder: draft.sortOrder,
      visibleAssetIds: new Set(draft.visibleAssetIds),
      assetTransforms: draft.assetTransforms ?? {},
    });
  }
  return createdScenes;
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
  const draftStorageKey = sceneStorageKey(undefined, 'workspace');
  const activeStorageKey = sceneStorageKey(pollId, 'workspace');
  const [scenes, setScenes] = useState<PollScene[]>(() => loadCachedScenes(activeStorageKey).scenes);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const draftScenesRef = useRef<PollScene[]>(loadCachedScenes(draftStorageKey).scenes);
  const hydratedStorageKeyRef = useRef<string | null>(null);

  // Load whenever pollId becomes available.
  useEffect(() => {
    if (!pollId) {
      // Restore draft state if the user navigated away/back or the tab was suspended.
      const cachedDraft = loadCachedScenes(draftStorageKey).scenes;
      draftScenesRef.current = cachedDraft;
      setScenes(cachedDraft);
      setActiveSceneId((prev) => (prev && cachedDraft.some((s) => s.id === prev) ? prev : cachedDraft[0]?.id ?? null));
      hydratedStorageKeyRef.current = draftStorageKey;
      return;
    }
    let cancelled = false;
    setLoading(true);
    const cached = loadCachedScenes(activeStorageKey);
    const draftScenes = draftScenesRef.current.length > 0 ? draftScenesRef.current : loadCachedScenes(draftStorageKey).scenes;
    if (cached.scenes.length > 0) {
      setScenes(cached.scenes);
      setActiveSceneId((prev) => (prev && cached.scenes.some((s) => s.id === prev) ? prev : cached.scenes[0]?.id ?? null));
    }
    loadPollScenes(pollId)
      .then(async (rows) => {
        if (cancelled) return;
        const persistedFromDraft = rows.length > 0 || draftScenes.length === 0
          ? null
          : await persistDraftScenesToPoll(pollId, draftScenes);
        const nextRows = persistedFromDraft ?? rows;
        if (cancelled) return;
        setScenes(nextRows);
        setActiveSceneId((prev) => {
          // Keep the same scene selected when the prev id still exists.
          if (prev && nextRows.some((r) => r.id === prev)) return prev;
          // When draft scenes were just persisted, the local in-memory id
          // (e.g. `draft-scene-…`) was replaced by a fresh DB UUID. Map the
          // previous selection forward by matching sort order so the
          // operator's chosen scene (e.g. Scene 2) doesn't snap back to
          // Scene 1 the moment the poll is saved.
          if (persistedFromDraft && prev) {
            const draftIndex = draftScenes.findIndex((s) => s.id === prev);
            if (draftIndex >= 0 && persistedFromDraft[draftIndex]) {
              return persistedFromDraft[draftIndex].id;
            }
          }
          return nextRows[0]?.id ?? null;
        });
        cacheScenes(activeStorageKey, nextRows);
        hydratedStorageKeyRef.current = activeStorageKey;
        if (draftScenes.length > 0 && nextRows.length > 0) {
          draftScenesRef.current = [];
          localStorage.removeItem(draftStorageKey);
        }
      })
      .catch((err) => {
        console.error('[usePollScenes] load failed', err);
        if (cached.exists) {
          setScenes(cached.scenes);
          setActiveSceneId((prev) => (prev && cached.scenes.some((r) => r.id === prev) ? prev : cached.scenes[0]?.id ?? null));
          hydratedStorageKeyRef.current = activeStorageKey;
          toast.error('Scene sync interrupted — restored cached scenes');
        } else {
          toast.error('Failed to load scenes');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeStorageKey, draftStorageKey, pollId]);

  useEffect(() => {
    if (hydratedStorageKeyRef.current !== activeStorageKey) return;
    cacheScenes(activeStorageKey, scenes);
    if (!pollId) draftScenesRef.current = scenes;
  }, [activeStorageKey, pollId, scenes]);

  const addScene = useCallback(async (preset: ScenePreset) => {
    const meta = getScenePreset(preset);
    const name = nextSceneName(scenes);
    const sortOrder = scenes.length;
    if (pollId) {
      try {
        const created = await createPollScene(pollId, preset, name, sortOrder);
        // Strip preset-seeded visibility so the operator must explicitly
        // add assets to each scene. Otherwise an asset added later to the
        // folder auto-appears in every scene whose preset pre-included it
        // (e.g. adding "Answer Bars" while Scene 2 (Live Results) is
        // active also makes it show up in any other Live-Results scene).
        const blank: PollScene = { ...created, visibleAssetIds: new Set<AssetId>() };
        setScenes((prev) => [...prev, blank]);
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
        // See note above — start scenes empty so each asset must be added
        // explicitly to the scene the operator currently has selected.
        visibleAssetIds: new Set<AssetId>(),
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
