-- Grant SELECT on id column of users_profiles to anon role
-- This allows anonymous users to read user profile IDs (e.g. for joins with pets/stories)
grant select (id) on table public.users_profiles to anon;
