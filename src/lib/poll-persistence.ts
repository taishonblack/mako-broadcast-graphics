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
      .from('polls').update(updateRow).eq('id', opts.id).select().single();
    if (error) throw error;
    return fromRow(data);
  }
  const { data, error } = await supabase.from('polls').insert([row]).select().single();
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