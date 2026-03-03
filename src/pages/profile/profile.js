import './profile.css';
import profileTemplate from './profile.html?raw';
import { getSession, isLoggedIn, clearSession } from '../../lib/auth.js';
import { supabaseClient } from '../../lib/supabase.js';
// Import the bootstrap bundle so `bootstrap.Modal` / `bootstrap.Toast` are
// available as a proper JS binding. Vite's esbuild pre-bundling converts the
// UMD module to ESM without setting `window.bootstrap`, meaning the bare
// global `bootstrap` is undefined at runtime. Importing it here gives us the
// default export (the {Modal, Toast, …} namespace) under a local variable
// that shadows the missing global.
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

const toSafeText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#39;');

const setButtonLoading = (btn, loading) => {
  if (!btn) return;
  const label = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.spinner-border');
  btn.disabled = loading;

  if (label) label.style.opacity = loading ? '0.6' : '';
  if (spinner) spinner.classList.toggle('d-none', !loading);
};

const getFieldValue = (container, selector) => {
  const field = container.querySelector(selector);
  return (field?.value ?? '').trim();
};

const showAlert = (container, message, type = 'success') => {
  if (!container) return;
  container.className = `alert mt-4 ${type === 'error' ? 'alert-danger' : 'alert-success'}`;
  container.innerHTML = toSafeText(message);
};

const hideAlert = (container) => {
  if (!container) return;
  container.className = 'alert d-none mt-4';
  container.innerHTML = '';
};

const showSuccessToast = (container, message) => {
  const toastEl = container.querySelector('#profile-success-toast');
  const toastBody = container.querySelector('#profile-success-toast-body');
  if (!toastEl || !toastBody) return;

  toastBody.textContent = message;
  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, {
    autohide: true,
    delay: 2400,
  });
  toast.show();
};

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

// Extract the in-bucket path from a Supabase Storage public URL.
// e.g. "https://….supabase.co/storage/v1/object/public/users-media/user-profile-pictures/abc/1.jpg"
//   → "user-profile-pictures/abc/1.jpg"
const extractStoragePath = (publicUrl, bucket) => {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
};

// Best-effort delete — never throws so callers don't need to guard it.
const deleteStorageFile = async (publicUrl, bucket) => {
  const path = extractStoragePath(publicUrl, bucket);
  if (!path) return;
  try {
    await supabaseClient.storage.from(bucket).remove([path]);
  } catch {
    // silently ignore – orphaned files are not critical
  }
};

const getProfileData = async (userId) => {
  const { data, error } = await supabaseClient
    .from('users_profiles')
    .select('id, name, profile_picture_url, avatar, about_me, country, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const uploadProfilePhoto = async (file, userId) => {
  if (!file) return null;

  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedMime.includes(file.type)) {
    throw new Error('Please upload a supported image file (jpg, png, webp, gif).');
  }

  // Build storage path: user-profile-pictures/{userId}/{timestamp}.{ext}
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const storagePath = `user-profile-pictures/${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('users-media')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

  const { data } = supabaseClient.storage
    .from('users-media')
    .getPublicUrl(storagePath);

  return data?.publicUrl ?? null;
};

const renderProfileDetails = (container, session, profile) => {
  const name = profile?.name || session?.user?.email || 'My Profile';
  const email = session?.user?.email || '—';
  const picture = profile?.profile_picture_url || '';

  const nameEl = container.querySelector('#profile-name');
  const emailEl = container.querySelector('#profile-email');
  const photoEl = container.querySelector('#profile-photo');
  const fallbackEl = container.querySelector('#profile-photo-fallback');

  const detailName = container.querySelector('#profile-detail-name');
  const detailCountry = container.querySelector('#profile-detail-country');
  const detailAbout = container.querySelector('#profile-detail-about');
  const detailCreated = container.querySelector('#profile-detail-created');

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;

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

const fillEditForm = (container, profile) => {
  const form = container.querySelector('#edit-profile-form');
  if (!form) return;

  const nameField = container.querySelector('#profile-name-input');
  const countryField = container.querySelector('#profile-country-input');
  const avatarField = container.querySelector('#profile-avatar-input');
  const aboutField = container.querySelector('#profile-about-input');
  const photoField = container.querySelector('#profile-photo-input');
  const photoPreview = container.querySelector('#current-photo-preview');
  const photoThumb = container.querySelector('#current-photo-thumb');
  const photoRemove = container.querySelector('#profile-photo-remove');

  if (nameField) nameField.value = profile?.name || '';
  if (countryField) countryField.value = profile?.country || '';
  if (avatarField) avatarField.value = profile?.avatar || '';
  if (aboutField) aboutField.value = profile?.about_me || '';
  if (photoField) photoField.value = '';

  // Show/hide the current-photo preview block
  if (photoPreview && photoThumb && photoRemove) {
    const existingUrl = profile?.profile_picture_url || '';
    if (existingUrl) {
      photoThumb.src = existingUrl;
      photoPreview.classList.remove('d-none');
    } else {
      photoThumb.src = '';
      photoPreview.classList.add('d-none');
    }
    photoRemove.checked = false;
  }
};

const initPasswordToggle = (container) => {
  const toggleButtons = container.querySelectorAll('.profile-password-toggle');

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const input = container.querySelector(`#${targetId}`);
      if (!input) return;

      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
    });
  });
};

