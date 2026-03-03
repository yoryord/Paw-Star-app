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
      ownerEl.innerHTML = `<a href="/public_profile/${encodeURIComponent(story.owner_id)}" data-link class="story-view-owner-link">${safeOwnerName}</a>`;
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

// ─── Comments ─────────────────────────────────────────────────

const COMMENTS_PER_PAGE = 10;

const COMMENT_EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/></svg>`;

const fetchCommentsWithUsers = async (storyId) => {
  const { data: comments, error } = await supabaseClient
    .from('comments')
    .select('id, user_id, parent_id, content, created_at, updated_at')
    .eq('story_id', storyId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!comments?.length) return [];

  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles } = await supabaseClient
    .from('users_profiles')
    .select('id, name')
    .in('id', userIds);

  const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name ?? 'Unknown']));
  return comments.map((c) => ({ ...c, user_name: nameMap[c.user_id] ?? 'Unknown' }));
};

const isCommentEdited = (comment) =>
  !!(
    comment.updated_at &&
    comment.created_at &&
    new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 1500
  );

const formatCommentDate = (comment) => {
  const edited = isCommentEdited(comment);
  const dateValue = edited ? comment.updated_at : comment.created_at;
  const d = new Date(dateValue);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return edited ? `${formatted} (edited)` : formatted;
};

const buildCommentTree = (comments) => {
  const map = new Map();
  comments.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  const roots = [];
  map.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).replies.push(c);
    } else if (!c.parent_id) {
      roots.push(c);
    }
  });
  return roots;
};

const renderCommentNode = (comment, isAuthenticated, currentUserId, depth = 0) => {
  const isOwner      = isAuthenticated && currentUserId === comment.user_id;
  const isOtherAuth  = isAuthenticated && !isOwner;
  const safeName     = toSafeText(comment.user_name ?? 'Unknown');
  const safeContent  = toSafeText(comment.content ?? '');
  const edited       = isCommentEdited(comment);
  const dateStr      = formatCommentDate(comment);
  const dateIso      = edited ? (comment.updated_at ?? '') : (comment.created_at ?? '');
  const avatarLetter = (comment.user_name ?? '?').charAt(0).toUpperCase();

  let nameHtml;
  if (!isAuthenticated) {
    nameHtml = `<span class="comment-author-name">${safeName}</span>`;
  } else if (isOwner) {
    nameHtml = `<a href="/profile" data-link class="comment-author-name comment-author-link">${safeName} <span class="comment-you-badge">you</span></a>`;
  } else {
    nameHtml = `<a href="/public_profile/${encodeURIComponent(comment.user_id)}" data-link class="comment-author-name comment-author-link">${safeName}</a>`; 
  }

  const depthClass = depth > 0 ? `comment-node--reply comment-depth-${Math.min(depth, 4)}` : 'comment-node--root';

  const repliesHtml = comment.replies?.length
    ? `<div class="comment-replies mt-2" role="list">${comment.replies.map((r) => renderCommentNode(r, isAuthenticated, currentUserId, depth + 1)).join('')}</div>`
    : '';

  return `
    <div class="comment-node ${depthClass}" data-comment-id="${toSafeText(comment.id)}" role="listitem">
      <div class="comment-card">
        <div class="comment-card-header">
          <div class="comment-author-info">
            <div class="comment-author-avatar" aria-hidden="true">${avatarLetter}</div>
            <div class="comment-author-meta">
              ${nameHtml}
              <time class="comment-date${edited ? ' comment-date--edited' : ''}" datetime="${toSafeText(dateIso)}">${toSafeText(dateStr)}</time>
            </div>
          </div>
          <div class="comment-actions d-flex align-items-center gap-1">
            ${isOwner ? `<button type="button" class="story-view-icon-btn story-view-icon-btn--edit comment-edit-btn"
              data-comment-id="${toSafeText(comment.id)}"
              data-comment-content="${toSafeText(comment.content)}"
              title="Edit comment" aria-label="Edit comment">${COMMENT_EDIT_ICON}</button>` : ''}
            ${isOtherAuth ? `<button type="button" class="comments-reply-btn"
              data-comment-id="${toSafeText(comment.id)}"
              data-author-name="${safeName}"
              title="Reply to ${safeName}" aria-label="Reply to ${safeName}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" class="me-1" aria-hidden="true"><path d="M5 3.5h6A.5.5 0 0 1 11 4v1.5a.5.5 0 0 0 .854.354l2.853-2.853a.5.5 0 0 0 0-.707L11.854.44A.5.5 0 0 0 11 .793V2.5H5a5 5 0 0 0 0 10h3a.5.5 0 0 0 0-1H5a4 4 0 0 1 0-8"/></svg>
              Reply</button>` : ''}
          </div>
        </div>
        <div class="comment-card-body">
          <p class="comment-content mb-0">${safeContent}</p>
        </div>
      </div>
      ${repliesHtml}
    </div>`;
};

const initComments = (container, storyId, isAuthenticated, currentUserId) => {
  const sectionEl    = container.querySelector('#comments-section');
  const addBtn       = container.querySelector('#comment-add-btn');
  const listEl       = container.querySelector('#comments-list');
  const emptyEl      = container.querySelector('#comments-empty');
  const paginationEl = container.querySelector('#comments-pagination');
  const countBadge   = container.querySelector('#comments-count-badge');
  const loginNudge   = container.querySelector('#comments-login-nudge');
  const addModalEl   = document.querySelector('#comment-add-modal');
  const editModalEl  = document.querySelector('#comment-edit-modal');

  if (!listEl || !addModalEl || !editModalEl) return;

  if (isAuthenticated) addBtn?.classList.remove('d-none');
  else loginNudge?.classList.remove('d-none');

  const addModal  = bootstrap.Modal.getOrCreateInstance(addModalEl);
  const editModal = bootstrap.Modal.getOrCreateInstance(editModalEl);

  let allRoots     = [];
  let totalFlat    = 0;
  let currentPage  = 1;
  let activeParentId    = null;
  let activeParentAuthor = null;
  let editingCommentId  = null;

  // ─── Render a page of root-level comments ──────────────
  const renderPage = (page) => {
    currentPage = page;
    const start     = (page - 1) * COMMENTS_PER_PAGE;
    const pageItems = allRoots.slice(start, start + COMMENTS_PER_PAGE);

    if (!pageItems.length && allRoots.length === 0) {
      listEl.innerHTML = '';
      emptyEl?.classList.remove('d-none');
      paginationEl?.classList.add('d-none');
      return;
    }

    emptyEl?.classList.add('d-none');
    listEl.innerHTML = `<div class="comment-root-list" role="list">${pageItems.map((c) => renderCommentNode(c, isAuthenticated, currentUserId)).join('')}</div>`;

    // Attach event listeners
    listEl.querySelectorAll('.comment-edit-btn').forEach((btn) =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.commentId, btn.dataset.commentContent))
    );
    listEl.querySelectorAll('.comments-reply-btn').forEach((btn) =>
      btn.addEventListener('click', () => openReplyModal(btn.dataset.commentId, btn.dataset.authorName))
    );
    listEl.querySelectorAll('[data-link]').forEach((link) =>
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: link.getAttribute('href') } }));
      })
    );

    renderPagination(page);
  };

  // ─── Render pagination controls ────────────────────────
  const renderPagination = (page) => {
    const totalPages = Math.ceil(allRoots.length / COMMENTS_PER_PAGE);
    if (totalPages <= 1) { paginationEl?.classList.add('d-none'); return; }
    paginationEl?.classList.remove('d-none');

    const listEl2 = paginationEl?.querySelector('#comments-page-list');
    if (!listEl2) return;

    const PREV_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/></svg>`;
    const NEXT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/></svg>`;

    // Build visible page numbers with ellipsis
    const visible = new Set([1, totalPages]);
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) visible.add(i);
    const visibleSorted = [...visible].sort((a, b) => a - b);

    let numbersHtml = '';
    let prev = 0;
    visibleSorted.forEach((p) => {
      if (prev && p - prev > 1) {
        numbersHtml += `<li class="page-item disabled"><span class="page-link comments-page-link" aria-hidden="true">…</span></li>`;
      }
      numbersHtml += `<li class="page-item${p === page ? ' active' : ''}"><button class="page-link comments-page-link" data-page="${p}"${p === page ? ' aria-current="page"' : ''}>${p}</button></li>`;
      prev = p;
    });

    listEl2.innerHTML = `
      <li class="page-item${page <= 1 ? ' disabled' : ''}">
        <button class="page-link comments-page-link" id="comments-prev-btn" aria-label="Previous page">${PREV_SVG}</button>
      </li>
      ${numbersHtml}
      <li class="page-item${page >= totalPages ? ' disabled' : ''}">
        <button class="page-link comments-page-link" id="comments-next-btn" aria-label="Next page">${NEXT_SVG}</button>
      </li>`;

    listEl2.querySelector('#comments-prev-btn')?.addEventListener('click', () => {
      if (page > 1) renderPage(page - 1);
    });
    listEl2.querySelector('#comments-next-btn')?.addEventListener('click', () => {
      if (page < totalPages) renderPage(page + 1);
    });
    listEl2.querySelectorAll('[data-page]').forEach((btn) =>
      btn.addEventListener('click', () => renderPage(parseInt(btn.dataset.page, 10)))
    );
  };

  // ─── Load all comments ──────────────────────────────────
  const loadComments = async (targetPage = null) => {
    listEl.innerHTML = '<div class="comments-loading text-center py-4"><span class="spinner-border spinner-border-sm text-warning" role="status" aria-label="Loading comments…"></span></div>';
    try {
      const flat = await fetchCommentsWithUsers(storyId);
      const tree = buildCommentTree(flat);
      allRoots  = tree;
      totalFlat = flat.length;
      if (countBadge) countBadge.textContent = String(totalFlat);

      const goToPage = targetPage ?? currentPage;
      const safeMax  = Math.max(1, Math.ceil(allRoots.length / COMMENTS_PER_PAGE));
      renderPage(Math.min(goToPage, safeMax));
    } catch (err) {
      console.error('[Comments] Load failed:', err);
      listEl.innerHTML = '<p class="text-danger small py-3 px-1">Failed to load comments. Please refresh.</p>';
    }
  };

  // ─── Add / Reply modal ──────────────────────────────────
  const openReplyModal = (parentId, authorName) => {
    activeParentId     = parentId;
    activeParentAuthor = authorName;
    const titleEl  = addModalEl.querySelector('#comment-add-modal-title-text');
    const textarea = addModalEl.querySelector('#comment-add-textarea');
    const errorEl  = addModalEl.querySelector('#comment-add-error');
    const charsEl  = addModalEl.querySelector('#comment-add-chars');
    if (titleEl)  titleEl.textContent = `Reply to ${authorName ?? 'comment'}`;
    if (textarea) textarea.value = '';
    if (errorEl)  { errorEl.textContent = ''; errorEl.classList.add('d-none'); }
    if (charsEl)  charsEl.textContent = '0 / 2000';
    addModal.show();
  };

  addBtn?.addEventListener('click', () => {
    activeParentId     = null;
    activeParentAuthor = null;
    const titleEl  = addModalEl.querySelector('#comment-add-modal-title-text');
    const textarea = addModalEl.querySelector('#comment-add-textarea');
    const errorEl  = addModalEl.querySelector('#comment-add-error');
    const charsEl  = addModalEl.querySelector('#comment-add-chars');
    if (titleEl)  titleEl.textContent = 'Add Comment';
    if (textarea) textarea.value = '';
    if (errorEl)  { errorEl.textContent = ''; errorEl.classList.add('d-none'); }
    if (charsEl)  charsEl.textContent = '0 / 2000';
    addModal.show();
  });

  addModalEl.querySelector('#comment-add-textarea')?.addEventListener('input', (e) => {
    const charsEl = addModalEl.querySelector('#comment-add-chars');
    if (charsEl) charsEl.textContent = `${e.target.value.length} / 2000`;
  });

  addModalEl.querySelector('#comment-add-submit')?.addEventListener('click', async () => {
    const textarea  = addModalEl.querySelector('#comment-add-textarea');
    const errorEl   = addModalEl.querySelector('#comment-add-error');
    const submitBtn = addModalEl.querySelector('#comment-add-submit');
    const label     = submitBtn?.querySelector('.btn-label');
    const spinner   = submitBtn?.querySelector('.spinner-border');
    const text      = textarea?.value?.trim();

    if (!text) {
      if (errorEl) { errorEl.textContent = 'Comment cannot be empty.'; errorEl.classList.remove('d-none'); }
      return;
    }

    submitBtn.disabled = true;
    if (label)   label.style.opacity   = '0.6';
    if (spinner) spinner.classList.remove('d-none');
    if (errorEl) errorEl.classList.add('d-none');

    try {
      const payload = { story_id: storyId, user_id: currentUserId, content: text };
      if (activeParentId) payload.parent_id = activeParentId;

      const { error } = await supabaseClient.from('comments').insert(payload);
      if (error) throw error;

      addModal.hide();
      const isNewRoot = !activeParentId;
      await loadComments(isNewRoot ? Math.ceil((allRoots.length + 1) / COMMENTS_PER_PAGE) : currentPage);
    } catch (err) {
      console.error('[Comments] Post failed:', err);
      if (errorEl) { errorEl.textContent = err?.message ?? 'Failed to post. Please try again.'; errorEl.classList.remove('d-none'); }
    } finally {
      submitBtn.disabled = false;
      if (label)   label.style.opacity = '1';
      if (spinner) spinner.classList.add('d-none');
    }
  });

  // ─── Edit modal ─────────────────────────────────────────
  const openEditModal = (commentId, content) => {
    editingCommentId    = commentId;
    const textarea = editModalEl.querySelector('#comment-edit-textarea');
    const errorEl  = editModalEl.querySelector('#comment-edit-error');
    const charsEl  = editModalEl.querySelector('#comment-edit-chars');
    if (textarea) textarea.value = content ?? '';
    if (errorEl)  { errorEl.textContent = ''; errorEl.classList.add('d-none'); }
    if (charsEl)  charsEl.textContent = `${(content ?? '').length} / 2000`;
    editModal.show();
  };

  editModalEl.querySelector('#comment-edit-textarea')?.addEventListener('input', (e) => {
    const charsEl = editModalEl.querySelector('#comment-edit-chars');
    if (charsEl) charsEl.textContent = `${e.target.value.length} / 2000`;
  });

  editModalEl.querySelector('#comment-edit-submit')?.addEventListener('click', async () => {
    const textarea  = editModalEl.querySelector('#comment-edit-textarea');
    const errorEl   = editModalEl.querySelector('#comment-edit-error');
    const submitBtn = editModalEl.querySelector('#comment-edit-submit');
    const label     = submitBtn?.querySelector('.btn-label');
    const spinner   = submitBtn?.querySelector('.spinner-border');
    const text      = textarea?.value?.trim();

    if (!text) {
      if (errorEl) { errorEl.textContent = 'Comment cannot be empty.'; errorEl.classList.remove('d-none'); }
      return;
    }

    submitBtn.disabled = true;
    if (label)   label.style.opacity   = '0.6';
    if (spinner) spinner.classList.remove('d-none');
    if (errorEl) errorEl.classList.add('d-none');

    try {
      const { error } = await supabaseClient
        .from('comments')
        .update({ content: text })
        .eq('id', editingCommentId)
        .eq('user_id', currentUserId);
      if (error) throw error;

      editModal.hide();
      await loadComments(currentPage);
    } catch (err) {
      console.error('[Comments] Edit failed:', err);
      if (errorEl) { errorEl.textContent = err?.message ?? 'Failed to update. Please try again.'; errorEl.classList.remove('d-none'); }
    } finally {
      submitBtn.disabled = false;
      if (label)   label.style.opacity = '1';
      if (spinner) spinner.classList.add('d-none');
    }
  });

  // ─── Kick off initial load ──────────────────────────────
  loadComments(1);
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
      initComments(container, storyId, authenticated, session?.user?.id ?? null);

    } catch (err) {
      console.error('[Story View] Load failed:', err);
      showLoading(container, false);
      showError(container, err?.message ?? 'Something went wrong. Please try again.');
    }
  },
};
