-- Create a public bucket for story cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-covers',
  'story-covers',
  true,
  5242880,   -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own cover images
CREATE POLICY "Authenticated users can upload story covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'story-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update/replace their own covers
CREATE POLICY "Owners can update story covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'story-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own covers
CREATE POLICY "Owners can delete story covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'story-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to read public covers
CREATE POLICY "Public can read story covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'story-covers');