const initPasswordValidation = (container) => {
  const form = container.querySelector('#change-password-form');
  if (!form) return;

  const passwordInput = form.querySelector('#new-password-input');
  const confirmInput = form.querySelector('#confirm-password-input');

  const validateConfirm = () => {
    const valid = confirmInput.value === passwordInput.value;
    confirmInput.setCustomValidity(valid ? '' : 'Passwords must match.');
  };

  passwordInput.addEventListener('input', validateConfirm);
  confirmInput.addEventListener('input', validateConfirm);
};

export const profilePage = {
  title: 'Paw Star | Profile',

  render(container) {
    if (!isLoggedIn()) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/404' } }));
      return;
    }

    container.innerHTML = profileTemplate;

    const session = getSession();
    const userId = session?.user?.id;
    const alertEl = container.querySelector('#profile-alert');

    if (!userId) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/login' } }));
      return;
    }

    // Helpers to show/hide errors inside a specific modal
    const showModalError = (alertEl, message) => {
      if (!alertEl) return;
      alertEl.textContent = message;
      alertEl.classList.remove('d-none');
    };

    const clearModalError = (alertEl) => {
      if (!alertEl) return;
      alertEl.textContent = '';
      alertEl.classList.add('d-none');
    };

    let currentProfile = null;

    const refreshProfile = async () => {
      try {
        currentProfile = await getProfileData(userId);
        renderProfileDetails(container, session, currentProfile);
        fillEditForm(container, currentProfile);
      } catch (error) {
        showAlert(alertEl, error?.message ?? 'Could not load profile details.', 'error');
      }
    };

    refreshProfile();
    initPasswordValidation(container);
    initPasswordToggle(container);

    const editForm = container.querySelector('#edit-profile-form');
    const saveBtn = container.querySelector('#profile-save-btn');
    const editAlertEl = container.querySelector('#edit-profile-error');
    const editModalEl = container.querySelector('#edit-profile-modal');
    const editModal = editModalEl ? bootstrap.Modal.getOrCreateInstance(editModalEl) : null;

    // Re-fill form and clear errors every time the edit modal opens
    if (editModalEl) {
      editModalEl.addEventListener('show.bs.modal', () => {
        clearModalError(editAlertEl);
        editForm?.classList.remove('was-validated');
        fillEditForm(container, currentProfile);
      });
    }

    if (editForm) {
      editForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const fullName = getFieldValue(container, '#profile-name-input');

        // Manual required-field check so the error is shown INSIDE the modal
        if (!fullName) {
          showModalError(editAlertEl, 'Full name is required.');
          return;
        }

        clearModalError(editAlertEl);
        setButtonLoading(saveBtn, true);

        try {
          const profilePhotoFile = container.querySelector('#profile-photo-input')?.files?.[0] ?? null;
          const removeChecked = container.querySelector('#profile-photo-remove')?.checked ?? false;
          const existingPhotoUrl = currentProfile?.profile_picture_url || null;

          const country = getFieldValue(container, '#profile-country-input');
          const avatar = getFieldValue(container, '#profile-avatar-input');
          const aboutMe = getFieldValue(container, '#profile-about-input');

          const payload = {
            id: userId,
            name: fullName,
            country: country || null,
            avatar: avatar || null,
            about_me: aboutMe || null,
          };

          if (profilePhotoFile) {
            // Upload new photo, then delete the old one (best-effort)
            const newUrl = await uploadProfilePhoto(profilePhotoFile, userId);
            payload.profile_picture_url = newUrl;
            if (existingPhotoUrl) {
              await deleteStorageFile(existingPhotoUrl, 'users-media');
            }
          } else if (removeChecked && existingPhotoUrl) {
            // Remove photo: delete from storage and clear the DB column
            await deleteStorageFile(existingPhotoUrl, 'users-media');
            payload.profile_picture_url = null;
          }
          // else: no file selected, not removing – keep existing URL as-is (not included in payload)

          const { error } = await supabaseClient
            .from('users_profiles')
            .upsert(payload, { onConflict: 'id' });

          if (error) throw error;

          await refreshProfile();
          if (editModal) editModal.hide();
          showSuccessToast(container, 'Profile saved successfully.');
        } catch (err) {
          console.error('[Profile] Save error:', err);
          showModalError(editAlertEl, err?.message ?? 'Failed to save profile. Please try again.');
        } finally {
          setButtonLoading(saveBtn, false);
        }
      });
    }

    const passwordForm = container.querySelector('#change-password-form');
    const passwordBtn = container.querySelector('#password-save-btn');
    const passwordAlertEl = container.querySelector('#change-password-error');
    const passwordModalEl = container.querySelector('#change-password-modal');
    const passwordModal = passwordModalEl ? bootstrap.Modal.getOrCreateInstance(passwordModalEl) : null;

    // Clear inline alert + reset form whenever the password modal opens
    if (passwordModalEl) {
      passwordModalEl.addEventListener('show.bs.modal', () => {
        clearModalError(passwordAlertEl);
        if (passwordForm) {
          passwordForm.reset();
          passwordForm.classList.remove('was-validated');
          // Reset show/hide toggles back to 'Show'
          passwordModalEl.querySelectorAll('.profile-password-toggle').forEach((btn) => {
            const targetId = btn.getAttribute('data-target');
            const input = passwordModalEl.querySelector(`#${targetId}`);
            if (input) input.type = 'password';
            btn.textContent = 'Show';
          });
        }
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const confirmInput = passwordForm.querySelector('#confirm-password-input');
        const passwordInput = passwordForm.querySelector('#new-password-input');
        const currentPasswordInput = passwordForm.querySelector('#current-password-input');
        confirmInput.setCustomValidity(confirmInput.value === passwordInput.value ? '' : 'Passwords must match.');

        if (!passwordForm.checkValidity()) {
          passwordForm.classList.add('was-validated');
          return;
        }

        clearModalError(passwordAlertEl);
        setButtonLoading(passwordBtn, true);

        try {
          const { error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: session?.user?.email ?? '',
            password: currentPasswordInput.value,
          });

          if (signInError) {
            throw new Error('Current password is incorrect. Please try again.');
          }

          const { error } = await supabaseClient.auth.updateUser({
            password: passwordInput.value,
          });

          if (error) throw error;

          passwordForm.reset();
          passwordForm.classList.remove('was-validated');
          if (passwordModal) passwordModal.hide();
          showSuccessToast(container, 'Password changed successfully.');
        } catch (err) {
          console.error('[Profile] Password change error:', err);
          showModalError(passwordAlertEl, err?.message ?? 'Failed to change password.');
        } finally {
          setButtonLoading(passwordBtn, false);
        }
      });
    }

    const deleteForm = container.querySelector('#delete-account-form');
    const deleteBtn = container.querySelector('#delete-account-btn');
    const deleteAlertEl = container.querySelector('#delete-account-error');
    const deleteModalEl = container.querySelector('#delete-account-modal');
    const deleteModal = deleteModalEl ? bootstrap.Modal.getOrCreateInstance(deleteModalEl) : null;

    // Clear inline alert + reset confirmation input when delete modal opens
    if (deleteModalEl) {
      deleteModalEl.addEventListener('show.bs.modal', () => {
        clearModalError(deleteAlertEl);
        if (deleteForm) {
          deleteForm.reset();
          deleteForm.classList.remove('was-validated');
        }
      });
    }

    if (deleteForm) {
      deleteForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const confirmInput = deleteForm.querySelector('#delete-confirm-input');
        const confirmed = confirmInput.value.trim() === 'DELETE';
        confirmInput.setCustomValidity(confirmed ? '' : 'Please type DELETE to continue.');

        if (!deleteForm.checkValidity()) {
          deleteForm.classList.add('was-validated');
          return;
        }

        clearModalError(deleteAlertEl);
        setButtonLoading(deleteBtn, true);

        try {
          const { error } = await supabaseClient
            .from('users_profiles')
            .delete()
            .eq('id', userId);

          if (error) throw error;

          if (deleteModal) deleteModal.hide();
          showSuccessToast(container, 'Account deleted. Goodbye! 👋');

          await clearSession();
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/' } }));
          }, 900);
        } catch (err) {
          console.error('[Profile] Delete account error:', err);
          showModalError(deleteAlertEl, err?.message ?? 'Could not delete account.');
        } finally {
          setButtonLoading(deleteBtn, false);
        }
      });
    }
  },
};
