-- Migration: add pet_picture_url column to public.pets
-- Date: 2026-03-02
-- Description: Adds a nullable text column to store the URL/path of a pet's
--              profile picture (stored in Supabase Storage).

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS pet_picture_url TEXT NULL;

COMMENT ON COLUMN public.pets.pet_picture_url
  IS 'URL or storage path of the pet profile picture (Supabase Storage).';
