import './my-space.css';
import mySpaceTemplate from './my-space.html?raw';
import { getSession, isLoggedIn } from '../../lib/auth.js';
import { supabaseClient } from '../../lib/supabase.js';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

const toSafeText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html ?? '';
  return tmp.textContent ?? '';
};

const EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/></svg>`;

const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>`;

const showGridLoading = (container) => {
  if (!container) return;
  container.innerHTML = `
    <div class="col-12 d-flex align-items-center gap-2 text-secondary" style="min-height:4rem">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      <span>Loading…</span>
    </div>
  `;
};

const fetchUserPets = async (userId) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select('id, name, species, breed, pet_picture_url')
    .eq('owner_id', userId)
    .order('name');

  if (error) throw error;
  return data ?? [];
};

const fetchUserStories = async (userId) => {
  const { data, error } = await supabaseClient
    .from('stories')
    .select('id, title, content, status, cover_image_url')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

const renderPets = (container, pets) => {
  if (!container) return;

  if (!pets.length) {
    container.innerHTML = '<div class="col-12"><div class="my-space-empty">No pets registered yet.</div></div>';
    return;
  }

  container.innerHTML = pets.map((pet) => {
    const petName = toSafeText(pet.name);
    const species = toSafeText(pet.species);
    const petLink = `/pets/${encodeURIComponent(String(pet.id))}/view`;
    const fallbackEmoji = String(pet.species).toLowerCase() === 'dog' ? '🐶' : '🐱';
    const mediaMarkup = pet.pet_picture_url
      ? `<img class="pet-avatar-image" src="${toSafeText(pet.pet_picture_url)}" alt="${petName}" loading="lazy">`
      : `<span class="pet-avatar-fallback" aria-hidden="true">${fallbackEmoji}</span>`;

    return `
      <div class="col-6 col-md-4 col-lg-3">
        <a class="pet-card" href="${petLink}" aria-label="Open ${petName} profile">
          <div class="pet-avatar-ring">
            <div class="pet-avatar-inner">
              ${mediaMarkup}
            </div>
          </div>
          <h3 class="pet-name">${petName}</h3>
          <p class="pet-meta mb-0">${species}</p>
        </a>
      </div>
    `;
  }).join('');
};

const SHORT_LIMIT = 220;

const renderStories = (container, stories) => {
  if (!container) return;

  if (!stories.length) {
    container.innerHTML = '<div class="col-12"><div class="my-space-empty">No stories yet. Write your first story!</div></div>';
    return;
  }

  const sortedStories = [...stories].sort((left, right) => {
    if (left.status === right.status) return 0;
    return left.status === 'published' ? -1 : 1;
  });

  container.innerHTML = sortedStories.map((story) => {
    const title = toSafeText(story.title);
    const safeId = toSafeText(String(story.id));
    const encodedId = encodeURIComponent(String(story.id));
    const viewLink = `/stories/${encodedId}/view`;
    const editLink = `/stories/${encodedId}/edit`;
    const status = String(story.status ?? 'draft').toLowerCase() === 'published' ? 'published' : 'draft';

    const fullText = stripHtml(story.content ?? '');
    const isLong = fullText.length > SHORT_LIMIT;
    const shortText = isLong ? fullText.slice(0, SHORT_LIMIT) + '\u2026' : '';
    const excerptText = isLong
      ? toSafeText(shortText)
      : toSafeText(fullText || 'No content preview yet.');

    const showMoreMarkup = isLong
      ? `<button type="button" class="story-show-more-btn"
           data-full="${toSafeText(fullText)}"
           data-short="${toSafeText(shortText)}"
           aria-expanded="false">Show more</button>`
      : '';

    const imageMarkup = story.cover_image_url
      ? `<img src="${toSafeText(story.cover_image_url)}" alt="${title}" loading="lazy">`
      : '';

    return `
      <div class="col-12 col-lg-6">
        <div class="story-card">
          <div class="story-card-image">
            <a href="${viewLink}" data-link class="story-card-image-link" aria-label="Read ${title}" tabindex="-1">${imageMarkup}</a>
            <span class="story-status-badge ${status}">${status}</span>
            <div class="story-card-actions">
              <a href="${editLink}" data-link
                 class="story-view-icon-btn story-view-icon-btn--edit"
                 title="Edit story" aria-label="Edit story">${EDIT_ICON}</a>
              <button type="button"
                      class="story-view-icon-btn story-view-icon-btn--delete"
                      data-delete-id="${safeId}"
                      data-delete-title="${title}"
                      title="Delete story" aria-label="Delete story">${DELETE_ICON}</button>
            </div>
          </div>
          <div class="story-card-content">
            <a href="${viewLink}" data-link class="story-card-view-link">
              <h3 class="story-title">${title}</h3>
            </a>
            <p class="story-excerpt">${excerptText}</p>
            ${showMoreMarkup}
          </div>
        </div>
      </div>
    `;
  }).join('');
};

export const mySpacePage = {
  title: 'Paw Star | My Space',

  render(container) {
    // Guard: unauthenticated users are not allowed here — send to 404
    if (!isLoggedIn()) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/404' } }));
      return;
    }

    container.innerHTML = mySpaceTemplate;

    const session = getSession();
    const email   = session?.user?.email ?? '';
    const userId  = session?.user?.id;

    const greetingEl    = container.querySelector('#my-space-greeting');
    const petsContainer = container.querySelector('#my-space-pets-grid');
    const storiesContainer = container.querySelector('#my-space-stories-grid');

    showGridLoading(petsContainer);
    showGridLoading(storiesContainer);

    const avatarEl = container.querySelector('#my-space-avatar');

    // Load profile name, pets, and stories in parallel
    Promise.all([
      supabaseClient.from('users_profiles').select('name, profile_picture_url').eq('id', userId).maybeSingle(),
      fetchUserPets(userId),
      fetchUserStories(userId),
    ]).then(([profileResult, pets, stories]) => {
      const profileName = profileResult.data?.name || email;
      const picUrl = profileResult.data?.profile_picture_url;

      if (greetingEl) greetingEl.textContent = `Hi, ${profileName}!`;

      if (avatarEl) {
        const inner = avatarEl.querySelector('.my-space-avatar-inner');
        if (inner && picUrl) {
          inner.innerHTML = `<img class="my-space-avatar-img" src="${toSafeText(picUrl)}" alt="${toSafeText(profileName)}" loading="lazy">`;
        }
      }

      renderPets(petsContainer, pets);
      renderStories(storiesContainer, stories);
      initStoryActions(storiesContainer, container);
    }).catch((err) => {
      console.error('[My Space] Failed to load data:', err);
      const errMsg = '<div class="col-12"><div class="my-space-empty">Could not load data. Please try again later.</div></div>';
      if (petsContainer)    petsContainer.innerHTML = errMsg;
      if (storiesContainer) storiesContainer.innerHTML = errMsg;
    });
  },
};

