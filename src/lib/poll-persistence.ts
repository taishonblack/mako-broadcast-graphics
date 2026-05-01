import { supabase } from '@/integrations/supabase/client';
import { TemplateName } from '@/lib/types';
import { AnswerType, MCLabelStyle, PreviewDataMode } from '@/components/poll-create/ContentPanel';
import { projectCreateSchema, projectRenameSchema } from '@/lib/project-validation';

export interface DraftAnswer {
  id: string;
  text: string;
  shortLabel: string;
  testVotes?: number;
}

export interface DraftPollPayload {
  internalName: string;
  question: string;
  subheadline: string;
  slug: string;
  template: TemplateName;
  answerType: AnswerType;
  mcLabelStyle: MCLabelStyle;
  answers: DraftAnswer[];
  showLiveResults: boolean;
  showThankYou: boolean;
  showFinalResults: boolean;
  autoCloseSeconds?: number;
  postVoteDelayMs?: number;
  bgColor: string;
  bgImage?: string;
  previewDataMode: PreviewDataMode;
  blockLetter?: BlockLetter;
  blockLabel?: string;
  blockPosition?: number;
}

export interface SavedPoll extends DraftPollPayload {
  id: string;
  status: 'draft' | 'saved' | 'live' | 'closed' | 'archived';
  projectId?: string;
  updatedAt: string;
}

export type BlockLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export const BLOCK_LETTERS: BlockLetter[] = ['A', 'B', 'C', 'D', 'E'];

export const DEFAULT_BLOCK_LABELS: Record<BlockLetter, string> = {
  A: 'Top of Show',
  B: 'Early Show',
  C: 'Mid-show',
  D: 'Late Show',
  E: 'End of Show',
};

function toRow(p: DraftPollPayload, userId: string, status: 'draft' | 'saved', projectId?: string) {
  // Each poll within a project must have a unique viewer_slug (DB unique
  // index on (project_id, viewer_slug)). The draft payload doesn't carry a
  // viewer slug yet, so derive a stable token from the poll's slug — or
  // fall back to a short random id — to avoid duplicate-key autosave
  // failures when a project has more than one draft.
  const viewerSlug = (p.slug && p.slug.trim().length > 0)
    ? p.slug.trim().toLowerCase()
    : `draft-${Math.random().toString(36).slice(2, 10)}`;
  return {
    user_id: userId,
    project_id: projectId ?? null,
    status,
    internal_name: p.internalName,
    question: p.question,
    subheadline: p.subheadline,
    slug: p.slug,
    viewer_slug: viewerSlug,
    template: p.template,
    answer_type: p.answerType,
    mc_label_style: p.mcLabelStyle,
    answers: p.answers as unknown as never,
    show_live_results: p.showLiveResults,
    show_thank_you: p.showThankYou,
    show_final_results: p.showFinalResults,
    auto_close_seconds: p.autoCloseSeconds ?? null,
    post_vote_delay_ms: p.postVoteDelayMs ?? 1500,
    bg_color: p.bgColor,
    bg_image: p.bgImage ?? null,
    preview_data_mode: p.previewDataMode,
    block_letter: p.blockLetter ?? null,
    block_label: p.blockLabel ?? null,
    block_position: p.blockPosition ?? null,
  };
}

export function fromRow(row: Record<string, unknown>): SavedPoll {
  return {
    id: row.id as string,
    status: row.status as SavedPoll['status'],
    projectId: (row.project_id as string | null) ?? undefined,
    updatedAt: row.updated_at as string,
    internalName: row.internal_name as string,
    question: row.question as string,
    subheadline: row.subheadline as string,
    slug: row.slug as string,
    template: row.template as TemplateName,
    answerType: row.answer_type as AnswerType,
    mcLabelStyle: row.mc_label_style as MCLabelStyle,
    answers: (row.answers as DraftAnswer[]) ?? [],
    showLiveResults: row.show_live_results as boolean,
    showThankYou: row.show_thank_you as boolean,
    showFinalResults: row.show_final_results as boolean,
    autoCloseSeconds: (row.auto_close_seconds as number | null) ?? undefined,
    postVoteDelayMs: (row.post_vote_delay_ms as number | null) ?? 1500,
    bgColor: row.bg_color as string,
    bgImage: (row.bg_image as string | null) ?? undefined,
    previewDataMode: row.preview_data_mode as PreviewDataMode,
    blockLetter: ((row.block_letter as string | null) ?? undefined) as BlockLetter | undefined,
    blockLabel: (row.block_label as string | null) ?? undefined,
    blockPosition: (row.block_position as number | null) ?? undefined,
  };
}

