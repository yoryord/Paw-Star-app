import './my-space.css';
import mySpaceTemplate from './my-space.html?raw';
import { getSession, isLoggedIn } from '../../lib/auth.js';
import { supabaseClient } from '../../lib/supabase.js';

const toSafeText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

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
    .select('id, title, content, status')
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
    const petLink = `/my-space/pets/${encodeURIComponent(String(pet.id))}/view`;
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

const renderStories = (container, stories) => {
  if (!container) return;

  if (!stories.length) {
    container.innerHTML = '<div class="col-12"><div class="my-space-empty">No stories yet. Create your first draft.</div></div>';
    return;
  }

  const sortedStories = [...stories].sort((left, right) => {
    if (left.status === right.status) return 0;
    return left.status === 'published' ? -1 : 1;
  });

  container.innerHTML = sortedStories.map((story) => {
    const title = toSafeText(story.title);
    const storyLink = `/my-space/my-stories/${encodeURIComponent(String(story.id))}/view`;
    const status = String(story.status ?? 'draft').toLowerCase() === 'published' ? 'published' : 'draft';
    const excerptSource = story.content ? String(story.content).trim() : '';
    const excerpt = excerptSource.length > 170
      ? `${toSafeText(excerptSource.slice(0, 167))}...`
      : toSafeText(excerptSource || 'No content preview yet.');
    const imageMarkup = ''; // cover_image_url not yet in schema

    return `
      <div class="col-12 col-lg-6">
        <a class="story-card" href="${storyLink}" aria-label="Open ${title}">
          <div class="story-card-image">
            ${imageMarkup}
            <span class="story-status-badge ${status}">${status}</span>
          </div>
          <div class="story-card-content">
            <h3 class="story-title">${title}</h3>
            <p class="story-excerpt">${excerpt}</p>
          </div>
        </a>
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

    // Load profile name, pets, and stories in parallel
    Promise.all([
      supabaseClient.from('users_profiles').select('name').eq('id', userId).maybeSingle(),
      fetchUserPets(userId),
      fetchUserStories(userId),
    ]).then(([profileResult, pets, stories]) => {
      const profileName = profileResult.data?.name || email;

      if (greetingEl) greetingEl.textContent = `Hi, ${profileName}!`;

      renderPets(petsContainer, pets);
      renderStories(storiesContainer, stories);
    }).catch((err) => {
      console.error('[My Space] Failed to load data:', err);
      const errMsg = '<div class="col-12"><div class="my-space-empty">Could not load data. Please try again later.</div></div>';
      if (petsContainer)    petsContainer.innerHTML = errMsg;
      if (storiesContainer) storiesContainer.innerHTML = errMsg;
    });
  },
};
