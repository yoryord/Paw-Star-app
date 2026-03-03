import './new-story.css';
import newStoryTemplate from './new-story.html?raw';
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

/**
 * Minimal HTML sanitizer: strips tags not in the allowlist.
 * Keeps bold, italic, underline, s, h2, h3, p, ul, ol, li, br, blockquote.
 */
const sanitizeHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const ALLOWED_TAGS = new Set([
    'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'h2', 'h3', 'p', 'br',
    'ul', 'ol', 'li',
    'blockquote', 'div', 'span',
  ]);

  const walk = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // Replace disallowed element with its text content
        const text = document.createTextNode(node.textContent);
        node.parentNode?.replaceChild(text, node);
        return;
      }
      // Strip all attributes from allowed elements (keeps content, removes scripts)
      [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
      [...node.childNodes].forEach(walk);
    }
  };

  [...tmp.childNodes].forEach(walk);
  return tmp.innerHTML;
};

/** Strip HTML tags to get plain text (used for excerpt / validation) */
const stripHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
};

// ─── UI helpers ──────────────────────────────────────────────

const showAlert = (container, message, type = 'danger') => {
  const el = container.querySelector('#new-story-alert');
  if (!el) return;
  el.className = `new-story-alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('d-none');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const hideAlert = (container) => {
  const el = container.querySelector('#new-story-alert');
  if (!el) return;
  el.className = 'new-story-alert d-none';
  el.textContent = '';
};

const setButtonLoading = (btn, loading) => {
  if (!btn) return;
  const label   = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.spinner-border');
  btn.disabled = loading;
  if (label)   label.style.opacity = loading ? '0.6' : '1';
  if (spinner) spinner.classList.toggle('d-none', !loading);
};

const setAllSubmitButtons = (container, loading) => {
  ['#new-story-draft-btn', '#new-story-publish-btn'].forEach((sel) => {
    setButtonLoading(container.querySelector(sel), loading);
  });
};

const showToast = (container, message, icon = '✅') => {
  const toastEl  = container.querySelector('#new-story-toast');
  const msgEl    = container.querySelector('#new-story-toast-message');
  const iconEl   = container.querySelector('#new-story-toast-icon');
  if (!toastEl) return;
  if (msgEl)  msgEl.textContent  = message;
  if (iconEl) iconEl.textContent = icon;
  const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2200 });
  toast.show();
};

// ─── Fetch user pets ──────────────────────────────────────────

const fetchOwnedPets = async (userId) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select('id, name, species')
    .eq('owner_id', userId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

// ─── Pet chip list ────────────────────────────────────────────

const renderPetList = (container, pets) => {
  const loadingEl = container.querySelector('#pets-loading');
  const emptyEl   = container.querySelector('#pets-empty');
  const listEl    = container.querySelector('#pets-list');

  loadingEl?.classList.add('d-none');

  if (!pets.length) {
    emptyEl?.classList.remove('d-none');
    return;
  }

  listEl.innerHTML = pets.map((pet) => {
    const emoji = pet.species === 'dog' ? '🐶' : '🐱';
    const safeName = toSafeText(pet.name);
    const safeId   = toSafeText(pet.id);
    return `
      <div class="new-story-pet-chip">
        <input type="checkbox" id="pet-tag-${safeId}" name="pet_tags" value="${safeId}" />
        <label for="pet-tag-${safeId}">${emoji} ${safeName}</label>
      </div>`;
  }).join('');

  listEl.classList.remove('d-none');
};

const getSelectedPetIds = (container) => {
  return [...container.querySelectorAll('input[name="pet_tags"]:checked')]
    .map((el) => el.value);
};

// ─── Rich text editor ─────────────────────────────────────────

const TOOLBAR_COMMANDS = [
  { cmd: 'bold' },
  { cmd: 'italic' },
  { cmd: 'underline' },
  { cmd: 'strikeThrough' },
  { cmd: 'insertUnorderedList' },
  { cmd: 'insertOrderedList' },
  { cmd: 'indent' },
  { cmd: 'outdent' },
  { cmd: 'removeFormat' },
];

/** Update the active/pressed state of toolbar buttons */
const syncToolbarState = (toolbar) => {
  toolbar.querySelectorAll('[data-cmd]').forEach((btn) => {
    const cmd = btn.dataset.cmd;
    if (cmd === 'formatBlock' || cmd === 'indent' || cmd === 'outdent' || cmd === 'removeFormat') return;
    try {
      const active = document.queryCommandState(cmd);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    } catch {
      // queryCommandState may throw in some environments – silently ignore
    }
  });
};

const initRichTextEditor = (container) => {
  const editorEl = container.querySelector('#new-story-editor');
  const toolbar  = container.querySelector('#editor-toolbar');
  if (!editorEl || !toolbar) return;

  // Toolbar click handler
  toolbar.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;

    e.preventDefault(); // Prevent losing focus on the editor

    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val ?? null;

    if (cmd === 'formatBlock' && val) {
      document.execCommand('formatBlock', false, val);
    } else {
      document.execCommand(cmd, false, null);
    }

    editorEl.focus();
    syncToolbarState(toolbar);
  });

  // Sync toolbar state on selection change / keyup
  editorEl.addEventListener('keyup', () => syncToolbarState(toolbar));
  editorEl.addEventListener('mouseup', () => syncToolbarState(toolbar));
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === editorEl) syncToolbarState(toolbar);
  });

  // Support Ctrl+B / I / U keyboard shortcuts indication
  editorEl.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'i' || e.key === 'u') {
        // execCommand handles the actual formatting; just sync state after
        setTimeout(() => syncToolbarState(toolbar), 0);
      }
    }
  });

  return {
    getHtml() {
      return editorEl.innerHTML ?? '';
    },
    isEmpty() {
      return stripHtml(editorEl.innerHTML).trim() === '';
    },
    setInvalid(invalid) {
      editorEl.classList.toggle('is-invalid', invalid);
      container.querySelector('#new-story-content-error')?.classList.toggle('d-none', !invalid);
    },
  };
};

// ─── Cover image upload ───────────────────────────────────────

const initCoverUpload = (container) => {
  const fileInput   = container.querySelector('#new-story-cover');
  const imgEl       = container.querySelector('#new-story-cover-img');
  const placeholder = container.querySelector('#new-story-cover-placeholder');
  const clearBtn    = container.querySelector('#new-story-cover-clear');
  const hintEl      = container.querySelector('#new-story-cover-hint');

  let objectUrl = null;

  const showPreview = (file) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    if (imgEl) { imgEl.src = objectUrl; imgEl.classList.remove('d-none'); }
    if (placeholder) placeholder.classList.add('d-none');
    if (clearBtn)    clearBtn.classList.remove('d-none');
    if (hintEl)      hintEl.textContent = toSafeText(file.name);
  };

  const clearPreview = () => {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (imgEl) { imgEl.src = ''; imgEl.classList.add('d-none'); }
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
      showAlert(container, 'Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      clearPreview();
      showAlert(container, 'The selected image exceeds 5 MB. Please choose a smaller file.');
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

// ─── Form validation ──────────────────────────────────────────

const validateForm = (container, editorHelper) => {
  const titleEl = container.querySelector('#new-story-title');
  let valid = true;

  titleEl?.classList.remove('is-invalid');
  editorHelper.setInvalid(false);

  if (!titleEl?.value.trim()) {
    titleEl?.classList.add('is-invalid');
    valid = false;
  }

  if (editorHelper.isEmpty()) {
    editorHelper.setInvalid(true);
    valid = false;
  }

  return valid;
};

// ─── Submit handler ───────────────────────────────────────────

const handleSubmit = async (container, status, editorHelper, coverHelper) => {
  hideAlert(container);

  if (!validateForm(container, editorHelper)) {
    showAlert(container, 'Please fill in the title and story content.');
    return;
  }

  setAllSubmitButtons(container, true);

  try {
    const session = getSession();
    const userId  = session?.user?.id;
    if (!userId) throw new Error('You must be signed in.');

    const titleEl = container.querySelector('#new-story-title');
    const title   = titleEl?.value.trim() ?? '';

    const rawHtml = editorHelper.getHtml();
    const content = sanitizeHtml(rawHtml);

    // ── Insert story (without cover first, so we have the storyId for the path)
    const { data: created, error: insertErr } = await supabaseClient
      .from('stories')
      .insert({
        owner_id: userId,
        title,
        content,
        status,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;
    const storyId = created.id;

    // ── Upload cover image if provided ───────────────────────
    const coverFile = coverHelper.getFile();
    let coverUrl = null;
    if (coverFile) {
      const ext      = coverFile.name.split('.').pop().toLowerCase();
      const filePath = `${userId}/${storyId}.${ext}`;
      const { error: uploadErr } = await supabaseClient.storage
        .from('story-covers')
        .upload(filePath, coverFile, { upsert: true });
      if (uploadErr) {
        console.warn('[New Story] Cover upload failed:', uploadErr);
      } else {
        const { data: urlData } = supabaseClient.storage
          .from('story-covers')
          .getPublicUrl(filePath);
        coverUrl = urlData?.publicUrl ?? null;
        if (coverUrl) {
          await supabaseClient.from('stories').update({ cover_image_url: coverUrl }).eq('id', storyId);
        }
      }
    }

    // ── Insert pet tags ──────────────────────────────────────
    const petIds = getSelectedPetIds(container);
    if (petIds.length) {
      const tagRows = petIds.map((petId) => ({ story_id: storyId, pet_id: petId }));
      const { error: tagErr } = await supabaseClient
        .from('story_pet_tags')
        .insert(tagRows);

      if (tagErr) {
        // Log but don't fail – story is already saved
        console.warn('[New Story] Pet tag insert failed:', tagErr);
      }
    }

    // ── Toast & redirect ─────────────────────────────────────
    const toastMsg  = status === 'published' ? 'Published! Redirecting…' : 'Saved as Draft! Redirecting…';
    const toastIcon = status === 'published' ? '🌍' : '📝';
    showToast(container, toastMsg, toastIcon);

    setTimeout(() => {
      coverHelper.cleanup();
      window.dispatchEvent(new CustomEvent('paw:navigate', {
        detail: { path: `/stories/${encodeURIComponent(storyId)}/view` },
      }));
    }, 1400);

  } catch (err) {
    console.error('[New Story] Submit failed:', err);
    showAlert(container, err?.message ?? 'Something went wrong. Please try again.');
    setAllSubmitButtons(container, false);
  }
};

// ─── Page export ──────────────────────────────────────────────

export const newStoryPage = {
  title: 'Paw Star | Write a New Story',

  async render(container) {
    // Auth guard
    if (!isLoggedIn()) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/login' } }));
      return;
    }

    container.innerHTML = newStoryTemplate;

    const session = getSession();
    const userId  = session?.user?.id;

    // ── Load editor & cover helper ──────────────────────────
    const editorHelper = initRichTextEditor(container);
    const coverHelper  = initCoverUpload(container);

    // ── Fetch owned pets (async, non-blocking) ──────────────
    fetchOwnedPets(userId)
      .then((pets) => renderPetList(container, pets))
      .catch(() => {
        container.querySelector('#pets-loading')?.classList.add('d-none');
        container.querySelector('#pets-empty')?.classList.remove('d-none');
      });

    // ── Form submit – two buttons, one form ─────────────────
    const form       = container.querySelector('#new-story-form');
    const draftBtn   = container.querySelector('#new-story-draft-btn');
    const publishBtn = container.querySelector('#new-story-publish-btn');

    // Determine which button triggered submission
    let pendingStatus = 'draft';

    draftBtn?.addEventListener('click', () => { pendingStatus = 'draft'; });
    publishBtn?.addEventListener('click', () => { pendingStatus = 'published'; });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmit(container, pendingStatus, editorHelper, coverHelper);
    });

    // ── Cleanup on navigation ───────────────────────────────
    window.addEventListener('paw:navigate', () => coverHelper.cleanup(), { once: true });
  },
};
