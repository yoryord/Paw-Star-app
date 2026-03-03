-- Add cover_image_url column to stories table
-- Allows stories to have an optional cover/banner image
alter table public.stories
  add column cover_image_url text;
