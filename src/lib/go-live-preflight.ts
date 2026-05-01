import { supabase } from '@/integrations/supabase/client';

/**
 * Pre-flight validation for Go Live / Open Voting.
 *
 * The contract is simple: if any check fails we MUST block the operator
 * from flipping `voting_state = 'open'`, because the live pipeline only
 * works when every one of these invariants holds:
 *
 *   1. There is an active poll object in the workspace.
 *   2. That poll has a real DB UUID (not a draft string id).
 *   3. A non-empty viewer slug exists (so /vote/:slug resolves).
 *   4. The Voter Selection scene has at least 2 non-empty choices AND
 *      those choices are mirrored into `poll_answers` rows. Without this
 *      `cast_vote` rejects every vote as `invalid_answer` and Statistics
 *      shows an empty tally.
 *   5. `public_viewer_state` can be written for the project (i.e. there
 *      IS a project_id — RLS will then allow the upsert if the operator
 *      owns the project).
 *   6. `project_live_state.active_poll_id` can be written for the project.
 *
 * Steps 4–6 do live DB reads; the rest are local checks so the dialog can
 * render synchronously on first open.
 */

export type PreflightCheckKey =
  | 'active_poll'
  | 'poll_uuid'
  | 'viewer_slug'
  | 'scene_choices'
  | 'poll_answers_synced'
  | 'public_viewer_state'
  | 'project_live_state';

export interface PreflightCheck {
  key: PreflightCheckKey;
  label: string;
  ok: boolean;
  /** Short user-facing reason when `ok === false`. */
  detail?: string;
}

export interface PreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
  /** True iff the only failing check is `poll_answers_synced` AND the
   *  scene already has ≥2 non-empty choices. In that case the operator
   *  can press "Sync Answers and Try Again" to auto-recover. */
  canSyncAndRetry: boolean;
}

export interface PreflightInput {
  /** Operator's currently-edited poll. */
  pollId: string | null | undefined;
  /** Viewer slug (the `/vote/:slug` segment). */
  viewerSlug: string | null | undefined;
  /** Project the poll belongs to. Required for Cloud writes. */
  projectId: string | null | undefined;
  /** Voter Selection scene choices as the operator sees them. We only
   *  count entries with non-empty trimmed text. */
  sceneAnswers: Array<{ id: string | number; text: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v?: string | null) => Boolean(v && UUID_RE.test(v));

function trimmedSceneChoices(answers: PreflightInput['sceneAnswers']): string[] {
  return answers.map((a) => (a.text ?? '').trim()).filter((t) => t.length > 0);
}

export async function runGoLivePreflight(input: PreflightInput): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  // 1. Active poll exists in the workspace.
  const hasPoll = Boolean(input.pollId);
  checks.push({
    key: 'active_poll',
    label: 'Active poll selected in workspace',
    ok: hasPoll,
    detail: hasPoll ? undefined : 'No poll is currently loaded.',
  });

  // 2. Poll has a real UUID.
  const hasUuid = isUuid(input.pollId ?? undefined);
  checks.push({
    key: 'poll_uuid',
    label: 'Poll has a saved database id',
    ok: hasUuid,
    detail: hasUuid ? undefined : 'Save the poll first so it gets a real id.',
  });

  // 3. Viewer slug exists.
  const slug = (input.viewerSlug ?? '').trim();
  const hasSlug = slug.length > 0 && slug !== 'your-poll-slug';
  checks.push({
    key: 'viewer_slug',
    label: 'Viewer slug is set',
    ok: hasSlug,
    detail: hasSlug ? undefined : 'Set a /vote/:slug value before going live.',
  });

  // 4a. Scene has at least 2 non-empty choices.
  const sceneChoices = trimmedSceneChoices(input.sceneAnswers);
  const enoughSceneChoices = sceneChoices.length >= 2;
  checks.push({
    key: 'scene_choices',
    label: 'Voter Selection has at least 2 choices',
    ok: enoughSceneChoices,
    detail: enoughSceneChoices
      ? undefined
      : `Scene has ${sceneChoices.length} non-empty choice(s); need at least 2.`,
  });

