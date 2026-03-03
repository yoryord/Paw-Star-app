-- Create folder placeholders in storage buckets
-- Folders in Supabase Storage are virtual; they are represented by placeholder objects

INSERT INTO storage.objects (bucket_id, name, owner, metadata, version)
VALUES
  -- users-media / user-profile-pictures/
  (
    'users-media',
    'user-profile-pictures/.emptykeep',
    NULL,
    '{"mimetype": "application/octet-stream", "size": 0}'::jsonb,
    gen_random_uuid()::text
  ),
  -- pets / pet-profile-pictures/
  (
    'pets',
    'pet-profile-pictures/.emptykeep',
    NULL,
    '{"mimetype": "application/octet-stream", "size": 0}'::jsonb,
    gen_random_uuid()::text
  ),
  -- stories / stories-covers-pictures/
  (
    'stories',
    'stories-covers-pictures/.emptykeep',
    NULL,
    '{"mimetype": "application/octet-stream", "size": 0}'::jsonb,
    gen_random_uuid()::text
  )
ON CONFLICT DO NOTHING;
