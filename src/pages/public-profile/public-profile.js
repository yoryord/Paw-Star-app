import './public-profile.css';
import publicProfileTemplate from './public-profile.html?raw';
import { supabaseClient } from '../../lib/supabase.js';

// ─── Helpers ─────────────────────────────────────────────────

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
};

/**
 * Extract the owner_id from the current pathname.
 * Matches: /public_profile/{owner_id}
 */
const getOwnerIdFromPath = () => {
  const match = window.location.pathname.match(/^\/public_profile\/([^/]+)$/);
  return match ? match[1] : null;
};

// ─── Data fetching ────────────────────────────────────────────

const getProfileData = async (userId) => {
  const { data, error } = await supabaseClient
    .from('users_profiles')
    .select('id, name, profile_picture_url, avatar, about_me, country, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// ─── Rendering ───────────────────────────────────────────────

const renderProfile = (container, profile) => {
  const name = profile?.name || 'Unknown User';
  const picture = profile?.profile_picture_url || '';

  const nameEl = container.querySelector('#public-profile-name');
  const emailEl = container.querySelector('#public-profile-email');
  const photoEl = container.querySelector('#public-profile-photo');
  const fallbackEl = container.querySelector('#public-profile-photo-fallback');

  const detailName = container.querySelector('#public-profile-detail-name');
  const detailCountry = container.querySelector('#public-profile-detail-country');
  const detailAbout = container.querySelector('#public-profile-detail-about');
  const detailCreated = container.querySelector('#public-profile-detail-created');

  if (nameEl) nameEl.textContent = name;
  // Email is private — not shown on the public profile
  if (emailEl) emailEl.remove();

  if (photoEl && fallbackEl) {
    if (picture) {
      photoEl.src = picture;
      photoEl.classList.remove('d-none');
      fallbackEl.classList.add('d-none');
    } else {
      photoEl.removeAttribute('src');
      photoEl.classList.add('d-none');
      fallbackEl.classList.remove('d-none');
      fallbackEl.textContent = profile?.avatar || '🐾';
    }
  }

  if (detailName) detailName.textContent = profile?.name || '—';
  if (detailCountry) detailCountry.textContent = profile?.country || '—';
  if (detailAbout) detailAbout.textContent = profile?.about_me || '—';
  if (detailCreated) detailCreated.textContent = formatDate(profile?.created_at);
};

const showError = (container, message) => {
  const alertEl = container.querySelector('#public-profile-alert');
  if (!alertEl) return;
  alertEl.className = 'alert alert-danger mt-4';
  alertEl.textContent = message;
};

// ─── Page export ─────────────────────────────────────────────

export const publicProfilePage = {
  title: 'Paw Star | User Profile',

  async render(container) {
    container.innerHTML = publicProfileTemplate;

    const ownerId = getOwnerIdFromPath();

    if (!ownerId) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/404' } }));
      return;
    }

    try {
      const profile = await getProfileData(ownerId);

      if (!profile) {
        window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/404' } }));
        return;
      }

      // Update page title with the user's name
      document.title = profile.name
        ? `Paw Star | ${profile.name}`
        : 'Paw Star | User Profile';

      renderProfile(container, profile);
    } catch (err) {
      console.error('[public-profile] Failed to load profile:', err);
      showError(container, 'Could not load the user profile. Please try again later.');
    }
  },
};
