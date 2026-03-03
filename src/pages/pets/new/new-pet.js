import './new-pet.css';
import newPetTemplate from './new-pet.html?raw';
import { getSession, isLoggedIn } from '../../../lib/auth.js';
import { supabaseClient } from '../../../lib/supabase.js';

// ─── Max file size (5 MB) ────────────────────────────────────
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────

const toSafeText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const showAlert = (container, message, type = 'danger') => {
  if (!container) return;
  container.className = `new-pet-alert alert alert-${type}`;
  container.textContent = message;
  container.classList.remove('d-none');
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const hideAlert = (container) => {
  if (!container) return;
  container.className = 'new-pet-alert d-none';
  container.textContent = '';
};

const setSubmitLoading = (btn, loading) => {
  if (!btn) return;
  const label = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.spinner-border');
  btn.disabled = loading;
  if (label)   label.style.opacity = loading ? '0.6' : '1';
  if (spinner) spinner.classList.toggle('d-none', !loading);
};

// ─── Toast ───────────────────────────────────────────────────

const showToast = (container, message) => {
  const toastEl = container.querySelector('#new-pet-toast');
  const msgEl   = container.querySelector('#new-pet-toast-message');
  if (!toastEl) return;

  if (msgEl) msgEl.textContent = message;

  // Bootstrap Toast API (bundled via main.js import)
  const { Toast } = window.bootstrap ?? {};
  if (Toast) {
    const toast = Toast.getOrCreateInstance(toastEl, { delay: 3500 });
    toast.show();
  }
};

// ─── Picture preview ─────────────────────────────────────────

const initPhotoUpload = (container) => {
  const fileInput   = container.querySelector('#pet-picture');
  const imgEl       = container.querySelector('#new-pet-photo-img');
  const placeholder = container.querySelector('#new-pet-photo-placeholder');
  const clearBtn    = container.querySelector('#new-pet-photo-clear');
  const hintEl      = container.querySelector('#new-pet-photo-hint');

  let objectUrl = null;

  const showPreview = (file) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    if (imgEl) {
      imgEl.src = objectUrl;
      imgEl.classList.remove('d-none');
    }
    if (placeholder) placeholder.classList.add('d-none');
    if (clearBtn)    clearBtn.classList.remove('d-none');
    if (hintEl)      hintEl.textContent = toSafeText(file.name);
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
  };

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      clearPreview();
      const alertEl = container.querySelector('#new-pet-alert');
      showAlert(alertEl, 'Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      clearPreview();
      const alertEl = container.querySelector('#new-pet-alert');
      showAlert(alertEl, 'The selected image exceeds 5 MB. Please choose a smaller file.');
      return;
    }

    showPreview(file);
  });

  clearBtn?.addEventListener('click', clearPreview);

  return {
    getFile: () => fileInput?.files?.[0] ?? null,
    cleanup: () => { if (objectUrl) URL.revokeObjectURL(objectUrl); },
  };
};

// ─── Validation ───────────────────────────────────────────────

const validateForm = (form) => {
  let valid = true;

  // Clear previous custom validity
  form.querySelectorAll('.new-pet-input').forEach((el) => {
    el.classList.remove('is-invalid');
  });

  const nameEl      = form.querySelector('#pet-name');
  const speciesEl   = form.querySelector('#pet-species');
  const breedEl     = form.querySelector('#pet-breed');
  const birthdateEl = form.querySelector('#pet-birthdate');

  if (!nameEl.value.trim()) {
    nameEl.classList.add('is-invalid');
    valid = false;
  }

  if (!speciesEl.value) {
    speciesEl.classList.add('is-invalid');
    valid = false;
  }

  if (!breedEl.value.trim()) {
    breedEl.classList.add('is-invalid');
    valid = false;
  }

  if (birthdateEl.value) {
    const today = new Date().toISOString().split('T')[0];
    if (birthdateEl.value > today) {
      birthdateEl.classList.add('is-invalid');
      valid = false;
    }
  }

  return valid;
};

