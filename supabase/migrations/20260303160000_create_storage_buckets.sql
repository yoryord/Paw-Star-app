-- =============================================================================
-- Migration: Unified Storage Buckets for Paw Star
-- Date: 2026-03-03
--
-- Creates the following buckets (all public-read):
--   1. users-media          → sub-folder: user-profile-pictures/{user_id}/
--   2. pets                 → sub-folder: pet-profile-pictures/{user_id}/
--   3. stories              → sub-folder: story-covers/{user_id}/   (replaces standalone 'story-covers' bucket)
--   4. paw-star-app-admin-media → {user_id}/
--
-- RLS convention: public SELECT; authenticated INSERT/UPDATE/DELETE gated by
-- file-path ownership — the {user_id} folder segment must match auth.uid().
--
-- NOTE: The existing 'story-covers' bucket policies are dropped first.
--       Any files already stored in the 'story-covers' bucket must be
--       migrated to 'stories/story-covers/{user_id}/' at the application level
--       before the old bucket can be safely deleted.
-- =============================================================================


-- =============================================================================
-- Step 1: Remove legacy 'story-covers' bucket policies
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can upload story covers" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update story covers"             ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete story covers"             ON storage.objects;
DROP POLICY IF EXISTS "Public can read story covers"               ON storage.objects;

-- After migrating existing files via the app, run:
--   DELETE FROM storage.buckets WHERE id = 'story-covers';


-- =============================================================================
-- Step 2: Create buckets
-- =============================================================================

-- 1. users-media  (user profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'users-media',
  'users-media',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. pets  (pet profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pets',
  'pets',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. stories  (story cover images — replaces standalone story-covers bucket)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stories',
  'stories',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 4. paw-star-app-admin-media  (app-level / admin media assets)
--    TODO: Once a 'user_roles' table is in place, restrict INSERT/UPDATE/DELETE
--          to users with the 'admin' role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'paw-star-app-admin-media',
  'paw-star-app-admin-media',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- Step 3: RLS policies — users-media
-- Expected path: user-profile-pictures/{user_id}/filename
-- Ownership check: (storage.foldername(name))[2] == auth.uid()
-- =============================================================================

CREATE POLICY "Public can view user media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'users-media');

CREATE POLICY "Authenticated users can upload user media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'users-media'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Owners can update user media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'users-media'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Owners can delete user media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'users-media'
  AND auth.uid()::text = (storage.foldername(name))[2]
);


-- =============================================================================
-- Step 4: RLS policies — pets
-- Expected path: pet-profile-pictures/{user_id}/filename
-- Ownership check: (storage.foldername(name))[2] == auth.uid()
-- =============================================================================

CREATE POLICY "Public can view pet media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pets');

CREATE POLICY "Authenticated users can upload pet media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pets'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Owners can update pet media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pets'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Owners can delete pet media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pets'
  AND auth.uid()::text = (storage.foldername(name))[2]
);


-- =============================================================================
-- Step 5: RLS policies — stories
-- Expected path: story-covers/{user_id}/filename
-- Ownership check: (storage.foldername(name))[2] == auth.uid()
-- =============================================================================

CREATE POLICY "Public can view story media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stories');

CREATE POLICY "Authenticated users can upload story media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stories'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Owners can update story media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'stories'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Owners can delete story media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'stories'
  AND auth.uid()::text = (storage.foldername(name))[2]
);


-- =============================================================================
-- Step 6: RLS policies — paw-star-app-admin-media
-- Expected path: {user_id}/filename  (no sub-folder prefix)
-- Ownership check: (storage.foldername(name))[1] == auth.uid()
-- TODO: tighten INSERT/UPDATE/DELETE to admin role once user_roles table exists.
-- =============================================================================

CREATE POLICY "Public can view admin media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'paw-star-app-admin-media');

CREATE POLICY "Authenticated users can upload admin media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'paw-star-app-admin-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners can update admin media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'paw-star-app-admin-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners can delete admin media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'paw-star-app-admin-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