  // 4b. poll_answers in DB matches the scene choices.
  let answersSyncedOk = false;
  let answersSyncedDetail: string | undefined;
  if (hasUuid) {
    const { data, error } = await supabase
      .from('poll_answers' as never)
      .select('label')
      .eq('poll_id', input.pollId as string)
      .order('sort_order', { ascending: true });
    if (error) {
      answersSyncedDetail = `Could not read poll_answers: ${error.message}`;
    } else {
      const dbLabels = ((data ?? []) as Array<{ label: string }>).map((r) => (r.label ?? '').trim());
      if (dbLabels.length < 2) {
        answersSyncedDetail = `Only ${dbLabels.length} poll_answers row(s) exist; need at least 2.`;
      } else if (enoughSceneChoices) {
        // Compare label sets — order doesn't matter, but every scene
        // choice MUST exist in poll_answers so cast_vote accepts the
        // matching answer_id from the audience snapshot.
        const missing = sceneChoices.filter((label) => !dbLabels.includes(label));
        if (missing.length > 0) {
          answersSyncedDetail = `Scene choice(s) missing from poll_answers: ${missing.join(', ')}.`;
        } else {
          answersSyncedOk = true;
        }
      } else {
        // Scene check already failed — surface the same root cause.
        answersSyncedDetail = 'Scene choices must be filled in before sync.';
      }
    }
  } else {
    answersSyncedDetail = 'Poll must be saved before answers can be synced.';
  }
  checks.push({
    key: 'poll_answers_synced',
    label: 'Scene choices match poll_answers in database',
    ok: answersSyncedOk,
    detail: answersSyncedOk ? undefined : answersSyncedDetail,
  });

  // 5. public_viewer_state can receive a snapshot — i.e. project_id is
  //    known. RLS will reject the upsert if the operator doesn't own the
  //    project, but that's a separate failure mode we surface at write
  //    time; here we just guarantee the addressable key exists.
  const hasProjectForPvs = Boolean(input.projectId);
  checks.push({
    key: 'public_viewer_state',
    label: 'Audience state target (project_id) is known',
    ok: hasProjectForPvs,
    detail: hasProjectForPvs ? undefined : 'Save the poll into a project first.',
  });

  // 6. project_live_state.active_poll_id can be written.
  const canWriteLiveState = Boolean(input.projectId);
  checks.push({
    key: 'project_live_state',
    label: 'Live state target (project_id) is known',
    ok: canWriteLiveState,
    detail: canWriteLiveState ? undefined : 'Save the poll into a project first.',
  });

  const allOk = checks.every((c) => c.ok);
  // The "Sync and retry" button is only meaningful when sync is the ONE
  // remaining problem and the scene actually has choices to push.
  const onlySyncFailing =
    !allOk &&
    checks.filter((c) => !c.ok).length === 1 &&
    !answersSyncedOk &&
    enoughSceneChoices &&
    hasUuid;

  return { ok: allOk, checks, canSyncAndRetry: onlySyncFailing };
}

/**
 * Push the operator's scene choices into `poll_answers` via the
 * `sync_poll_answers` RPC. Returns true on success; toasts/logs the error
 * on failure.
 */
export async function syncSceneAnswersToPollAnswers(input: {
  pollId: string;
  sceneAnswers: Array<{ id: string | number; text: string; shortLabel?: string }>;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(input.pollId)) {
    return { ok: false, error: 'Poll must be saved before syncing answers.' };
  }
  const optionsForSync = input.sceneAnswers
    .map((o, i) => ({
      client_id: String(o.id),
      label: (o.text ?? '').trim() || `Answer ${i + 1}`,
      shortLabel: o.shortLabel ?? '',
    }));
  const { error } = await supabase.rpc(
    'sync_poll_answers' as never,
    { _poll_id: input.pollId, _options: optionsForSync as never } as never,
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}