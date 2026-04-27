import { supabase } from '@/integrations/supabase/client';

/**
 * Broadcast scene state — independent of voting state.
 *
 * The operator stages a scene on `preview_scene` then commits it to
 * `program_scene` via TAKE (animated) or CUT (instant). Switching scenes
 * MUST NOT change `voting_state` or `live_poll_snapshot` — viewers keep
 * voting through scene changes (e.g. Question+QR → Live Results while
 * voting is still open).
 *
 * Voting helpers (openVoting / closeVoting / endSession) live here too so
 * operator UI has a single import surface, but they only touch voting
 * fields + the public viewer mirror — never the scene fields.
 */

export type SceneName = 'question_qr' | 'live_results' | 'final_results' | 'lower_third' | 'custom';
export type TransitionType = 'take' | 'cut';
export type TransitionState = 'idle' | 'transitioning';
export type VotingStateName = 'not_open' | 'open' | 'closed';

const TAKE_DURATION_MS = 350;

/** Stage a scene on the preview monitor. Does NOT affect program output. */
export async function setPreviewScene(projectId: string, scene: SceneName) {
  const { error } = await supabase
    .from('project_live_state' as never)
    .upsert(
      { project_id: projectId, preview_scene: scene } as never,
      { onConflict: 'project_id' } as never,
    );
  return { error: error?.message ?? null };
}

/** CUT — commit preview to program instantly. */
export async function cutToProgram(projectId: string, scene: SceneName) {
  const { error } = await supabase
    .from('project_live_state' as never)
    .upsert(
      {
        project_id: projectId,
        preview_scene: scene,
        program_scene: scene,
        transition_type: 'cut',
        transition_state: 'idle',
      } as never,
      { onConflict: 'project_id' } as never,
    );
  return { error: error?.message ?? null };
}

/** TAKE — commit preview to program with a brief transition animation. */
export async function takeToProgram(projectId: string, scene: SceneName) {
  // Mark transitioning, flip program_scene, then settle to idle.
  const startErr = await supabase
    .from('project_live_state' as never)
    .upsert(
      {
        project_id: projectId,
        preview_scene: scene,
        program_scene: scene,
        transition_type: 'take',
        transition_state: 'transitioning',
      } as never,
      { onConflict: 'project_id' } as never,
    );
  if (startErr.error) return { error: startErr.error.message };

  setTimeout(() => {
    void supabase
      .from('project_live_state' as never)
      .update({ transition_state: 'idle' } as never)
      .eq('project_id', projectId);
  }, TAKE_DURATION_MS);

  return { error: null };
}

/** Open voting — viewers can vote. Does NOT touch scene fields. */
export async function openVoting(projectId: string) {
  const { error } = await supabase
    .from('project_live_state' as never)
    .upsert(
      { project_id: projectId, voting_state: 'open' } as never,
      { onConflict: 'project_id' } as never,
    );
  return { error: error?.message ?? null };
}

/** Close voting — viewers see closed/thank-you. Does NOT touch scene fields. */
export async function closeVoting(projectId: string) {
  const { error } = await supabase
    .from('project_live_state' as never)
    .upsert(
      { project_id: projectId, voting_state: 'closed' } as never,
      { onConflict: 'project_id' } as never,
    );
  return { error: error?.message ?? null };
}

/** End session — clears snapshot and resets voting. Does NOT touch scene. */
export async function endVotingSession(projectId: string) {
  const { error } = await supabase
    .from('project_live_state' as never)
    .upsert(
      {
        project_id: projectId,
        voting_state: 'not_open',
        live_poll_snapshot: null,
      } as never,
      { onConflict: 'project_id' } as never,
    );
  return { error: error?.message ?? null };
}