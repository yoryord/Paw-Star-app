import './pet-edit.css';
import petEditTemplate from './pet-edit.html?raw';
import { getSession, isLoggedIn } from '../../../lib/auth.js';
import { supabaseClient } from '../../../lib/supabase.js';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// ─── Constants ───────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────

const toSafeText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getPetIdFromPath = () => {
  const match = window.location.pathname.match(/^\/pets\/([^/]+)\/edit$/);
  return match ? match[1] : null;
};

// ─── UI helpers ───────────────────────────────────────────────

const showLoading = (container, visible) => {
  container.querySelector('#pet-edit-loading')?.classList.toggle('d-none', !visible);
};

const showPageError = (container, message) => {
  const el = container.querySelector('#pet-edit-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('d-none');
};

const showFormWrap = (container) => {
  container.querySelector('#pet-edit-form-wrap')?.classList.remove('d-none');
};

const showAlert = (container, message, type = 'danger') => {
  const el = container.querySelector('#pet-edit-alert');
  if (!el) return;
  el.className = `pet-edit-alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('d-none');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const hideAlert = (container) => {
  const el = container.querySelector('#pet-edit-alert');
  if (!el) return;
  el.className = 'pet-edit-alert d-none';
  el.textContent = '';
};

const setSubmitLoading = (btn, loading) => {
  if (!btn) return;
  const label   = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.spinner-border');
  btn.disabled = loading;
  if (label)   label.style.opacity = loading ? '0.6' : '1';
  if (spinner) spinner.classList.toggle('d-none', !loading);
};

const showToast = (container, message) => {
  const toastEl = container.querySelector('#pet-edit-toast');
  const msgEl   = container.querySelector('#pet-edit-toast-message');
  if (!toastEl) return;
  if (msgEl) msgEl.textContent = message;
  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3500 });
  toast.show();
};

// ─── Data fetching ────────────────────────────────────────────

const fetchPet = async (petId) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select(
      'id, owner_id, name, species, breed, birthdate, birth_place, current_location_city, current_location_country, pet_picture_url',
    )
    .eq('id', petId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// ─── Photo upload helper ──────────────────────────────────────

const initPhotoUpload = (container, existingUrl) => {
  const fileInput   = container.querySelector('#edit-pet-picture');
  const imgEl       = container.querySelector('#pet-edit-photo-img');
  const placeholder = container.querySelector('#pet-edit-photo-placeholder');
  const clearBtn    = container.querySelector('#pet-edit-photo-clear');
  const hintEl      = container.querySelector('#pet-edit-photo-hint');

  let objectUrl  = null;
  let currentUrl = existingUrl ?? null; // The URL currently saved to DB
  let cleared    = false;              // User explicitly removed the picture

  const showPreview = (src, label) => {
    if (imgEl) {
      imgEl.src = src;
      imgEl.classList.remove('d-none');
    }
    if (placeholder) placeholder.classList.add('d-none');
    if (clearBtn)    clearBtn.classList.remove('d-none');
    if (hintEl && label) hintEl.textContent = label;
  };

  const clearPreview = () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (imgEl) {
      imgEl.src = '';
      imgEl.classList.add('d-none');
    }
    if (placeholder) placeholder.classList.remove('d-none');
    if (clearBtn)    clearBtn.classList.add('d-none');
    if (hintEl)      hintEl.textContent = 'JPG, PNG or WEBP · max 5 MB';
    if (fileInput)   fileInput.value = '';
    cleared    = true;
    currentUrl = null;
  };

  // Seed with existing picture
  if (existingUrl) {
    showPreview(existingUrl, 'Current picture');
  }

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      clearPreview();
      showAlert(container, 'Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      clearPreview();
      showAlert(container, 'The selected image exceeds 5 MB. Please choose a smaller file.');
      return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl  = URL.createObjectURL(file);
    cleared    = false;
    currentUrl = null;
    showPreview(objectUrl, toSafeText(file.name));
  });

  clearBtn?.addEventListener('click', clearPreview);

  return {
    /** Returns the URL/path to save, or null to clear, or UNCHANGED sentinel */
    getResolvedUrl() {
      const newFile = fileInput?.files?.[0];

      if (newFile) {
        // New file selected – use local-path convention (same as new-pet.js)
        return `images_temp/pets/${newFile.name}`;
      }

      if (cleared) return null;        // User cleared it
      return currentUrl;              // Unchanged
    },
    cleanup() {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
  };
};

// ─── Form validation ──────────────────────────────────────────

const validateForm = (form) => {
  form.querySelectorAll('.pet-edit-input').forEach((el) => el.classList.remove('is-invalid'));

  let valid = true;

  const nameEl    = form.querySelector('#edit-pet-name');
  const speciesEl = form.querySelector('#edit-pet-species');
  const breedEl   = form.querySelector('#edit-pet-breed');
  const dateEl    = form.querySelector('#edit-pet-birthdate');

  if (!nameEl?.value.trim()) { nameEl?.classList.add('is-invalid'); valid = false; }
  if (!speciesEl?.value)     { speciesEl?.classList.add('is-invalid'); valid = false; }
  if (!breedEl?.value.trim()) { breedEl?.classList.add('is-invalid'); valid = false; }

  if (dateEl?.value) {
    const today = new Date().toISOString().split('T')[0];
    if (dateEl.value > today) { dateEl.classList.add('is-invalid'); valid = false; }
  }

  return valid;
};

// ─── Populate form ────────────────────────────────────────────

const populateForm = (container, pet) => {
  const setValue = (id, val) => {
    const el = container.querySelector(id);
    if (el) el.value = val ?? '';
  };

  setValue('#edit-pet-name',       pet.name);
  setValue('#edit-pet-species',    pet.species);
  setValue('#edit-pet-breed',      pet.breed);
  setValue('#edit-pet-birthdate',  pet.birthdate ?? '');
  setValue('#edit-pet-birthplace', pet.birth_place);
  setValue('#edit-pet-city',       pet.current_location_city);
  setValue('#edit-pet-country',    pet.current_location_country);

  // Hero icon and subtitle
  const iconEl    = container.querySelector('#pet-edit-hero-icon');
  const subtitleEl = container.querySelector('#pet-edit-subtitle');
  if (iconEl)    iconEl.textContent = pet.species === 'dog' ? '🐶' : '🐱';
  if (subtitleEl) subtitleEl.textContent = `Editing ${pet.name}`;

  // Limit birthdate to today
  const dateEl = container.querySelector('#edit-pet-birthdate');
  if (dateEl) dateEl.max = new Date().toISOString().split('T')[0];
};

// ─── Submit handler ───────────────────────────────────────────

const handleSubmit = async (event, container, petId, photoHelper) => {
  event.preventDefault();

  const form      = container.querySelector('#pet-edit-form');
  const submitBtn = container.querySelector('#pet-edit-submit');

  hideAlert(container);

  if (!validateForm(form)) {
    showAlert(container, 'Please fill in all required fields correctly.');
    return;
  }

  setSubmitLoading(submitBtn, true);

  try {
    const updates = {
      name:                     form.querySelector('#edit-pet-name').value.trim(),
      species:                  form.querySelector('#edit-pet-species').value,
      breed:                    form.querySelector('#edit-pet-breed').value.trim(),
      birthdate:                form.querySelector('#edit-pet-birthdate').value || null,
      birth_place:              form.querySelector('#edit-pet-birthplace').value.trim() || null,
      current_location_city:    form.querySelector('#edit-pet-city').value.trim() || null,
      current_location_country: form.querySelector('#edit-pet-country').value.trim() || null,
      pet_picture_url:          photoHelper.getResolvedUrl(),
    };

    const { error } = await supabaseClient
      .from('pets')
      .update(updates)
      .eq('id', petId);

    if (error) throw error;

    showToast(container, `${toSafeText(updates.name)} updated successfully! 🐾`);

    // Navigate back to the view page after a brief delay
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('paw:navigate', {
          detail: { path: `/pets/${encodeURIComponent(petId)}/view` },
        }),
      );
    }, 1400);

  } catch (err) {
    console.error('[Pet Edit] Save failed:', err);
    showAlert(container, err?.message ?? 'Something went wrong. Please try again.');
    setSubmitLoading(submitBtn, false);
  }
};

// ─── Page export ──────────────────────────────────────────────

export const petEditPage = {
  title: 'Paw Star | Edit Pet',

  async render(container) {
    // Auth guard: only authenticated users can edit
    if (!isLoggedIn()) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/login' } }));
      return;
    }

    container.innerHTML = petEditTemplate;

    const petId = getPetIdFromPath();
    if (!petId) {
      showLoading(container, false);
      showPageError(container, 'Pet not found.');
      return;
    }

    showLoading(container, true);

    try {
      const pet = await fetchPet(petId);

      if (!pet) {
        showLoading(container, false);
        showPageError(container, 'This pet profile does not exist or has been removed.');
        return;
      }

      // Ownership guard
      const session = getSession();
      if (session?.user?.id !== pet.owner_id) {
        window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: `/pets/${encodeURIComponent(petId)}/view` } }));
        return;
      }

      document.title = `Paw Star | Edit ${pet.name}`;

      // Update back link and cancel button to point to view page
      const viewPath = `/pets/${encodeURIComponent(petId)}/view`;
      const backLink    = container.querySelector('#pet-edit-back-link');
      const cancelBtn   = container.querySelector('#pet-edit-cancel-btn');
      if (backLink)  backLink.href  = viewPath;
      if (cancelBtn) cancelBtn.href = viewPath;

      showLoading(container, false);
      showFormWrap(container);
      populateForm(container, pet);

      const photoHelper = initPhotoUpload(container, pet.pet_picture_url ?? null);

      const form = container.querySelector('#pet-edit-form');
      form?.addEventListener('submit', (e) => handleSubmit(e, container, petId, photoHelper));

      // Cleanup blob URLs on navigation away
      const cleanup = () => {
        photoHelper.cleanup();
        window.removeEventListener('paw:navigate', cleanup);
      };
      window.addEventListener('paw:navigate', cleanup, { once: true });

    } catch (err) {
      console.error('[Pet Edit] Load failed:', err);
      showLoading(container, false);
      showPageError(container, err?.message ?? 'Something went wrong. Please try again.');
    }
  },
};
