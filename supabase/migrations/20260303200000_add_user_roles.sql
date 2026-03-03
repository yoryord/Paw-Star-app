-- User roles: enum, table, is_admin() helper, and RLS policies
-- Admins receive full write access to all app tables
-- Date: 2026-03-03

-- ---------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------
create type public.app_role as enum ('user', 'admin');

-- ---------------------------------------------------------------
-- 2. Table  (one role per user; defaults to 'user')
-- ---------------------------------------------------------------
create table public.user_roles (
  user_id   uuid             primary key references auth.users(id) on delete cascade,
  user_role public.app_role  not null default 'user'
);

create index idx_user_roles_user_role on public.user_roles(user_role);

-- ---------------------------------------------------------------
-- 3. Helper: is_admin()
--    SECURITY DEFINER so it can read user_roles bypassing RLS.
--    search_path is locked to 'public' to prevent search-path injection.
-- ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id  = auth.uid()
      and user_role = 'admin'
  );
$$;

-- ---------------------------------------------------------------
-- 4. RLS on user_roles
-- ---------------------------------------------------------------
alter table public.user_roles enable row level security;

-- Everyone (anon + authenticated) can read user_roles
create policy user_roles_select_anon
on public.user_roles
for select
to anon
using (true);

create policy user_roles_select_authenticated
on public.user_roles
for select
to authenticated
using (true);

-- Only admins can insert / update / delete rows
create policy user_roles_insert_admin
on public.user_roles
for insert
to authenticated
with check (public.is_admin());

create policy user_roles_update_admin
on public.user_roles
for update
to authenticated
using  (public.is_admin())
with check (public.is_admin());

create policy user_roles_delete_admin
on public.user_roles
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------
-- 5. Grants for user_roles
-- ---------------------------------------------------------------
grant select                          on table public.user_roles to anon;
grant select, insert, update, delete  on table public.user_roles to authenticated;

-- ---------------------------------------------------------------
-- 6. Admin override policies for all existing app tables
--    Each policy is additive (OR) to the existing user-scoped
--    policies — an admin row always satisfies the USING / WITH CHECK
--    expression regardless of ownership.
-- ---------------------------------------------------------------

-- users_profiles ---------------------------------------------------
create policy users_profiles_update_admin
on public.users_profiles
for update
to authenticated
using     (public.is_admin())
with check (public.is_admin());

create policy users_profiles_delete_admin
on public.users_profiles
for delete
to authenticated
using (public.is_admin());

-- pets -------------------------------------------------------------
create policy pets_update_admin
on public.pets
for update
to authenticated
using     (public.is_admin())
with check (public.is_admin());

create policy pets_delete_admin
on public.pets
for delete
to authenticated
using (public.is_admin());

-- stories ----------------------------------------------------------
-- Admins can also read draft stories that belong to other users.
create policy stories_select_admin_all
on public.stories
for select
to authenticated
using (public.is_admin());

create policy stories_update_admin
on public.stories
for update
to authenticated
using     (public.is_admin())
with check (public.is_admin());

create policy stories_delete_admin
on public.stories
for delete
to authenticated
using (public.is_admin());

-- story_pet_tags ---------------------------------------------------
create policy story_pet_tags_insert_admin
on public.story_pet_tags
for insert
to authenticated
with check (public.is_admin());

create policy story_pet_tags_update_admin
on public.story_pet_tags
for update
to authenticated
using     (public.is_admin())
with check (public.is_admin());

create policy story_pet_tags_delete_admin
on public.story_pet_tags
for delete
to authenticated
using (public.is_admin());

-- pet_likes --------------------------------------------------------
create policy pet_likes_delete_admin
on public.pet_likes
for delete
to authenticated
using (public.is_admin());

-- story_likes ------------------------------------------------------
create policy story_likes_delete_admin
on public.story_likes
for delete
to authenticated
using (public.is_admin());

-- comments ---------------------------------------------------------
create policy comments_insert_admin
on public.comments
for insert
to authenticated
with check (public.is_admin());

create policy comments_update_admin
on public.comments
for update
to authenticated
using     (public.is_admin())
with check (public.is_admin());

create policy comments_delete_admin
on public.comments
for delete
to authenticated
using (public.is_admin());

-- comment_likes ----------------------------------------------------
create policy comment_likes_delete_admin
on public.comment_likes
for delete
to authenticated
using (public.is_admin());
