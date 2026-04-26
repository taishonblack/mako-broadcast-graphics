import { supabase } from '@/integrations/supabase/client';

export type PublicViewerStateName = 'branding' | 'slate' | 'voting' | 'thank_you' | 'closed';

export interface PublicViewerPollSnapshot {
  id?: string;
  question: string;
  subheadline?: string;
  bgColor?: string;
  bgImage?: string | null;
  answers: Array<{ id: string; label: string; shortLabel?: string; sortOrder?: number }>;
  showLiveResults?: boolean;
  showThankYou?: boolean;
  theme?: Record<string, unknown>;
  /** Optional operator color overrides mirrored to viewer. */
  assetColors?: {
    question?: { textPrimary?: string };
    answers?: { textPrimary?: string; textSecondary?: string; barColors?: string[] };
    subheadline?: { textSecondary?: string };
  };
}

export interface PublicViewerStateRow {
  project_id: string;
  viewer_slug: string;
  state: PublicViewerStateName;
  poll_snapshot: PublicViewerPollSnapshot | null;
  slate_text: string;
  version: number;
  updated_at?: string;
}

/** Write the audience-facing viewer state. Increments version atomically by
 *  fetching the current row first; if no row exists we start at 1. */
export async function writePublicViewerState(params: {
  projectId: string;
  viewerSlug: string;
  state: PublicViewerStateName;
  pollSnapshot?: PublicViewerPollSnapshot | null;
  slateText?: string;
}): Promise<{ error: string | null }> {
  const { projectId, viewerSlug, state, pollSnapshot = null, slateText } = params;

  const { data: existing } = await supabase
    .from('public_viewer_state' as never)
    .select('version')
    .eq('project_id', projectId)
    .maybeSingle();

  const nextVersion = ((existing as { version?: number } | null)?.version ?? 0) + 1;

  const payload: Record<string, unknown> = {
    project_id: projectId,
    viewer_slug: viewerSlug,
    state,
    poll_snapshot: pollSnapshot,
    version: nextVersion,
  };
  if (slateText !== undefined) payload.slate_text = slateText;

  const { error } = await supabase
    .from('public_viewer_state' as never)
    .upsert(payload as never, { onConflict: 'project_id' } as never);

  return { error: error?.message ?? null };
}