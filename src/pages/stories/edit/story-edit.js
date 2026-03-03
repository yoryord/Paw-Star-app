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

const showToast = (container, message) => {
  const toastEl = container.querySelector('#story-edit-toast');
  const msgEl   = container.querySelector('#story-edit-toast-message');
  if (!toastEl) return;
  if (msgEl) msgEl.textContent = message;
  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3500 });
  toast.show();
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
    if (hintEl)      hintEl.textContent = 'JPG, PNG or WEBP · max 5 MB';
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

// ─── Populate form ────────────────────────────────────────────

const populateForm = (container, story) => {
  const form = container.querySelector('#story-edit-form');
  if (!form) return;

  const titleEl   = form.querySelector('#edit-story-title');
  const contentEl = form.querySelector('#edit-story-content');
  const statusEl  = form.querySelector('#edit-story-status');

  if (titleEl)   titleEl.value   = story.title   ?? '';
  if (contentEl) contentEl.value = story.content ?? '';
  if (statusEl)  statusEl.value  = story.status  ?? 'draft';

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

      // ── Form submit ──────────────────────────────────────────
      const form      = container.querySelector('#story-edit-form');
      const submitBtn = container.querySelector('#story-edit-submit-btn');

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(container);

        if (!validateForm(form)) return;

        setSubmitLoading(submitBtn, true);

        try {
          const titleEl   = form.querySelector('#edit-story-title');
          const contentEl = form.querySelector('#edit-story-content');
          const statusEl  = form.querySelector('#edit-story-status');

          const session = getSession();
          const userId  = session?.user?.id;

          const updates = {
            title:   titleEl?.value.trim()   ?? story.title,
            content: contentEl?.value.trim() ?? story.content,
            status:  statusEl?.value         ?? story.status,
          };

          // ── Resolve cover image URL ─────────────────────
          const newCoverFile = coverHelper?.getFile();
          let resolvedCover  = coverHelper?.getCurrentUrl() ?? story.cover_image_url;
          if (coverHelper?.isCleared()) resolvedCover = null;

          if (newCoverFile && userId) {
            const ext      = newCoverFile.name.split('.').pop().toLowerCase();
            const filePath = `${userId}/${story.id}.${ext}`;
            const { error: uploadErr } = await supabaseClient.storage
              .from('story-covers')
              .upload(filePath, newCoverFile, { upsert: true });
            if (uploadErr) {
              console.warn('[Story Edit] Cover upload failed:', uploadErr);
            } else {
              const { data: urlData } = supabaseClient.storage
                .from('story-covers')
                .getPublicUrl(filePath);
              resolvedCover = urlData?.publicUrl ?? resolvedCover;
            }
          }

          // Only include cover_image_url in the update when it changed
          if (resolvedCover !== story.cover_image_url) {
            updates.cover_image_url = resolvedCover ?? null;
          }

          const { error } = await supabaseClient
            .from('stories')
            .update(updates)
            .eq('id', story.id);

          if (error) throw error;

          showToast(container, 'Story saved successfully.');

          // Update local reference so subsequent saves detect changes correctly
          story.title           = updates.title;
          story.content         = updates.content;
          story.status          = updates.status;
          story.cover_image_url = updates.cover_image_url ?? story.cover_image_url;

          document.title = `Paw Star | Edit – ${story.title}`;
          const subtitleEl = container.querySelector('#story-edit-subtitle');
          if (subtitleEl) subtitleEl.textContent = `Editing: ${story.title}`;

        } catch (err) {
          console.error('[Story Edit] Save failed:', err);
          showAlert(container, err?.message ?? 'Failed to save changes. Please try again.');
        } finally {
          setSubmitLoading(submitBtn, false);
        }
      });

    } catch (err) {
      console.error('[Story Edit] Load failed:', err);
      showLoading(container, false);
      showPageError(container, err?.message ?? 'Something went wrong. Please try again.');
    }
  },
};