// ─── Story interactions ───────────────────────────────────────

function initStoryActions(storiesContainer, pageContainer) {
  if (!storiesContainer) return;

  // Show more / show less toggle
  storiesContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.story-show-more-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    const excerptEl = btn.previousElementSibling;
    if (!excerptEl) return;

    if (isExpanded) {
      excerptEl.textContent = btn.dataset.short;
      btn.textContent = 'Show more';
      btn.setAttribute('aria-expanded', 'false');
    } else {
      excerptEl.textContent = btn.dataset.full;
      btn.textContent = 'Show less';
      btn.setAttribute('aria-expanded', 'true');
    }
  });

  // Delete story
  const modalEl    = pageContainer.querySelector('#my-space-story-delete-modal');
  const titleEl    = pageContainer.querySelector('#my-space-story-delete-title');
  const confirmBtn = pageContainer.querySelector('#my-space-story-delete-confirm');
  if (!modalEl) return;

  const deleteModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  let pendingDeleteId = null;

  storiesContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-id]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    pendingDeleteId = btn.dataset.deleteId;
    if (titleEl) titleEl.textContent = btn.dataset.deleteTitle || 'this story';
    deleteModal.show();
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    const label   = confirmBtn.querySelector('.btn-label');
    const spinner = confirmBtn.querySelector('.spinner-border');

    confirmBtn.disabled = true;
    if (label)   label.style.opacity = '0.6';
    if (spinner) spinner.classList.remove('d-none');

    try {
      const { error } = await supabaseClient
        .from('stories')
        .delete()
        .eq('id', pendingDeleteId);

      if (error) throw error;

      deleteModal.hide();

      // Remove the card from the DOM
      const card = storiesContainer.querySelector(`[data-delete-id="${pendingDeleteId}"]`)?.closest('.col-12');
      card?.remove();

      // Show empty state if no stories remain
      if (!storiesContainer.querySelector('.story-card')) {
        storiesContainer.innerHTML = '<div class="col-12"><div class="my-space-empty">No stories yet. Write your first story!</div></div>';
      }
    } catch (err) {
      console.error('[My Space] Delete story failed:', err);
      deleteModal.hide();
    } finally {
      pendingDeleteId = null;
      confirmBtn.disabled = false;
      if (label)   label.style.opacity = '1';
      if (spinner) spinner.classList.add('d-none');
    }
  });
}
