-- Admin RPC helpers for the Admin Panel page
-- These functions run as SECURITY DEFINER (postgres superuser) so they can
-- read auth.users and perform privileged writes.  Access is gated by is_admin().
-- Date: 2026-03-04

-- ---------------------------------------------------------------
-- 1. get_admin_users()
--    Returns all auth.users joined with public.users_profiles and
--    public.user_roles.  Only callable by admins.
-- ---------------------------------------------------------------
create or replace function public.get_admin_users()
returns table (
  id               uuid,
  email            text,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  name             text,
  user_role        text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  return query
    select
      u.id,
      u.email::text,
      u.created_at,
      u.last_sign_in_at,
      coalesce(p.name, '') as name,
      coalesce(r.user_role::text, 'user')     as user_role
    from auth.users u
    left join public.users_profiles p on p.id = u.id
    left join public.user_roles     r on r.user_id = u.id
    order by u.created_at desc;
end;
$$;

grant execute on function public.get_admin_users() to authenticated;

-- ---------------------------------------------------------------
-- 2. admin_delete_user(target_user_id)
--    Hard-deletes a user from auth.users (cascade handles the rest).
--    Admins cannot delete themselves.
-- ---------------------------------------------------------------
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Admins cannot delete their own account';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 3. admin_set_user_role(target_user_id, new_role)
--    Upserts a row in public.user_roles.
-- ---------------------------------------------------------------
create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  if target_user_id = auth.uid() and new_role <> 'admin' then
    raise exception 'Admins cannot remove their own admin role';
  end if;

  insert into public.user_roles (user_id, user_role)
    values (target_user_id, new_role::public.app_role)
  on conflict (user_id) do update
    set user_role = excluded.user_role;
end;
$$;

grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
