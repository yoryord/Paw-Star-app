-- Harden trigger functions by setting explicit search_path
-- Date: 2026-03-02

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_blog_pet_tag_ownership()
returns trigger
language plpgsql
set search_path = public
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

create or replace function public.enforce_comment_parent_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_story_id uuid;
begin
  if new.parent_id is not null then
    select c.story_id into parent_story_id
    from public.comments c
    where c.id = new.parent_id;

    if parent_story_id is null then
      raise exception 'Parent comment % does not exist.', new.parent_id;
    end if;

    if parent_story_id <> new.story_id then
      raise exception 'Reply must reference a parent comment from the same story.';
    end if;
  end if;

  return new;
end;
$$;
