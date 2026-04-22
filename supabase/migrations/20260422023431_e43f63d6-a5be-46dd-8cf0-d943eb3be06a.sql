
-- 1. block_position on polls
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS block_position integer
    CHECK (block_position IS NULL OR (block_position BETWEEN 1 AND 99));

-- 2. backgrounds table (account media library)
CREATE TABLE IF NOT EXISTS public.backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled',
  image_url text NOT NULL,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own backgrounds"
  ON public.backgrounds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own backgrounds"
  ON public.backgrounds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own backgrounds"
  ON public.backgrounds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own backgrounds"
  ON public.backgrounds FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER backgrounds_touch_updated_at
  BEFORE UPDATE ON public.backgrounds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_backgrounds_user_id ON public.backgrounds(user_id);

-- 3. storage bucket for backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Background images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'backgrounds');

CREATE POLICY "Users upload to own background folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own background files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own background files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
