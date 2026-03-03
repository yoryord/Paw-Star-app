import './pet-view.css';
import petViewTemplate from './pet-view.html?raw';
import { getSession, isLoggedIn } from '../../../lib/auth.js';
import { supabaseClient } from '../../../lib/supabase.js';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// ─── Helpers ─────────────────────────────────────────────────

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

const getPetIdFromPath = () => {
  // Matches /pets/{id}/view
  const match = window.location.pathname.match(/^\/pets\/([^/]+)\/view$/);
  return match ? match[1] : null;
};

// ─── Data fetching ────────────────────────────────────────────

const fetchPet = async (petId) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select(
      'id, owner_id, name, species, breed, birthdate, birth_place, current_location_city, current_location_country, about_pet, pet_picture_url',
    )
    .eq('id', petId)
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
  container.querySelector('#pet-view-loading')?.classList.toggle('d-none', !visible);
};

const showError = (container, message) => {
  const el = container.querySelector('#pet-view-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('d-none');
};

const showContent = (container) => {
  container.querySelector('#pet-view-content')?.classList.remove('d-none');
};

const populatePet = (container, pet, ownerName, isOwner, isAuthenticated) => {
  const fallbackEmoji = pet.species === 'dog' ? '🐶' : '🐱';
  const speciesLabel  = pet.species === 'dog' ? '🐶 Dog' : '🐱 Cat';

  // Avatar
  const imgEl         = container.querySelector('#pet-view-avatar-img');
  const fallbackEl    = container.querySelector('#pet-view-avatar-fallback');

  if (pet.pet_picture_url && imgEl) {
    imgEl.src = toSafeText(pet.pet_picture_url);
    imgEl.alt = `${toSafeText(pet.name)} photo`;
    imgEl.classList.remove('d-none');
    if (fallbackEl) fallbackEl.classList.add('d-none');
  } else if (fallbackEl) {
    fallbackEl.textContent = fallbackEmoji;
  }

  // Name & species
  const nameEl    = container.querySelector('#pet-view-name');
  const badgeEl   = container.querySelector('#pet-view-species-badge');
  if (nameEl)  nameEl.textContent = pet.name ?? '';
  if (badgeEl) badgeEl.textContent = speciesLabel;

  // Owner line
  const ownerEl = container.querySelector('#pet-view-owner');
  if (ownerEl) {
    const safeOwnerName = toSafeText(ownerName ?? 'Unknown');

    if (!isAuthenticated) {
      // Anon: plain text
      ownerEl.textContent = ownerName ?? 'Unknown';
    } else if (isOwner) {
      // Owner viewing own pet: link to own profile
      ownerEl.innerHTML = `<a href="/profile" data-link class="pet-view-owner-link">${safeOwnerName} (you)</a>`;
    } else {
      // Authenticated but not owner: link to public profile
      ownerEl.innerHTML = `<a href="/public/${encodeURIComponent(pet.owner_id)}" data-link class="pet-view-owner-link">${safeOwnerName}</a>`;
    }
  }

  // Details
  const setText = (id, value) => {
    const el = container.querySelector(id);
    if (el) el.textContent = value || '—';
  };

  setText('#pet-view-breed', pet.breed);
  setText('#pet-view-birthdate', formatDate(pet.birthdate));
  setText('#pet-view-birthplace', pet.birth_place);

  const locationParts = [pet.current_location_city, pet.current_location_country].filter(Boolean);
  setText('#pet-view-location', locationParts.join(', '));

  // About the Pet
  const aboutRow  = container.querySelector('#pet-view-row-about');
  const aboutText = container.querySelector('#pet-view-about-text');
  if (pet.about_pet?.trim()) {
    if (aboutText) aboutText.textContent = pet.about_pet.trim();
    if (aboutRow)  aboutRow.classList.remove('d-none');
  }

  // Owner actions
  if (isOwner) {
    const actionsEl = container.querySelector('#pet-view-owner-actions');
    const editBtn   = container.querySelector('#pet-view-edit-btn');
    if (actionsEl) actionsEl.classList.remove('d-none');
    if (editBtn)   editBtn.href = `/pets/${encodeURIComponent(pet.id)}/edit`;
  }
};

// ─── Delete ───────────────────────────────────────────────────

const initDelete = (container, pet) => {
  const deleteBtn    = container.querySelector('#pet-view-delete-btn');
  const modalEl      = container.querySelector('#pet-delete-modal');
  const modalNameEl  = container.querySelector('#pet-delete-modal-name');
  const confirmBtn   = container.querySelector('#pet-delete-modal-confirm');

  if (!deleteBtn || !modalEl) return;

  if (modalNameEl) modalNameEl.textContent = pet.name ?? 'this pet';

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
        .from('pets')
        .delete()
        .eq('id', pet.id);

      if (error) throw error;

      modal.hide();

      // Navigate back to My Space after successful delete
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/my-space' } }));
    } catch (err) {
      console.error('[Pet View] Delete failed:', err);
      confirmBtn.disabled = false;
      if (label)   label.style.opacity = '1';
      if (spinner) spinner.classList.add('d-none');
      modal.hide();
      showError(container, err?.message ?? 'Failed to delete the pet. Please try again.');
    }
  });
};

// ─── Page export ──────────────────────────────────────────────

export const petViewPage = {
  title: 'Paw Star | Pet Profile',

  async render(container) {
    container.innerHTML = petViewTemplate;

    const petId = getPetIdFromPath();
    if (!petId) {
      showLoading(container, false);
      showError(container, 'Pet not found.');
      return;
    }

    showLoading(container, true);

    try {
      const pet = await fetchPet(petId);

      if (!pet) {
        showLoading(container, false);
        showError(container, 'This pet profile does not exist or has been removed.');
        return;
      }

      document.title = `Paw Star | ${pet.name}`;

      const ownerName      = await fetchOwnerName(pet.owner_id);
      const session        = getSession();
      const authenticated  = isLoggedIn();
      const isOwner        = authenticated && session?.user?.id === pet.owner_id;

      showLoading(container, false);
      showContent(container);
      populatePet(container, pet, ownerName, isOwner, authenticated);
      initDelete(container, pet);

    } catch (err) {
      console.error('[Pet View] Load failed:', err);
      showLoading(container, false);
      showError(container, err?.message ?? 'Something went wrong. Please try again.');
    }
  },
};