// ─── Submit handler ───────────────────────────────────────────

const handleSubmit = async (event, container, photoHelper) => {
  event.preventDefault();

  const form    = container.querySelector('#new-pet-form');
  const alertEl = container.querySelector('#new-pet-alert');
  const submitBtn = container.querySelector('#new-pet-submit');

  hideAlert(alertEl);

  if (!validateForm(form)) {
    showAlert(alertEl, 'Please fill in all required fields correctly.');
    return;
  }

  setSubmitLoading(submitBtn, true);

  try {
    const session = getSession();
    const userId  = session?.user?.id;

    if (!userId) {
      showAlert(alertEl, 'You must be signed in to register a pet.');
      return;
    }

    // ── Build the record ───────────────────────────────────────
    const nameVal      = form.querySelector('#pet-name').value.trim();
    const speciesVal   = form.querySelector('#pet-species').value;
    const breedVal     = form.querySelector('#pet-breed').value.trim();
    const birthdateVal = form.querySelector('#pet-birthdate').value || null;
    const birthPlace   = form.querySelector('#pet-birth-place').value.trim() || null;
    const cityVal      = form.querySelector('#pet-city').value.trim() || null;
    const countryVal   = form.querySelector('#pet-country').value.trim() || null;

    // ── Insert pet record first (without picture) to obtain ID ─
    const petRecord = {
      owner_id:                 userId,
      name:                     nameVal,
      species:                  speciesVal,
      breed:                    breedVal,
      birthdate:                birthdateVal,
      birth_place:              birthPlace,
      current_location_city:    cityVal,
      current_location_country: countryVal,
      pet_picture_url:          null,
    };

    const { data: inserted, error: insertError } = await supabaseClient
      .from('pets')
      .insert(petRecord)
      .select('id')
      .single();

    if (insertError) throw insertError;

    const newPetId = inserted.id;

    // ── Upload picture to Supabase Storage ─────────────────────
    const picFile = photoHelper.getFile();
    if (picFile) {
      const ext      = picFile.name.split('.').pop().toLowerCase();
      const filePath = `pet-profile-pictures/${userId}/${newPetId}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('pets')
        .upload(filePath, picFile, { upsert: true, contentType: picFile.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage
        .from('pets')
        .getPublicUrl(filePath);

      const petPictureUrl = urlData?.publicUrl ?? null;

      const { error: updateError } = await supabaseClient
        .from('pets')
        .update({ pet_picture_url: petPictureUrl })
        .eq('id', newPetId);

      if (updateError) throw updateError;
    }

    // ── Success ────────────────────────────────────────────────
    showToast(container, `${toSafeText(nameVal)} was registered successfully! 🎉`);

    // Slight delay so the toast is visible before navigation
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/my-space' } }));
    }, 1200);

  } catch (err) {
    console.error('[New Pet] Registration failed:', err);
    showAlert(alertEl, err?.message ?? 'Something went wrong. Please try again.');
    setSubmitLoading(submitBtn, false);
  }
};

// ─── Page export ──────────────────────────────────────────────

export const newPetPage = {
  title: 'Paw Star | Register a Pet',

  render(container) {
    // Guard: unauthenticated users cannot register pets
    if (!isLoggedIn()) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/login' } }));
      return;
    }

    container.innerHTML = newPetTemplate;

    const photoHelper = initPhotoUpload(container);

    const form = container.querySelector('#new-pet-form');
    form?.addEventListener('submit', (e) => handleSubmit(e, container, photoHelper));

    // Set max date on birthdate picker to today
    const birthdateEl = container.querySelector('#pet-birthdate');
    if (birthdateEl) {
      birthdateEl.max = new Date().toISOString().split('T')[0];
    }

    // Clean up blob URLs if the page is navigated away from
    const cleanup = () => {
      photoHelper.cleanup();
      window.removeEventListener('paw:navigate', cleanup);
    };
    window.addEventListener('paw:navigate', cleanup, { once: true });
  },
};
