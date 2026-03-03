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

const fetchTaggedPets = async (storyId) => {
  const { data, error } = await supabaseClient
    .from('story_pet_tags')
    .select('pet_id, pets(id, name, pet_picture_url)')
    .eq('story_id', storyId);

  if (error) return [];
  return data?.map((row) => row.pets).filter(Boolean) ?? [];
};

const fetchLikesData = async (storyId, userId) => {
  const [countResult, likedResult] = await Promise.all([
    supabaseClient
      .from('story_likes')
      .select('story_id', { count: 'exact', head: true })
      .eq('story_id', storyId),
    userId
      ? supabaseClient
          .from('story_likes')
          .select('story_id')
          .eq('story_id', storyId)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    count: countResult.count ?? 0,
    liked: !!likedResult.data,
  };
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

const showToast = (message, icon = '\uD83C\uDF0D') => {
  const toastEl = document.querySelector('#story-view-toast');
  const msgEl   = document.querySelector('#story-view-toast-message');
  const iconEl  = document.querySelector('#story-view-toast-icon');
  if (!toastEl) return;
  if (msgEl)  msgEl.textContent  = message;
  if (iconEl) iconEl.textContent = icon;
  bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3000 }).show();
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

  // Draft badge + Publish button
  if (story.status === 'draft') {
    container.querySelector('#story-view-draft-badge')?.classList.remove('d-none');
    if (isOwner) {
      container.querySelector('#story-view-publish-btn')?.classList.remove('d-none');
    }
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

// ─── Publish ────────────────────────────────────────

const initPublish = (container, story) => {
  const publishBtn = container.querySelector('#story-view-publish-btn');
  if (!publishBtn) return;

  publishBtn.addEventListener('click', async () => {
    const label   = publishBtn.querySelector('.btn-label');
    const spinner = publishBtn.querySelector('.spinner-border');

    publishBtn.disabled = true;
    if (label)   label.style.opacity = '0.6';
    if (spinner) spinner.classList.remove('d-none');

    try {
      const { error } = await supabaseClient
        .from('stories')
        .update({ status: 'published' })
        .eq('id', story.id);

      if (error) throw error;

      // Update UI: hide draft badge + publish button
      container.querySelector('#story-view-draft-badge')?.classList.add('d-none');
      publishBtn.classList.add('d-none');

      showToast('Story published successfully! 🎉');

    } catch (err) {
      console.error('[Story View] Publish failed:', err);
      showError(container, err?.message ?? 'Failed to publish the story. Please try again.');
    } finally {
      publishBtn.disabled = false;
      if (label)   label.style.opacity = '1';
      if (spinner) spinner.classList.add('d-none');
    }
  });
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

// ─── Tagged pet avatars ───────────────────────────────────────

const renderTaggedPets = (container, pets) => {
  const tagsEl = container.querySelector('#story-view-pet-tags');
  if (!tagsEl || !pets.length) return;

  tagsEl.innerHTML = pets
    .map((pet) => {
      const name = toSafeText(pet.name ?? '');
      const pic  = pet.pet_picture_url ? toSafeText(pet.pet_picture_url) : null;
      return `
        <a href="/pets/${encodeURIComponent(pet.id)}/view" data-link
           class="story-view-tagged-pet-link" title="${name}" aria-label="${name}">
          <div class="story-view-tagged-pet-ring">
            <div class="story-view-tagged-pet-inner">
              <span class="story-view-tagged-pet-fallback" aria-hidden="true">🐾</span>
              ${pic ? `<img class="story-view-tagged-pet-img" src="${pic}" alt="${name}" />` : ''}
            </div>
          </div>
          <span class="story-view-tagged-pet-name">${name}</span>
        </a>`;
    })
    .join('');
};

// ─── Like button ──────────────────────────────────────────────

const initLikeButton = (container, storyId, initialCount, initialLiked, isAuthenticated, userId) => {
  const btn       = container.querySelector('#story-like-btn');
  const countEl   = container.querySelector('#story-like-count');
  const outlineEl = container.querySelector('#story-like-heart-outline');
  const fillEl    = container.querySelector('#story-like-heart-fill');
  if (!btn) return;

  let liked = initialLiked;
  let count = initialCount;

  const updateUI = () => {
    countEl.textContent = count > 0 ? String(count) : '0';
    if (liked) {
      outlineEl?.classList.add('d-none');
      fillEl?.classList.remove('d-none');
      btn.classList.add('liked');
      btn.setAttribute('aria-label', 'Unlike this story');
      btn.title = 'Unlike this story';
    } else {
      outlineEl?.classList.remove('d-none');
      fillEl?.classList.add('d-none');
      btn.classList.remove('liked');
      btn.setAttribute('aria-label', 'Like this story');
      btn.title = 'Like this story';
    }
  };

  updateUI();

  if (!isAuthenticated) {
    btn.disabled = true;
    btn.title = 'Log in to like this story';
    return;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const wasLiked = liked;

    // Optimistic update
    liked = !wasLiked;
    count = wasLiked ? count - 1 : count + 1;
    updateUI();

    try {
      if (wasLiked) {
        const { error } = await supabaseClient
          .from('story_likes')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from('story_likes')
          .insert({ story_id: storyId, user_id: userId });
        if (error) throw error;
      }
    } catch (err) {
      console.error('[Story View] Like toggle failed:', err);
      // Revert optimistic update
      liked = wasLiked;
      count = wasLiked ? count + 1 : count - 1;
      updateUI();
    } finally {
      btn.disabled = false;
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

      const session       = getSession();
      const authenticated = isLoggedIn();
      const isOwner       = authenticated && session?.user?.id === story.owner_id;

      // Non-owners cannot view drafts
      if (story.status === 'draft' && !isOwner) {
        showLoading(container, false);
        showError(container, 'This story is not available.');
        return;
      }

      const [ownerName, taggedPets, likesData] = await Promise.all([
        fetchOwnerName(story.owner_id),
        fetchTaggedPets(storyId),
        fetchLikesData(storyId, session?.user?.id ?? null),
      ]);

      showLoading(container, false);
      showContent(container);
      populateStory(container, story, ownerName, isOwner, authenticated);
      renderTaggedPets(container, taggedPets);
      initLikeButton(container, storyId, likesData.count, likesData.liked, authenticated, session?.user?.id ?? null);
      initPublish(container, story);
      initDelete(container, story);

    } catch (err) {
      console.error('[Story View] Load failed:', err);
      showLoading(container, false);
      showError(container, err?.message ?? 'Something went wrong. Please try again.');
    }
  },
};
