-- =========================================================
-- LOGOS
-- =========================================================
CREATE TABLE public.logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  created_by UUID,
  name TEXT NOT NULL DEFAULT 'Untitled',
  file_path TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_path TEXT,
  thumbnail_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own logos"
  ON public.logos FOR SELECT
  USING ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE POLICY "Users insert own logos"
  ON public.logos FOR INSERT
  WITH CHECK ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE POLICY "Users update own logos"
  ON public.logos FOR UPDATE
  USING ((auth.uid() = account_id) OR (auth.uid() = user_id))
  WITH CHECK ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE POLICY "Users delete own logos"
  ON public.logos FOR DELETE
  USING ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE TRIGGER logos_set_updated_at
BEFORE UPDATE ON public.logos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- IMAGES
-- =========================================================
CREATE TABLE public.images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  created_by UUID,
  name TEXT NOT NULL DEFAULT 'Untitled',
  file_path TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_path TEXT,
  thumbnail_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own images"
  ON public.images FOR SELECT
  USING ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE POLICY "Users insert own images"
  ON public.images FOR INSERT
  WITH CHECK ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE POLICY "Users update own images"
  ON public.images FOR UPDATE
  USING ((auth.uid() = account_id) OR (auth.uid() = user_id))
  WITH CHECK ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE POLICY "Users delete own images"
  ON public.images FOR DELETE
  USING ((auth.uid() = account_id) OR (auth.uid() = user_id));

CREATE TRIGGER images_set_updated_at
BEFORE UPDATE ON public.images
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', false)
ON CONFLICT (id) DO NOTHING;

-- LOGOS bucket policies (path = "<user_id>/...")
CREATE POLICY "Users view own logo files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own logo files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own logo files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own logo files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- IMAGES bucket policies
CREATE POLICY "Users view own image files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own image files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own image files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own image files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);