ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.projects
SET last_used_at = COALESCE(updated_at, created_at, now())
WHERE last_used_at IS NULL;