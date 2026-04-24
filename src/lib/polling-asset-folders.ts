import { supabase } from '@/integrations/supabase/client';
import { AssetId } from '@/components/poll-create/polling-assets/types';
import { BlockLetter } from '@/lib/poll-persistence';

export interface PollingAssetFolder {
  id: string;
  name: string;
  blockLetter: BlockLetter;
  collapsed?: boolean;
  questionText?: string;
  bgColor?: string;
  bgImage?: string;
  assetIds: AssetId[];
}

export interface PollingAssetFolderState {
  folders: PollingAssetFolder[];
  activeFolderId: string;
}

const VALID_ASSETS: AssetId[] = ['question', 'answers', 'subheadline', 'background', 'qr', 'logo', 'voterTally', 'image'];
const DEFAULT_BLOCK: BlockLetter = 'A';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function createFolderId() {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createFolderName(index: number) {
  return `Folder ${index}`;
}

export function createDefaultFolderState(initialQuestionText = '', initialBgColor = '#1a1a2e'): PollingAssetFolderState {
  const id = createFolderId();
  return {
    activeFolderId: id,
    folders: [{ id, name: createFolderName(1), blockLetter: DEFAULT_BLOCK, collapsed: false, questionText: initialQuestionText, bgColor: initialBgColor, assetIds: [] }],
  };
}

export function getFolderById(state: PollingAssetFolderState, folderId: string | null | undefined) {
  return state.folders.find((folder) => folder.id === folderId) ?? state.folders[0];
}

export function findAssetFolder(state: PollingAssetFolderState, assetId: AssetId) {
  return state.folders.find((folder) => folder.assetIds.includes(assetId));
}

export function listAssignedAssets(state: PollingAssetFolderState) {
  return state.folders.flatMap((folder) => folder.assetIds);
}

export function getAvailableAssets(assetIds: AssetId[]) {
  const assigned = new Set(assetIds);
  return VALID_ASSETS.filter((assetId) => !assigned.has(assetId));
}

export function normalizeFolderState(input: unknown): PollingAssetFolderState {
  const fallback = createDefaultFolderState();
  if (!isRecord(input) || !Array.isArray(input.folders)) return fallback;

  const folders = input.folders
    .filter(isRecord)
    .map((folder, index) => {
      const assetIds = Array.isArray(folder.assetIds)
        ? folder.assetIds.filter((assetId): assetId is AssetId => VALID_ASSETS.includes(assetId as AssetId))
        : [];

      return {
        id: typeof folder.id === 'string' && folder.id.length > 0 ? folder.id : createFolderId(),
        name: typeof folder.name === 'string' && folder.name.trim().length > 0 ? folder.name.trim() : createFolderName(index + 1),
        blockLetter: ['A', 'B', 'C', 'D', 'E'].includes(String(folder.blockLetter)) ? folder.blockLetter as BlockLetter : DEFAULT_BLOCK,
        collapsed: Boolean(folder.collapsed),
        questionText: typeof folder.questionText === 'string' ? folder.questionText : undefined,
        bgColor: typeof folder.bgColor === 'string' ? folder.bgColor : undefined,
        bgImage: typeof folder.bgImage === 'string' ? folder.bgImage : undefined,
        assetIds: Array.from(new Set(assetIds)),
      };
    })
    .filter((folder) => folder.assetIds.length > 0 || folder.name.length > 0);

  if (folders.length === 0) {
    return fallback;
  }

  const activeFolderId = typeof input.activeFolderId === 'string' && folders.some((folder) => folder.id === input.activeFolderId)
    ? input.activeFolderId
    : folders[0].id;

  return { folders, activeFolderId };
}

export async function loadProjectPollingAssetFolders(projectId: string, userId: string) {
  const { data, error } = await supabase
    .from('workspace_preferences')
    .select('id, layout_json')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('mode', 'build')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const row = data?.[0];
  if (!row || !isRecord(row.layout_json)) return null;

  return normalizeFolderState(row.layout_json.pollingAssets);
}

export async function saveProjectPollingAssetFolders(projectId: string, userId: string, nextState: PollingAssetFolderState) {
  const { data, error } = await supabase
    .from('workspace_preferences')
    .select('id, layout_json')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('mode', 'build')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const existing = data?.[0];
  const existingLayout = isRecord(existing?.layout_json) ? existing.layout_json : {};
  const layout_json = {
    ...existingLayout,
    pollingAssets: nextState,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('workspace_preferences')
      .update({ layout_json } as never)
      .eq('id', existing.id);
    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await supabase
    .from('workspace_preferences')
    .insert({
      user_id: userId,
      project_id: projectId,
      mode: 'build',
      complexity: 'simple',
      layout_json,
    } as never);

  if (insertError) throw insertError;
}