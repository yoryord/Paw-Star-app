-- Add comments table with threaded replies, constraints, indexes and RLS
-- Date: 2026-03-02

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_parent_not_self check (parent_id is null or parent_id <> id)
);

create or replace function public.enforce_comment_parent_integrity()
returns trigger
language plpgsql
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

create trigger trg_comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create trigger trg_comments_parent_integrity
before insert or update on public.comments
for each row execute function public.enforce_comment_parent_integrity();

-- Helpful indexes for story threads, user activity and reply lookups
create index idx_comments_story_id on public.comments(story_id);
create index idx_comments_user_id on public.comments(user_id);
create index idx_comments_parent_id on public.comments(parent_id);
create index idx_comments_story_parent_created_at on public.comments(story_id, parent_id, created_at desc);
create index idx_comments_story_created_at on public.comments(story_id, created_at desc);

create table public.comment_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index idx_comment_likes_comment_id on public.comment_likes(comment_id);
create index idx_comment_likes_created_at on public.comment_likes(created_at desc);

-- RLS
alter table public.comments enable row level security;

-- Everyone can view comments
create policy comments_select_anon
on public.comments
for select
to anon
using (true);

create policy comments_select_authenticated
on public.comments
for select
to authenticated
using (true);

-- Authenticated users can manage only their own comments
-- Insert is additionally restricted to published stories
create policy comments_insert_own_on_published_story
on public.comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.stories s
    where s.id = comments.story_id
      and s.status = 'published'
  )
);

create policy comments_update_own
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy comments_delete_own
on public.comments
for delete
to authenticated
using (user_id = auth.uid());

-- comment_likes
alter table public.comment_likes enable row level security;

create policy comment_likes_select_anon
on public.comment_likes
for select
to anon
using (true);

create policy comment_likes_select_authenticated
on public.comment_likes
for select
to authenticated
using (true);

create policy comment_likes_insert_self
on public.comment_likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy comment_likes_delete_self
on public.comment_likes
for delete
to authenticated
using (user_id = auth.uid());

-- Grants
grant select on table public.comments to anon;
grant select, insert, update, delete on table public.comments to authenticated;

grant select on table public.comment_likes to anon;
grant select, insert, delete on table public.comment_likes to authenticated;
