ALTER TABLE public.project_live_state
  ADD COLUMN IF NOT EXISTS live_slug text,
  ADD COLUMN IF NOT EXISTS live_poll_id uuid;

CREATE INDEX IF NOT EXISTS idx_project_live_state_live_poll_id
  ON public.project_live_state (live_poll_id);