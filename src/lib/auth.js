/**
 * Lightweight auth-state helpers.
 * The session object shape mirrors what Supabase returns:
 *   { user: { id, email, user_metadata: { first_name, last_name } } }
 *
 * TODO: replace the localStorage stub with real Supabase session handling once
 *       the Supabase client is initialised (src/lib/supabase.js).
 */

const SESSION_KEY = 'paw_star_session';

/** Returns the stored session object, or null when logged out. */
export const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Persist a session after a successful login / sign-up. */
export const setSession = (sessionData) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
};

/** Remove the session (logout). */
export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

/** Convenience boolean check. */
export const isLoggedIn = () => getSession() !== null;

/**
 * Returns a display name for the current user.
 * Falls back gracefully when metadata is missing.
 */
export const getDisplayName = () => {
  const session = getSession();
  if (!session) return '';
  const meta = session.user?.user_metadata ?? {};
  if (meta.first_name) return meta.first_name;
  return session.user?.email ?? '';
};
