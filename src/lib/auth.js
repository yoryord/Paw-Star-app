import { supabaseClient } from './supabase.js';

/**
 * Supabase-backed auth helpers.
 * `_session` is an in-memory cache kept fresh by onAuthStateChange.
 * Call `initAuth()` once at app startup before rendering any route.
 */

let _session = null;
let _profileName = null;
let _isAdmin = false;

/** Fetch and cache the display name from public.users_profiles. */
const loadProfileName = async (userId) => {
  if (!userId) { _profileName = null; return; }
  const { data } = await supabaseClient
    .from('users_profiles')
    .select('name')
    .eq('id', userId)
    .maybeSingle();
  _profileName = data?.name ?? null;
};

/** Fetch and cache the admin role status from public.user_roles. */
const loadAdminStatus = async (userId) => {
  if (!userId) { _isAdmin = false; return; }
  const { data } = await supabaseClient
    .from('user_roles')
    .select('user_role')
    .eq('user_id', userId)
    .maybeSingle();
  _isAdmin = data?.user_role === 'admin';
};

/**
 * Bootstrap: load the current Supabase session and subscribe to changes.
 * Must be awaited before the router renders the first page.
 */
export const initAuth = async () => {
  const { data } = await supabaseClient.auth.getSession();
  _session = data.session ?? null;
  await Promise.all([
    loadProfileName(_session?.user?.id),
    loadAdminStatus(_session?.user?.id),
  ]);

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    _session = session ?? null;
    await reloadAuthState();
  });
};

/** Reload profile name and admin status for the current session. */
export const reloadAuthState = async () => {
  await Promise.all([
    loadProfileName(_session?.user?.id),
    loadAdminStatus(_session?.user?.id),
  ]);
};

/** Returns the current Supabase session object, or null when logged out. */
export const getSession = () => _session;

/**
 * @deprecated – session is now managed by Supabase automatically.
 * Kept for backward compatibility; no-op.
 */
export const setSession = () => {};

/** Sign the current user out via Supabase and clear in-memory session. */
export const clearSession = async () => {
  await supabaseClient.auth.signOut();
  _session = null;
  _isAdmin = false;
};

/** Convenience boolean check. */
export const isLoggedIn = () => _session !== null;

/** Returns true when the current user has the 'admin' role. */
export const isAdmin = () => _isAdmin;

/**
 * Returns a display name for the current user.
 * Prefers the name from public.users_profiles, falls back to email.
 */
export const getDisplayName = () => {
  if (!_session) return '';
  if (_profileName) return _profileName;
  return _session.user?.email ?? '';
};
