-- Add block assignment columns to polls
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS block_letter text,
  ADD COLUMN IF NOT EXISTS block_label text;

-- Constrain block_letter to A-E (or NULL = unassigned)
ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_block_letter_check;
ALTER TABLE public.polls
  ADD CONSTRAINT polls_block_letter_check
  CHECK (block_letter IS NULL OR block_letter IN ('A','B','C','D','E'));

-- Helpful index for grouping polls by project + block
CREATE INDEX IF NOT EXISTS polls_project_block_idx
  ON public.polls (project_id, block_letter);