-- 1. Add a column for the audience-shaped snapshot. Operator writes this
--    alongside live_poll_snapshot; trigger mirrors it to public_viewer_state.
ALTER TABLE public.project_live_state
  ADD COLUMN IF NOT EXISTS live_audience_snapshot jsonb;

-- 2. Sync function: keeps public_viewer_state mirrored to project_live_state.
CREATE OR REPLACE FUNCTION public.sync_public_viewer_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_state text;
  _target_slug text;
  _target_snapshot jsonb;
  _existing_version int;
BEGIN
  -- Only react when one of the mirrored fields actually changed.
  IF TG_OP = 'UPDATE' AND
     NEW.active_poll_id IS NOT DISTINCT FROM OLD.active_poll_id AND
     NEW.live_poll_id IS NOT DISTINCT FROM OLD.live_poll_id AND
     NEW.live_slug IS NOT DISTINCT FROM OLD.live_slug AND
     NEW.voting_state IS NOT DISTINCT FROM OLD.voting_state AND
     NEW.live_audience_snapshot IS NOT DISTINCT FROM OLD.live_audience_snapshot
  THEN
    RETURN NEW;
  END IF;

  -- Derive audience state from voting_state.
  IF NEW.voting_state = 'open' AND NEW.active_poll_id IS NOT NULL THEN
    _target_state := 'voting';
    _target_slug := NEW.live_slug;
    _target_snapshot := NEW.live_audience_snapshot;
  ELSIF NEW.voting_state = 'closed' THEN
    _target_state := 'closed';
    _target_slug := NEW.live_slug;
    _target_snapshot := NULL;
  ELSE
    -- not_open / unknown / cleared poll → branding, clear stale slug+snapshot.
    _target_state := 'branding';
    _target_slug := NEW.live_slug;
    _target_snapshot := NULL;
  END IF;

  -- Need a slug to address public_viewer_state. If none, nothing to mirror.
  IF _target_slug IS NULL OR _target_slug = '' THEN
    RETURN NEW;
  END IF;

  SELECT version INTO _existing_version
  FROM public.public_viewer_state
  WHERE project_id = NEW.project_id;

  INSERT INTO public.public_viewer_state AS pvs
    (project_id, viewer_slug, state, poll_snapshot, version, updated_by)
  VALUES
    (NEW.project_id, _target_slug, _target_state, _target_snapshot,
     COALESCE(_existing_version, 0) + 1, NEW.updated_by)
  ON CONFLICT (project_id) DO UPDATE
    SET viewer_slug   = EXCLUDED.viewer_slug,
        state         = EXCLUDED.state,
        poll_snapshot = EXCLUDED.poll_snapshot,
        version       = pvs.version + 1,
        updated_by    = EXCLUDED.updated_by,
        updated_at    = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_viewer_state ON public.project_live_state;
CREATE TRIGGER trg_sync_public_viewer_state
AFTER INSERT OR UPDATE OF active_poll_id, live_poll_id, live_slug, voting_state, live_audience_snapshot
ON public.project_live_state
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_viewer_state();

-- 3. Drift detection helper for operator UI.
CREATE OR REPLACE FUNCTION public.viewer_state_drift(_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'project_id', pls.project_id,
    'live_slug', pls.live_slug,
    'live_poll_id', pls.live_poll_id,
    'active_poll_id', pls.active_poll_id,
    'voting_state', pls.voting_state,
    'audience_slug', pvs.viewer_slug,
    'audience_state', pvs.state,
    'audience_poll_id', pvs.poll_snapshot->>'id',
    'drift', (
      pls.live_slug IS DISTINCT FROM pvs.viewer_slug
      OR (pls.voting_state = 'open' AND pvs.state <> 'voting')
      OR (pls.voting_state = 'closed' AND pvs.state <> 'closed')
      OR (pls.voting_state NOT IN ('open','closed') AND pvs.state <> 'branding')
      OR (pls.active_poll_id IS NOT NULL
          AND pls.voting_state = 'open'
          AND (pvs.poll_snapshot->>'id') IS DISTINCT FROM pls.active_poll_id::text)
    )
  )
  FROM public.project_live_state pls
  LEFT JOIN public.public_viewer_state pvs ON pvs.project_id = pls.project_id
  WHERE pls.project_id = _project_id;
$$;