export async function loadPoll(id: string): Promise<SavedPoll | null> {
  const { data, error } = await supabase.from('polls').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function savePoll(opts: {
  id?: string;
  payload: DraftPollPayload;
  userId: string;
  status: 'draft' | 'saved';
  projectId?: string;
}): Promise<SavedPoll> {
  const row = toRow(opts.payload, opts.userId, opts.status, opts.projectId);
  if (opts.id) {
    // On update, omit viewer_slug so we don't churn it on every autosave.
    const { viewer_slug: _vs, ...updateRow } = row;
    const { data, error } = await supabase
      .from('polls').update(updateRow as never).eq('id', opts.id).select().single();
    if (error) throw error;
    return fromRow(data);
  }
  const { data, error } = await supabase.from('polls').insert([row as never]).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function listProjects() {
  const { data, error } = await supabase
    .from('projects').select('id, name, description, tags, created_at, updated_at, project_date, last_used_at').order('last_used_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(name: string, userId: string, tags: string[] = []) {
  const parsed = projectCreateSchema.parse({ name, tags });
  const { data, error } = await supabase
    .from('projects').insert({ name: parsed.name, user_id: userId, account_id: userId, created_by: userId, tags: parsed.tags } as never).select().single();
  if (error) throw error;
  return data;
}

export async function renameProject(projectId: string, name: string) {
  const parsed = projectRenameSchema.parse({ name });
  const { data, error } = await supabase
    .from('projects').update({ name: parsed.name } as never).eq('id', projectId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

export async function markProjectLastUsed(projectId: string) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('projects').update({ last_used_at: timestamp } as never).eq('id', projectId).select('id, last_used_at').single();
  if (error) throw error;
  return data as { id: string; last_used_at: string };
}

export async function listPolls(): Promise<SavedPoll[]> {
  const { data, error } = await supabase
    .from('polls').select('*').order('updated_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/**
 * Detects whether a thrown Supabase error corresponds to the
 * `(project_id, block_letter, block_position)` unique-violation that
 * fires when two polls in the same project try to occupy the same
 * block slot. We match on the constraint name (preferred) and fall
 * back to a substring check so a renamed constraint still trips it.
 */
export function isBlockPositionConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; details?: string };
  const blob = `${e.message ?? ''} ${e.details ?? ''}`;
  if (e.code === '23505' && /block_position/i.test(blob)) return true;
  return /polls_project_block_position_unique/i.test(blob);
}

/**
 * Detect the `(project_id, viewer_slug)` unique-violation that fires when
 * two polls in the same project try to publish the same `/vote/:slug`.
 * Mirrors {@link isBlockPositionConflict} — match the constraint name first,
 * fall back to a substring check.
 */
export function isViewerSlugConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; details?: string };
  const blob = `${e.message ?? ''} ${e.details ?? ''}`;
  if (e.code === '23505' && /viewer_slug/i.test(blob)) return true;
  return /polls_project_viewer_slug_unique/i.test(blob);
}

/**
 * Find the lowest unused suffixed viewer_slug within (projectId), starting
 * from the requested base. Returns the base itself if it's free, otherwise
 * `base-2`, `base-3`, … The current poll (if any) is excluded so re-saving
 * its own slug is always allowed.
 */
export async function findNextAvailableViewerSlug(opts: {
  projectId: string;
  baseSlug: string;
  excludePollId?: string | null;
}): Promise<string> {
  const base = (opts.baseSlug || '').trim().toLowerCase() || `poll-${Math.random().toString(36).slice(2, 8)}`;
  let query = supabase
    .from('polls')
    .select('viewer_slug')
    .eq('project_id', opts.projectId);
  if (opts.excludePollId) {
    query = query.neq('id', opts.excludePollId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const taken = new Set(((data ?? []) as Array<{ viewer_slug: string | null }>)
    .map((r) => (r.viewer_slug ?? '').toLowerCase())
    .filter((s) => s.length > 0));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Find the lowest unused block_position within (projectId, blockLetter),
 * starting at 1. The current poll (if it already has a row) is excluded
 * from the "occupied" set so renaming/saving it back into its own slot
 * is always allowed.
 */
export async function findNextAvailableBlockPosition(opts: {
  projectId: string;
  blockLetter: BlockLetter;
  excludePollId?: string | null;
}): Promise<number> {
  let query = supabase
    .from('polls')
    .select('block_position')
    .eq('project_id', opts.projectId)
    .eq('block_letter', opts.blockLetter);
  if (opts.excludePollId) {
    query = query.neq('id', opts.excludePollId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const taken = new Set(((data ?? []) as Array<{ block_position: number | null }>)
    .map((r) => r.block_position)
    .filter((n): n is number => typeof n === 'number'));
  let candidate = 1;
  while (taken.has(candidate)) candidate += 1;
  return candidate;
}