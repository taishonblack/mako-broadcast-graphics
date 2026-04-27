ALTER TABLE public.project_live_state
  ADD COLUMN IF NOT EXISTS preview_scene text NOT NULL DEFAULT 'question_qr',
  ADD COLUMN IF NOT EXISTS program_scene text NOT NULL DEFAULT 'question_qr',
  ADD COLUMN IF NOT EXISTS transition_state text NOT NULL DEFAULT 'idle';

-- transition_type column already exists; ensure default is sane
ALTER TABLE public.project_live_state
  ALTER COLUMN transition_type SET DEFAULT 'take';