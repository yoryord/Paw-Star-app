import './story-edit.css';
import storyEditTemplate from './story-edit.html?raw';
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

const getStoryIdFromPath = () => {
  const match = window.location.pathname.match(/^\/stories\/([^/]+)\/edit$/);
  return match ? match[1] : null;
};

// ─── UI helpers ───────────────────────────────────────────────

const showLoading = (container, visible) => {
  container.querySelector('#story-edit-loading')?.classList.toggle('d-none', !visible);
};

const showPageError = (container, message) => {
  const el = container.querySelector('#story-edit-error');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('d-none');
};

const showFormWrap = (container) => {
  container.querySelector('#story-edit-form-wrap')?.classList.remove('d-none');
};

const showAlert = (container, message, type = 'danger') => {
  const el = container.querySelector('#story-edit-alert');
  if (!el) return;
  el.className = `story-edit-alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('d-none');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const hideAlert = (container) => {
  const el = container.querySelector('#story-edit-alert');
  if (!el) return;
  el.className = 'story-edit-alert d-none';
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

const showToast = (container, message, icon = '✅') => {
  const toastEl  = container.querySelector('#story-edit-toast');
  const msgEl    = container.querySelector('#story-edit-toast-message');
  const iconEl   = container.querySelector('#story-edit-toast-icon');
  if (!toastEl) return;
  if (msgEl)  msgEl.textContent  = message;
  if (iconEl) iconEl.textContent = icon;
  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3000 });
  toast.show();
};

const setSaveLoading = (container, loading) => {
  ['#story-edit-draft-btn', '#story-edit-publish-btn'].forEach((sel) => {
    setSubmitLoading(container.querySelector(sel), loading);
  });
};

// ─── Data fetching ────────────────────────────────────────────

const fetchStory = async (storyId) => {
  const { data, error } = await supabaseClient
    .from('stories')
    .select('id, owner_id, title, content, status, cover_image_url')
    .eq('id', storyId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const fetchOwnedPets = async (userId) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select('id, name, species')
    .eq('owner_id', userId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

const fetchStoryPetTags = async (storyId) => {
  const { data, error } = await supabaseClient
    .from('story_pet_tags')
    .select('pet_id')
    .eq('story_id', storyId);

  if (error) throw error;
  return (data ?? []).map((r) => r.pet_id);
};

// ─── Pet chip list ────────────────────────────────────────────

const renderPetList = (container, pets, selectedIds = []) => {
  const loadingEl = container.querySelector('#edit-pets-loading');
  const emptyEl   = container.querySelector('#edit-pets-empty');
  const listEl    = container.querySelector('#edit-pets-list');

  loadingEl?.classList.add('d-none');

  if (!pets.length) {
    emptyEl?.classList.remove('d-none');
    return;
  }

  const selectedSet = new Set(selectedIds);
  listEl.innerHTML = pets.map((pet) => {
    const emoji    = pet.species === 'dog' ? '🐶' : '🐱';
    const safeName = toSafeText(pet.name);
    const safeId   = toSafeText(pet.id);
    const checked  = selectedSet.has(pet.id) ? 'checked' : '';
    return `
      <div class="story-edit-pet-chip">
        <input type="checkbox" id="edit-pet-tag-${safeId}" name="pet_tags" value="${safeId}" ${checked} />
        <label for="edit-pet-tag-${safeId}">${emoji} ${safeName}</label>
      </div>`;
  }).join('');

  listEl.classList.remove('d-none');
};

const getSelectedPetIds = (container) => {
  return [...container.querySelectorAll('input[name="pet_tags"]:checked')]
    .map((el) => el.value);
};

// ─── Cover image upload helper ────────────────────────────────

const initCoverUpload = (container, existingUrl) => {
  const fileInput   = container.querySelector('#edit-story-cover');
  const imgEl       = container.querySelector('#story-edit-cover-img');
  const placeholder = container.querySelector('#story-edit-cover-placeholder');
  const clearBtn    = container.querySelector('#story-edit-cover-clear');
  const hintEl      = container.querySelector('#story-edit-cover-hint');

  let objectUrl  = null;
  let currentUrl = existingUrl ?? null;
  let cleared    = false;

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
    if (hintEl)      hintEl.textContent = 'JPG, PNG, WEBP or AVIF · max 5 MB';
    if (fileInput)   fileInput.value = '';
    cleared    = true;
    currentUrl = null;
  };

  if (existingUrl) {
    showPreview(existingUrl, 'Current cover image');
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
    getFile()      { return fileInput?.files?.[0] ?? null; },
    isCleared()    { return cleared; },
    getCurrentUrl(){ return currentUrl; },
    cleanup()      { if (objectUrl) URL.revokeObjectURL(objectUrl); },
  };
};

// ─── Form validation ──────────────────────────────────────────

const validateForm = (form) => {
  form.querySelectorAll('.story-edit-input').forEach((el) => el.classList.remove('is-invalid'));

  let valid = true;

  const titleEl   = form.querySelector('#edit-story-title');
  const contentEl = form.querySelector('#edit-story-content');

  if (!titleEl?.value.trim())   { titleEl?.classList.add('is-invalid');   valid = false; }
  if (!contentEl?.value.trim()) { contentEl?.classList.add('is-invalid'); valid = false; }

  return valid;
};

// ─── Save story (shared by draft + publish) ───────────────────

const saveStory = async (container, story, status, coverHelper) => {
  hideAlert(container);

  const form = container.querySelector('#story-edit-form');
  if (!validateForm(form)) {
    showAlert(container, 'Please fill in the title and story content.');
    return;
  }

  setSaveLoading(container, true);

  try {
    const titleEl   = form.querySelector('#edit-story-title');
    const contentEl = form.querySelector('#edit-story-content');

    const session = getSession();
    const userId  = session?.user?.id;

    const updates = {
      title:   titleEl?.value.trim()   ?? story.title,
      content: contentEl?.value.trim() ?? story.content,
      status,
    };

    // ── Resolve cover image URL ─────────────────────────────
    const newCoverFile = coverHelper?.getFile();
    let resolvedCover  = coverHelper?.getCurrentUrl() ?? story.cover_image_url;
    if (coverHelper?.isCleared()) resolvedCover = null;

    if (newCoverFile && userId) {
      const ext      = newCoverFile.name.split('.').pop().toLowerCase();
      const filePath = `story-cover-pictures/${userId}/${story.id}.${ext}`;
      const { error: uploadErr } = await supabaseClient.storage
        .from('stories')
        .upload(filePath, newCoverFile, { upsert: true, contentType: newCoverFile.type });
      if (uploadErr) {
        console.warn('[Story Edit] Cover upload failed:', uploadErr);
      } else {
        const { data: urlData } = supabaseClient.storage
          .from('stories')
          .getPublicUrl(filePath);
        resolvedCover = urlData?.publicUrl ?? resolvedCover;
      }
    }

    if (resolvedCover !== story.cover_image_url) {
      updates.cover_image_url = resolvedCover ?? null;
    }

    const { error } = await supabaseClient
      .from('stories')
      .update(updates)
      .eq('id', story.id);

    if (error) throw error;

    // ── Update pet tags ──────────────────────────────────────
    const petIds = getSelectedPetIds(container);
    await supabaseClient.from('story_pet_tags').delete().eq('story_id', story.id);
    if (petIds.length) {
      const tagRows = petIds.map((petId) => ({ story_id: story.id, pet_id: petId }));
      const { error: tagErr } = await supabaseClient.from('story_pet_tags').insert(tagRows);
      if (tagErr) console.warn('[Story Edit] Pet tag update failed:', tagErr);
    }

    const toastMsg  = status === 'published' ? 'Published successfully!' : 'Saved as Draft!';
    const toastIcon = status === 'published' ? '🌍' : '📝';
    showToast(container, toastMsg, toastIcon);

    setTimeout(() => {
      if (coverHelper) coverHelper.cleanup();
      window.dispatchEvent(new CustomEvent('paw:navigate', {
        detail: { path: `/stories/${encodeURIComponent(story.id)}/view` },
      }));
    }, 1500);

  } catch (err) {
    console.error('[Story Edit] Save failed:', err);
    showAlert(container, err?.message ?? 'Failed to save changes. Please try again.');
  } finally {
    setSaveLoading(container, false);
  }
};

// ─── Populate form ────────────────────────────────────────────

const populateForm = (container, story) => {
  const form = container.querySelector('#story-edit-form');
  if (!form) return;

  const titleEl   = form.querySelector('#edit-story-title');
  const contentEl = form.querySelector('#edit-story-content');

  if (titleEl)   titleEl.value   = story.title   ?? '';
  if (contentEl) contentEl.value = story.content ?? '';

  // Subtitle
  const subtitleEl = container.querySelector('#story-edit-subtitle');
  if (subtitleEl) subtitleEl.textContent = `Editing: ${story.title}`;

  // Back link → story view
  const backLink = container.querySelector('#story-edit-back-link');
  if (backLink) backLink.href = `/stories/${encodeURIComponent(story.id)}/view`;

  // Cancel link → story view
  const cancelBtn = container.querySelector('#story-edit-cancel-btn');
  if (cancelBtn) cancelBtn.href = `/stories/${encodeURIComponent(story.id)}/view`;
};

// ─── Page export ──────────────────────────────────────────────

export const storyEditPage = {
  title: 'Paw Star | Edit Story',

  async render(container) {
    container.innerHTML = storyEditTemplate;

    // Auth guard: only authenticated users may edit
    if (!isLoggedIn()) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/login' } }));
      return;
    }

    const storyId = getStoryIdFromPath();
    if (!storyId) {
      showLoading(container, false);
      showPageError(container, 'Story not found.');
      return;
    }

    showLoading(container, true);

    let coverHelper = null;

    try {
      const story = await fetchStory(storyId);

      if (!story) {
        showLoading(container, false);
        showPageError(container, 'This story does not exist or has been removed.');
        return;
      }

      // Only the owner may edit
      const session = getSession();
      if (session?.user?.id !== story.owner_id) {
        showLoading(container, false);
        showPageError(container, 'You do not have permission to edit this story.');
        return;
      }

      document.title = `Paw Star | Edit – ${story.title}`;

      showLoading(container, false);
      showFormWrap(container);
      populateForm(container, story);
      coverHelper = initCoverUpload(container, story.cover_image_url ?? null);

      // ── Load pets and pre-select existing tags ───────────────
      const session2 = getSession();
      Promise.all([
        fetchOwnedPets(session2?.user?.id),
        fetchStoryPetTags(story.id),
      ])
        .then(([pets, taggedIds]) => renderPetList(container, pets, taggedIds))
        .catch(() => {
          container.querySelector('#edit-pets-loading')?.classList.add('d-none');
          container.querySelector('#edit-pets-empty')?.classList.remove('d-none');
        });

      // ── Draft & Publish buttons ──────────────────────────────
      const draftBtn   = container.querySelector('#story-edit-draft-btn');
      const publishBtn = container.querySelector('#story-edit-publish-btn');

      draftBtn?.addEventListener('click', () => saveStory(container, story, 'draft', coverHelper));
      publishBtn?.addEventListener('click', () => saveStory(container, story, 'published', coverHelper));

    } catch (err) {
      console.error('[Story Edit] Load failed:', err);
      showLoading(container, false);
      showPageError(container, err?.message ?? 'Something went wrong. Please try again.');
    }
  },
};
