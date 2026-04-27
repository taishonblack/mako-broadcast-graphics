ALTER TABLE public.poll_scene_assets
ADD COLUMN IF NOT EXISTS transform jsonb NOT NULL DEFAULT '{}'::jsonb;