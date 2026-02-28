-- Paw Star core schema + RLS
-- Date: 2026-02-28

create extension if not exists pgcrypto;

-- Enums
create type public.pet_species as enum ('cat', 'dog');
create type public.blog_status as enum ('draft', 'published');

-- Updated-at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enforce that tagged pets belong to the blog owner
create or replace function public.enforce_blog_pet_tag_ownership()
returns trigger
language plpgsql
as $$
declare
  blog_owner_id uuid;
  pet_owner_id uuid;
begin
  select b.owner_id into blog_owner_id
  from public.blogs b
  where b.id = new.blog_id;

  select p.owner_id into pet_owner_id
  from public.pets p
  where p.id = new.pet_id;

  if blog_owner_id is null then
    raise exception 'Blog % does not exist.', new.blog_id;
  end if;

  if pet_owner_id is null then
    raise exception 'Pet % does not exist.', new.pet_id;
  end if;

  if blog_owner_id <> pet_owner_id then
    raise exception 'Tagged pet must belong to the same owner as the blog.';
  end if;

  return new;
end;
$$;

-- 1:1 extension of auth.users
create table public.users_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  profile_picture_url text,
  avatar text,
  about_me text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  species public.pet_species not null,
  breed text,
  birthdate date check (birthdate is null or birthdate <= current_date),
  birth_place text,
  current_location_city text,
  current_location_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  content text not null check (char_length(trim(content)) > 0),
  status public.blog_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blog_pet_tags (
  blog_id uuid not null references public.blogs(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (blog_id, pet_id)
);

create table public.pet_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pet_id)
);

create table public.blog_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  blog_id uuid not null references public.blogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blog_id)
);

-- Indexes
create index idx_users_profiles_country on public.users_profiles(country);

create index idx_pets_owner_id on public.pets(owner_id);
create index idx_pets_species on public.pets(species);
create index idx_pets_location_country_city on public.pets(current_location_country, current_location_city);

create index idx_blogs_owner_id on public.blogs(owner_id);
create index idx_blogs_status on public.blogs(status);
create index idx_blogs_published_created_at on public.blogs(created_at desc)
  where status = 'published';

create index idx_blog_pet_tags_pet_id on public.blog_pet_tags(pet_id);

create index idx_pet_likes_pet_id on public.pet_likes(pet_id);
create index idx_pet_likes_created_at on public.pet_likes(created_at desc);

create index idx_blog_likes_blog_id on public.blog_likes(blog_id);
create index idx_blog_likes_created_at on public.blog_likes(created_at desc);

-- Triggers
create trigger trg_users_profiles_set_updated_at
before update on public.users_profiles
for each row execute function public.set_updated_at();

create trigger trg_pets_set_updated_at
before update on public.pets
for each row execute function public.set_updated_at();

create trigger trg_blogs_set_updated_at
before update on public.blogs
for each row execute function public.set_updated_at();

create trigger trg_blog_pet_tags_set_updated_at
before update on public.blog_pet_tags
for each row execute function public.set_updated_at();

create trigger trg_blog_pet_tags_ownership
before insert or update on public.blog_pet_tags
for each row execute function public.enforce_blog_pet_tag_ownership();

-- RLS
alter table public.users_profiles enable row level security;
alter table public.pets enable row level security;
alter table public.blogs enable row level security;
alter table public.blog_pet_tags enable row level security;
alter table public.pet_likes enable row level security;
alter table public.blog_likes enable row level security;

-- users_profiles
create policy users_profiles_select_anon
on public.users_profiles
for select
to anon
using (true);

create policy users_profiles_select_authenticated
on public.users_profiles
for select
to authenticated
using (true);

create policy users_profiles_insert_own
on public.users_profiles
for insert
to authenticated
with check (id = auth.uid());

create policy users_profiles_update_own
on public.users_profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy users_profiles_delete_own
on public.users_profiles
for delete
to authenticated
using (id = auth.uid());

