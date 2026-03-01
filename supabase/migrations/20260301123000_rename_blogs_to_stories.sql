-- Rename blogs domain objects to stories naming
-- Date: 2026-03-01

-- Tables
alter table public.blogs rename to stories;
alter table public.blog_likes rename to story_likes;
alter table public.blog_pet_tags rename to story_pet_tags;

-- Columns
alter table public.story_likes rename column blog_id to story_id;
alter table public.story_pet_tags rename column blog_id to story_id;

-- Indexes
alter index public.idx_blogs_owner_id rename to idx_stories_owner_id;
alter index public.idx_blogs_status rename to idx_stories_status;
alter index public.idx_blogs_published_created_at rename to idx_stories_published_created_at;
alter index public.idx_blog_likes_blog_id rename to idx_story_likes_story_id;
alter index public.idx_blog_likes_created_at rename to idx_story_likes_created_at;
alter index public.idx_blog_pet_tags_pet_id rename to idx_story_pet_tags_pet_id;

-- Triggers
alter trigger trg_blogs_set_updated_at on public.stories rename to trg_stories_set_updated_at;
alter trigger trg_blog_pet_tags_set_updated_at on public.story_pet_tags rename to trg_story_pet_tags_set_updated_at;
alter trigger trg_blog_pet_tags_ownership on public.story_pet_tags rename to trg_story_pet_tags_ownership;

-- Trigger function body references renamed table/column
create or replace function public.enforce_blog_pet_tag_ownership()
returns trigger
language plpgsql
as $$
declare
  story_owner_id uuid;
  pet_owner_id uuid;
begin
  select s.owner_id into story_owner_id
  from public.stories s
  where s.id = new.story_id;

  select p.owner_id into pet_owner_id
  from public.pets p
  where p.id = new.pet_id;

  if story_owner_id is null then
    raise exception 'Story % does not exist.', new.story_id;
  end if;

  if pet_owner_id is null then
    raise exception 'Pet % does not exist.', new.pet_id;
  end if;

  if story_owner_id <> pet_owner_id then
    raise exception 'Tagged pet must belong to the same owner as the story.';
  end if;

  return new;
end;
$$;

-- Policies (rename only)
alter policy blogs_select_anon_published on public.stories
  rename to stories_select_anon_published;
alter policy blogs_select_authenticated_published_or_own on public.stories
  rename to stories_select_authenticated_published_or_own;
alter policy blogs_insert_own on public.stories
  rename to stories_insert_own;
alter policy blogs_update_own on public.stories
  rename to stories_update_own;
alter policy blogs_delete_own on public.stories
  rename to stories_delete_own;

alter policy blog_pet_tags_select_anon_published_blog on public.story_pet_tags
  rename to story_pet_tags_select_anon_published_story;
alter policy blog_pet_tags_select_authenticated_published_or_own on public.story_pet_tags
  rename to story_pet_tags_select_authenticated_published_or_own;
alter policy blog_pet_tags_insert_own_blog on public.story_pet_tags
  rename to story_pet_tags_insert_own_story;
alter policy blog_pet_tags_update_own_blog on public.story_pet_tags
  rename to story_pet_tags_update_own_story;
alter policy blog_pet_tags_delete_own_blog on public.story_pet_tags
  rename to story_pet_tags_delete_own_story;

alter policy blog_likes_select_anon on public.story_likes
  rename to story_likes_select_anon;
alter policy blog_likes_select_authenticated on public.story_likes
  rename to story_likes_select_authenticated;
alter policy blog_likes_insert_self on public.story_likes
  rename to story_likes_insert_self;
alter policy blog_likes_delete_self on public.story_likes
  rename to story_likes_delete_self;