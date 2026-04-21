import { supabase } from '@/integrations/supabase/client';
import { TemplateName } from '@/lib/types';
import { AnswerType, MCLabelStyle, PreviewDataMode } from '@/components/poll-create/ContentPanel';

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
  bgColor: string;
  bgImage?: string;
  previewDataMode: PreviewDataMode;
}

export interface SavedPoll extends DraftPollPayload {
  id: string;
  status: 'draft' | 'saved' | 'live' | 'closed' | 'archived';
  projectId?: string;
  updatedAt: string;
}

function toRow(p: DraftPollPayload, userId: string, status: 'draft' | 'saved', projectId?: string) {
  return {
    user_id: userId,
    project_id: projectId ?? null,
    status,
    internal_name: p.internalName,
    question: p.question,
    subheadline: p.subheadline,
    slug: p.slug,
    template: p.template,
    answer_type: p.answerType,
    mc_label_style: p.mcLabelStyle,
    answers: p.answers as unknown as object,
    show_live_results: p.showLiveResults,
    show_thank_you: p.showThankYou,
    show_final_results: p.showFinalResults,
    auto_close_seconds: p.autoCloseSeconds ?? null,
    bg_color: p.bgColor,
    bg_image: p.bgImage ?? null,
    preview_data_mode: p.previewDataMode,
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
    const { data, error } = await supabase
      .from('polls').update(row).eq('id', opts.id).select().single();
    if (error) throw error;
    return fromRow(data);
  }
  const { data, error } = await supabase.from('polls').insert(row).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function listProjects() {
  const { data, error } = await supabase
    .from('projects').select('id, name, description').order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(name: string, userId: string) {
  const { data, error } = await supabase
    .from('projects').insert({ name, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}