-- pets
create policy pets_select_anon
on public.pets
for select
to anon
using (true);

create policy pets_select_authenticated
on public.pets
for select
to authenticated
using (true);

create policy pets_insert_own
on public.pets
for insert
to authenticated
with check (owner_id = auth.uid());

create policy pets_update_own
on public.pets
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy pets_delete_own
on public.pets
for delete
to authenticated
using (owner_id = auth.uid());

-- blogs
create policy blogs_select_anon_published
on public.blogs
for select
to anon
using (status = 'published');

create policy blogs_select_authenticated_published_or_own
on public.blogs
for select
to authenticated
using (status = 'published' or owner_id = auth.uid());

create policy blogs_insert_own
on public.blogs
for insert
to authenticated
with check (owner_id = auth.uid());

create policy blogs_update_own
on public.blogs
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy blogs_delete_own
on public.blogs
for delete
to authenticated
using (owner_id = auth.uid());

-- blog_pet_tags
create policy blog_pet_tags_select_anon_published_blog
on public.blog_pet_tags
for select
to anon
using (
  exists (
    select 1
    from public.blogs b
    where b.id = blog_pet_tags.blog_id
      and b.status = 'published'
  )
);

create policy blog_pet_tags_select_authenticated_published_or_own
on public.blog_pet_tags
for select
to authenticated
using (
  exists (
    select 1
    from public.blogs b
    where b.id = blog_pet_tags.blog_id
      and (b.status = 'published' or b.owner_id = auth.uid())
  )
);

create policy blog_pet_tags_insert_own_blog
on public.blog_pet_tags
for insert
to authenticated
with check (
  exists (
    select 1
    from public.blogs b
    where b.id = blog_pet_tags.blog_id
      and b.owner_id = auth.uid()
  )
);

create policy blog_pet_tags_update_own_blog
on public.blog_pet_tags
for update
to authenticated
using (
  exists (
    select 1
    from public.blogs b
    where b.id = blog_pet_tags.blog_id
      and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.blogs b
    where b.id = blog_pet_tags.blog_id
      and b.owner_id = auth.uid()
  )
);

create policy blog_pet_tags_delete_own_blog
on public.blog_pet_tags
for delete
to authenticated
using (
  exists (
    select 1
    from public.blogs b
    where b.id = blog_pet_tags.blog_id
      and b.owner_id = auth.uid()
  )
);

-- pet_likes
create policy pet_likes_select_anon
on public.pet_likes
for select
to anon
using (true);

create policy pet_likes_select_authenticated
on public.pet_likes
for select
to authenticated
using (true);

create policy pet_likes_insert_self
on public.pet_likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy pet_likes_delete_self
on public.pet_likes
for delete
to authenticated
using (user_id = auth.uid());

-- blog_likes
create policy blog_likes_select_anon
on public.blog_likes
for select
to anon
using (true);

create policy blog_likes_select_authenticated
on public.blog_likes
for select
to authenticated
using (true);

create policy blog_likes_insert_self
on public.blog_likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy blog_likes_delete_self
on public.blog_likes
for delete
to authenticated
using (user_id = auth.uid());

-- Grants (column-level visibility for anon users_profiles)
revoke all on table public.users_profiles from anon;
revoke all on table public.users_profiles from authenticated;

grant select (name) on table public.users_profiles to anon;
grant select, insert, update, delete on table public.users_profiles to authenticated;

grant select on table public.pets to anon;
grant select on table public.blogs to anon;
grant select on table public.blog_pet_tags to anon;
grant select on table public.pet_likes to anon;
grant select on table public.blog_likes to anon;

grant select, insert, update, delete on table public.pets to authenticated;
grant select, insert, update, delete on table public.blogs to authenticated;
grant select, insert, update, delete on table public.blog_pet_tags to authenticated;
grant select, insert, delete on table public.pet_likes to authenticated;
grant select, insert, delete on table public.blog_likes to authenticated;
