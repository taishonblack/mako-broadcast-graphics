ALTER TABLE public.project_live_state
ADD COLUMN IF NOT EXISTS live_poll_snapshot jsonb,
ADD COLUMN IF NOT EXISTS live_folder_id text;