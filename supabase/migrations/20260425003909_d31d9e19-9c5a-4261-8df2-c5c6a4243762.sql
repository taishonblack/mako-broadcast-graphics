ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS slate_text text NOT NULL DEFAULT 'Polling will open soon',
  ADD COLUMN IF NOT EXISTS slate_image text,
  ADD COLUMN IF NOT EXISTS slate_text_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS slate_subline_text text NOT NULL DEFAULT 'Stay tuned — the poll will open soon.',
  ADD COLUMN IF NOT EXISTS slate_subline_style jsonb NOT NULL DEFAULT '{}'::jsonb;