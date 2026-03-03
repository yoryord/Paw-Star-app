-- Allow AVIF image uploads in the stories bucket
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'image/avif')
WHERE id = 'stories'
  AND NOT ('image/avif' = ANY(allowed_mime_types));

-- Allow AVIF image uploads in the pets bucket (for consistency)
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'image/avif')
WHERE id = 'pets'
  AND NOT ('image/avif' = ANY(allowed_mime_types));
