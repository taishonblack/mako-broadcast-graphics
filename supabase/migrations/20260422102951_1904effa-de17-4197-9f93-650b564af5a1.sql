UPDATE storage.buckets
SET public = false
WHERE id = 'backgrounds';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Avatar images are publicly accessible'
  ) THEN
    DROP POLICY "Avatar images are publicly accessible" ON storage.objects;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Background images are publicly accessible'
  ) THEN
    DROP POLICY "Background images are publicly accessible" ON storage.objects;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view backgrounds'
  ) THEN
    DROP POLICY "Anyone can view backgrounds" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Users can view their own backgrounds bucket objects"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own backgrounds bucket objects"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own backgrounds bucket objects"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own backgrounds bucket objects"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'backgrounds'
  AND auth.uid()::text = (storage.foldername(name))[1]
);