import './story-view.css';
import storyViewTemplate from './story-view.html?raw';
import { getSession, isLoggedIn } from '../../../lib/auth.js';
import { supabaseClient } from '../../../lib/supabase.js';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Minimal allowlist-based HTML sanitizer.
 * Strips disallowed tags while preserving safe rich-text structure.
 */
const sanitizeHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const ALLOWED = new Set([
    'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'h2', 'h3', 'p', 'br',
    'ul', 'ol', 'li',
    'blockquote', 'div', 'span',
  ]);

  const walk = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED.has(tag)) {
      const text = document.createTextNode(node.textContent);
      node.parentNode?.replaceChild(text, node);
      return;
    }
    [...node.attributes].forEach((a) => node.removeAttribute(a.name));
    [...node.childNodes].forEach(walk);
  };

  [...tmp.childNodes].forEach(walk);
  return tmp.innerHTML;
};

const toSafeText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(d);
};

const getStoryIdFromPath = () => {
  // Matches /stories/{id}/view
  const match = window.location.pathname.match(/^\/stories\/([^/]+)\/view$/);
  return match ? match[1] : null;
};

// ─── Data fetching ────────────────────────────────────────────

const fetchStory = async (storyId) => {
  const { data, error } = await supabaseClient
    .from('stories')
    .select('id, owner_id, title, content, status, cover_image_url, updated_at')
    .eq('id', storyId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const fetchOwnerName = async (ownerId) => {
  const { data, error } = await supabaseClient
    .from('users_profiles')
    .select('name')
    .eq('id', ownerId)
    .maybeSingle();

  if (error) return null;
  return data?.name ?? null;
};

// ─── Render helpers ───────────────────────────────────────────

const showLoading = (container, visible) => {
  container.querySelector('#story-view-loading')?.classList.toggle('d-none', !visible);
};

const showError = (container, message) => {
  const el = container.querySelector('#story-view-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('d-none');
};

const showContent = (container) => {
  container.querySelector('#story-view-content')?.classList.remove('d-none');
};

const populateStory = (container, story, ownerName, isOwner, isAuthenticated) => {
  // Cover image
  if (story.cover_image_url) {
    const wrapEl = container.querySelector('#story-view-cover-wrap');
    const imgEl  = container.querySelector('#story-view-cover');
    if (imgEl)  imgEl.src = toSafeText(story.cover_image_url);
    if (wrapEl) wrapEl.classList.remove('d-none');
  }

  // Title
  const titleEl = container.querySelector('#story-view-title');
  if (titleEl) titleEl.textContent = story.title ?? '';

  // Draft badge
  if (story.status === 'draft') {
    container.querySelector('#story-view-draft-badge')?.classList.remove('d-none');
  }

  // Owner line
  const ownerEl = container.querySelector('#story-view-owner');
  if (ownerEl) {
    const safeOwnerName = toSafeText(ownerName ?? 'Unknown');

    if (!isAuthenticated) {
      // Anon: plain text
      ownerEl.textContent = ownerName ?? 'Unknown';
    } else if (isOwner) {
      // Owner: link to own profile
      ownerEl.innerHTML = `<a href="/profile" data-link class="story-view-owner-link">${safeOwnerName} (you)</a>`;
    } else {
      // Authenticated, not owner: link to public profile (not yet implemented)
      ownerEl.innerHTML = `<a href="/public/${encodeURIComponent(story.owner_id)}" data-link class="story-view-owner-link">${safeOwnerName}</a>`;
    }
  }

  // Date
  const dateEl = container.querySelector('#story-view-date');
  if (dateEl) {
    const formatted = formatDate(story.updated_at);
    dateEl.textContent = formatted ?? '';
    if (story.updated_at) dateEl.setAttribute('datetime', story.updated_at);
  }

  // Story content body (stored as sanitized HTML from the rich-text editor)
  const bodyEl = container.querySelector('#story-view-body');
  if (bodyEl) bodyEl.innerHTML = sanitizeHtml(story.content ?? '');

  // Owner actions
  if (isOwner) {
    const actionsEl = container.querySelector('#story-view-owner-actions');
    const editBtn   = container.querySelector('#story-view-edit-btn');
    if (actionsEl) actionsEl.classList.remove('d-none');
    if (editBtn)   editBtn.href = `/stories/${encodeURIComponent(story.id)}/edit`;
  }
};

// ─── Delete ───────────────────────────────────────────────────

const initDelete = (container, story) => {
  const deleteBtn   = container.querySelector('#story-view-delete-btn');
  const modalEl     = container.querySelector('#story-delete-modal');
  const modalTitle  = container.querySelector('#story-delete-modal-title');
  const confirmBtn  = container.querySelector('#story-delete-modal-confirm');

  if (!deleteBtn || !modalEl) return;

  if (modalTitle) modalTitle.textContent = story.title ?? 'this story';

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  deleteBtn.addEventListener('click', () => modal.show());

  confirmBtn?.addEventListener('click', async () => {
    const label   = confirmBtn.querySelector('.btn-label');
    const spinner = confirmBtn.querySelector('.spinner-border');

    confirmBtn.disabled = true;
    if (label)   label.style.opacity = '0.6';
    if (spinner) spinner.classList.remove('d-none');

    try {
      const { error } = await supabaseClient
        .from('stories')
        .delete()
        .eq('id', story.id);

      if (error) throw error;

      modal.hide();
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/stories' } }));
    } catch (err) {
      console.error('[Story View] Delete failed:', err);
      confirmBtn.disabled = false;
      if (label)   label.style.opacity = '1';
      if (spinner) spinner.classList.add('d-none');
      modal.hide();
      showError(container, err?.message ?? 'Failed to delete the story. Please try again.');
    }
  });
};

// ─── Page export ──────────────────────────────────────────────

export const storyViewPage = {
  title: 'Paw Star | Story',

  async render(container) {
    container.innerHTML = storyViewTemplate;

    const storyId = getStoryIdFromPath();
    if (!storyId) {
      showLoading(container, false);
      showError(container, 'Story not found.');
      return;
    }

    showLoading(container, true);

    try {
      const story = await fetchStory(storyId);

      if (!story) {
        showLoading(container, false);
        showError(container, 'This story does not exist or has been removed.');
        return;
      }

      document.title = `Paw Star | ${story.title}`;

      const ownerName     = await fetchOwnerName(story.owner_id);
      const session       = getSession();
      const authenticated = isLoggedIn();
      const isOwner       = authenticated && session?.user?.id === story.owner_id;

      // Non-owners cannot view drafts
      if (story.status === 'draft' && !isOwner) {
        showLoading(container, false);
        showError(container, 'This story is not available.');
        return;
      }

      showLoading(container, false);
      showContent(container);
      populateStory(container, story, ownerName, isOwner, authenticated);
      initDelete(container, story);

    } catch (err) {
      console.error('[Story View] Load failed:', err);
      showLoading(container, false);
      showError(container, err?.message ?? 'Something went wrong. Please try again.');
    }
  },
};
