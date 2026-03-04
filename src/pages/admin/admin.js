import './admin.css';
import adminTemplate from './admin.html?raw';
import { supabaseClient } from '../../lib/supabase.js';
import { getSession, isLoggedIn } from '../../lib/auth.js';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// ─── Constants ────────────────────────────────────────────────
const PAGE_SIZE = 15;

const PREV_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/></svg>`;
const NEXT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/></svg>`;

// ─── Helpers ──────────────────────────────────────────────────
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
};

const showEl  = (el) => el?.classList.remove('d-none');
const hideEl  = (el) => el?.classList.add('d-none');
const setErr  = (el, msg) => { if (el) { el.textContent = msg; showEl(el); } };
const clearErr = (el)     => { if (el) { el.textContent = ''; hideEl(el); } };

// ─── Generic table sort helper ────────────────────────────────
const sortData = (data, col, asc) => {
  return [...data].sort((a, b) => {
    let va = a[col] ?? '';
    let vb = b[col] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
};

// ─── Pagination renderer ──────────────────────────────────────
const renderPagination = (paginationEl, pageListEl, page, total, onPageChange, scrollTarget) => {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { hideEl(paginationEl); return; }
  showEl(paginationEl);
  if (!pageListEl) return;

  const visible = new Set([1, totalPages]);
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) visible.add(i);
  const sorted = [...visible].sort((a, b) => a - b);

  let nums = '';
  let prev = 0;
  sorted.forEach((p) => {
    if (prev && p - prev > 1) {
      nums += `<li class="page-item disabled"><span class="page-link" aria-hidden="true">…</span></li>`;
    }
    nums += `<li class="page-item${p === page ? ' active' : ''}"><button class="page-link" data-page="${p}"${p === page ? ' aria-current="page"' : ''}>${p}</button></li>`;
    prev = p;
  });

  pageListEl.innerHTML = `
    <li class="page-item${page <= 1 ? ' disabled' : ''}">
      <button class="page-link" id="pg-prev" aria-label="Previous">${PREV_SVG}</button>
    </li>
    ${nums}
    <li class="page-item${page >= totalPages ? ' disabled' : ''}">
      <button class="page-link" id="pg-next" aria-label="Next">${NEXT_SVG}</button>
    </li>`;

  const go = (p) => {
    onPageChange(p);
    scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  pageListEl.querySelector('#pg-prev')?.addEventListener('click', () => { if (page > 1) go(page - 1); });
  pageListEl.querySelector('#pg-next')?.addEventListener('click', () => { if (page < totalPages) go(page + 1); });
  pageListEl.querySelectorAll('[data-page]').forEach((btn) =>
    btn.addEventListener('click', () => go(parseInt(btn.dataset.page, 10)))
  );
};

// ─── Data fetchers ────────────────────────────────────────────
const fetchUsers = async () => {
  const { data, error } = await supabaseClient.rpc('get_admin_users');
  if (error) throw error;
  return data ?? [];
};

const fetchPets = async (emailMap = {}) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select('id, name, species, breed, about_pet, pet_picture_url, created_at, owner_id')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, owner_email: emailMap[p.owner_id] ?? '—' }));
};

const fetchStories = async (emailMap = {}) => {
  const { data, error } = await supabaseClient
    .from('stories')
    .select('id, title, status, updated_at, owner_id')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, owner_email: emailMap[s.owner_id] ?? '—' }));
};

// ─── Tab controller factory ───────────────────────────────────
// Creates an encapsulated state machine for a single admin tab.
const makeTabController = ({ tbodyId, emptyId, noResultsId, paginationId, pageListId, searchId, searchClearId, columns, renderRow, getBadgeEl, searchField = 'email' }) => {
  let allData      = [];
  let filtered     = [];
  let currentPage  = 1;
  let sortCol      = null;
  let sortAsc      = true;
  let searchQuery  = '';

  const tbody       = () => document.getElementById(tbodyId);
  const emptyEl     = () => document.getElementById(emptyId);
  const noResultsEl = () => document.getElementById(noResultsId);
  const paginEl     = () => document.getElementById(paginationId);
  const pageListEl  = () => document.getElementById(pageListId);
  const searchInput = () => document.getElementById(searchId);

  const applyFilter = (resetPage = true) => {
    const q = searchQuery.toLowerCase();
    filtered = allData.filter((row) => {
      if (!q) return true;
      return (row[searchField] ?? '').toLowerCase().includes(q);
    });

    if (sortCol) {
      filtered = sortData(filtered, sortCol, sortAsc);
    }

    if (resetPage) currentPage = 1;

    const hasData    = allData.length > 0;
    const hasResults = filtered.length > 0;

    hideEl(emptyEl()); hideEl(noResultsEl());
    if (!hasData)         { showEl(emptyEl()); }
    else if (!hasResults) { showEl(noResultsEl()); }

    if (getBadgeEl) getBadgeEl().textContent = allData.length;

    renderPage();
  };

  const renderPage = () => {
    const tb = tbody();
    if (!tb) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const rows  = filtered.slice(start, start + PAGE_SIZE);
    tb.innerHTML = rows.map(renderRow).join('');

    renderPagination(
      paginEl(),
      pageListEl(),
      currentPage,
      filtered.length,
      (p) => { currentPage = p; renderPage(); },
      tb
    );
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      sortAsc = !sortAsc;
    } else {
      sortCol = col;
      sortAsc = true;
    }
    // Update header icons
    document.querySelectorAll(`.admin-th[data-col]`).forEach((th) => {
      th.classList.remove('sort-asc', 'sort-desc');
    });
    const activeTh = document.querySelector(`.admin-th[data-col="${col}"]`);
    if (activeTh) activeTh.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
    applyFilter(false);
  };

  const init = (data) => {
    allData = data;
    applyFilter();

    // Search listener
    const inp = searchInput();
    if (inp) {
      inp.addEventListener('input', () => { searchQuery = inp.value.trim(); applyFilter(); });
    }
    const clearBtn = document.getElementById(searchClearId);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (inp) { inp.value = ''; inp.focus(); }
        searchQuery = '';
        applyFilter();
      });
    }

    // Sort listeners — only for columns belonging to this tab
    document.querySelectorAll(`.admin-th.sortable[data-tab="${columns}"]`).forEach((th) => {
      th.addEventListener('click', () => handleSort(th.dataset.col));
    });
  };

  const refresh = (data) => {
    allData = data;
    applyFilter(false);
  };

  return { init, refresh, applyFilter };
};

// ─── Row renderers ────────────────────────────────────────────

const renderUserRow = (u) => {
  const isAdmin = u.user_role === 'admin';
  return `
    <tr>
      <td class="admin-cell-truncate" data-label="Name">${esc(u.name) || '<span class="text-secondary fst-italic">—</span>'}</td>
      <td class="admin-cell-truncate admin-hide-mobile" data-label="Email">${esc(u.email)}</td>
      <td data-label="Role">
        <span class="admin-role-badge ${isAdmin ? 'role-admin' : 'role-user'}">
          ${isAdmin ? '🛡️ Admin' : '👤 User'}
        </span>
      </td>
      <td class="admin-hide-mobile" data-label="Joined">${fmt(u.created_at)}</td>
      <td class="admin-hide-mobile" data-label="Last Login">${fmt(u.last_sign_in_at)}</td>
      <td class="admin-td-actions">
        <div class="admin-action-btns">
          <button class="btn btn-admin-edit" data-action="edit-user"
            data-id="${esc(u.id)}" data-name="${esc(u.name)}" data-email="${esc(u.email)}">
            ✏️ Edit
          </button>
          ${isAdmin
            ? `<button class="btn btn-admin-remove-admin" data-action="remove-admin" data-id="${esc(u.id)}" data-name="${esc(u.name)}">⬇️ Remove Admin</button>`
            : `<button class="btn btn-admin-make-admin" data-action="make-admin" data-id="${esc(u.id)}" data-name="${esc(u.name)}">⬆️ Make Admin</button>`
          }
          <button class="btn btn-admin-delete" data-action="delete-user"
            data-id="${esc(u.id)}" data-name="${esc(u.name) || esc(u.email)}">
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>`;
};

const renderPetRow = (p) => {
  const fallback = p.species?.toLowerCase() === 'dog' ? '🐶' : '🐱';
  const avatarHtml = p.pet_picture_url
    ? `<img class="admin-pet-avatar" src="${esc(p.pet_picture_url)}" alt="${esc(p.name)}" loading="lazy" />`
    : `<div class="admin-pet-avatar-fallback">${fallback}</div>`;

  return `
    <tr>
      <td class="admin-td-photo">${avatarHtml}</td>
      <td class="admin-cell-truncate" data-label="Name">${esc(p.name)}</td>
      <td data-label="Species">${esc(p.species)}</td>
      <td class="admin-cell-truncate admin-hide-mobile" data-label="Breed">${esc(p.breed) || '—'}</td>
      <td class="admin-cell-truncate admin-hide-mobile" data-label="Owner">${esc(p.owner_email)}</td>
      <td class="admin-hide-mobile" data-label="Created">${fmt(p.created_at)}</td>
      <td class="admin-td-actions">
        <div class="admin-action-btns">
          <button class="btn btn-admin-edit" data-action="edit-pet"
            data-id="${esc(p.id)}" data-name="${esc(p.name)}"
            data-species="${esc(p.species)}" data-breed="${esc(p.breed ?? '')}"
            data-about="${esc(p.about_pet ?? '')}">
            ✏️ Edit
          </button>
          <button class="btn btn-admin-delete" data-action="delete-pet"
            data-id="${esc(p.id)}" data-name="${esc(p.name)}">
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>`;
};

const renderStoryRow = (s) => {
  const statusClass = s.status === 'published' ? 'status-published' : 'status-draft';
  const statusLabel = s.status === 'published' ? '✅ Published' : '📝 Draft';
  return `
    <tr>
      <td class="admin-cell-truncate" data-label="Title">${esc(s.title) || '(Untitled)'}</td>
      <td data-label="Status"><span class="admin-status-badge ${statusClass}">${statusLabel}</span></td>
      <td class="admin-cell-truncate admin-hide-mobile" data-label="Owner">${esc(s.owner_email)}</td>
      <td class="admin-hide-mobile" data-label="Updated">${fmt(s.updated_at)}</td>
      <td class="admin-td-actions">
        <div class="admin-action-btns">
          <button class="btn btn-admin-edit" data-action="edit-story"
            data-id="${esc(s.id)}" data-title="${esc(s.title ?? '')}" data-status="${esc(s.status)}">
            ✏️ Edit
          </button>
          <button class="btn btn-admin-delete" data-action="delete-story"
            data-id="${esc(s.id)}" data-name="${esc(s.title ?? '(Untitled)')}">
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>`;
};

// ─── Modal helpers ────────────────────────────────────────────
const getModal = (id) => {
  const el = document.getElementById(id);
  return el ? bootstrap.Modal.getOrCreateInstance(el) : null;
};

// ─── Page export ──────────────────────────────────────────────
export const adminPage = {
  title: 'Paw Star | Admin Panel',

  async render(container) {
    container.innerHTML = adminTemplate;

    const loadingEl = container.querySelector('#admin-loading');
    const errorEl   = container.querySelector('#admin-error');
    const contentEl = container.querySelector('#admin-content');
    const deniedEl  = container.querySelector('#admin-access-denied');

    // ── Auth guard ─────────────────────────────────────────────
    if (!isLoggedIn()) {
      hideEl(loadingEl);
      showEl(deniedEl);
      return;
    }

    // ── Check admin role ───────────────────────────────────────
    const session = getSession();
    const { data: roleRow } = await supabaseClient
      .from('user_roles')
      .select('user_role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (roleRow?.user_role !== 'admin') {
      hideEl(loadingEl);
      showEl(deniedEl);
      return;
    }

    hideEl(loadingEl);
    showEl(contentEl);

    // ── Tab controllers ────────────────────────────────────────
    const usersCtrl = makeTabController({
      tbodyId:       'users-tbody',
      emptyId:       'users-empty',
      noResultsId:   'users-no-results',
      paginationId:  'users-pagination',
      pageListId:    'users-page-list',
      searchId:      'users-search',
      searchClearId: 'users-search-clear',
      columns:       'users',
      renderRow:     renderUserRow,
      getBadgeEl:    () => container.querySelector('#users-count-badge'),
      searchField:   'email',
    });

    const petsCtrl = makeTabController({
      tbodyId:       'pets-tbody',
      emptyId:       'pets-empty',
      noResultsId:   'pets-no-results',
      paginationId:  'pets-pagination',
      pageListId:    'pets-page-list',
      searchId:      'pets-search',
      searchClearId: 'pets-search-clear',
      columns:       'pets',
      renderRow:     renderPetRow,
      getBadgeEl:    () => container.querySelector('#pets-count-badge'),
      searchField:   'owner_email',
    });

    const storiesCtrl = makeTabController({
      tbodyId:       'stories-tbody',
      emptyId:       'admin-stories-empty',
      noResultsId:   'admin-stories-no-results',
      paginationId:  'admin-stories-pagination',
      pageListId:    'admin-stories-page-list',
      searchId:      'admin-stories-search',
      searchClearId: 'admin-stories-search-clear',
      columns:       'stories',
      renderRow:     renderStoryRow,
      getBadgeEl:    () => container.querySelector('#stories-count-badge'),
      searchField:   'owner_email',
    });

    // ── Load all data ──────────────────────────────────────────
    // Fetch users first to build an owner_id → email lookup map,
    // then pass it to fetchPets / fetchStories (no direct FK to users_profiles).
    let emailMap = {};
    try {
      const users = await fetchUsers();
      emailMap = Object.fromEntries(users.map((u) => [u.id, u.email]));
      const [pets, stories] = await Promise.all([fetchPets(emailMap), fetchStories(emailMap)]);
      usersCtrl.init(users);
      petsCtrl.init(pets);
      storiesCtrl.init(stories);
    } catch (err) {
      console.error('[Admin] Load failed:', err);
      hideEl(contentEl);
      setErr(errorEl, err?.message ?? 'Failed to load admin data. Please try again.');
      showEl(errorEl);
      return;
    }

    // ── Delegate table action buttons ──────────────────────────
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      // ── Edit User ──────────────────────────────────────────
      if (action === 'edit-user') {
        document.getElementById('edit-user-id').value    = btn.dataset.id;
        document.getElementById('edit-user-name').value  = btn.dataset.name ?? '';
        document.getElementById('edit-user-email').value = btn.dataset.email ?? '';
        clearErr(document.getElementById('edit-user-error'));
        getModal('editUserModal')?.show();
        return;
      }

      // ── Delete User ────────────────────────────────────────
      if (action === 'delete-user') {
        document.getElementById('delete-user-id').value          = btn.dataset.id;
        document.getElementById('delete-user-name-label').textContent = btn.dataset.name ?? '';
        clearErr(document.getElementById('delete-user-error'));
        getModal('deleteUserModal')?.show();
        return;
      }

      // ── Make Admin ─────────────────────────────────────────
      if (action === 'make-admin' || action === 'remove-admin') {
        const newRole = action === 'make-admin' ? 'admin' : 'user';
        btn.disabled = true;
        const { error } = await supabaseClient.rpc('admin_set_user_role', {
          target_user_id: btn.dataset.id,
          new_role: newRole,
        });
        btn.disabled = false;
        if (error) { alert('Error: ' + error.message); return; }
        // Refresh users
        try {
          const fresh = await fetchUsers();
          usersCtrl.refresh(fresh);
        } catch (_) {}
        return;
      }

      // ── Edit Pet ───────────────────────────────────────────
      if (action === 'edit-pet') {
        document.getElementById('edit-pet-id').value      = btn.dataset.id;
        document.getElementById('edit-pet-name').value    = btn.dataset.name ?? '';
        document.getElementById('edit-pet-breed').value   = btn.dataset.breed ?? '';
        document.getElementById('edit-pet-about').value   = btn.dataset.about ?? '';
        const speciesEl = document.getElementById('edit-pet-species');
        if (speciesEl) speciesEl.value = btn.dataset.species ?? 'cat';
        clearErr(document.getElementById('edit-pet-error'));
        getModal('editPetModal')?.show();
        return;
      }

      // ── Delete Pet ─────────────────────────────────────────
      if (action === 'delete-pet') {
        document.getElementById('delete-pet-id').value          = btn.dataset.id;
        document.getElementById('delete-pet-name-label').textContent = btn.dataset.name ?? '';
        clearErr(document.getElementById('delete-pet-error'));
        getModal('deletePetModal')?.show();
        return;
      }

      // ── Edit Story ─────────────────────────────────────────
      if (action === 'edit-story') {
        document.getElementById('edit-story-id').value     = btn.dataset.id;
        document.getElementById('edit-story-title').value  = btn.dataset.title ?? '';
        const statusEl = document.getElementById('edit-story-status');
        if (statusEl) statusEl.value = btn.dataset.status ?? 'draft';
        clearErr(document.getElementById('edit-story-error'));
        getModal('editStoryModal')?.show();
        return;
      }

      // ── Delete Story ───────────────────────────────────────
      if (action === 'delete-story') {
        document.getElementById('delete-story-id').value          = btn.dataset.id;
        document.getElementById('delete-story-name-label').textContent = btn.dataset.name ?? '';
        clearErr(document.getElementById('delete-story-error'));
        getModal('deleteStoryModal')?.show();
        return;
      }
    });

    // ── Modal: Save User ───────────────────────────────────────
    document.getElementById('edit-user-save-btn')?.addEventListener('click', async () => {
      const id      = document.getElementById('edit-user-id').value;
      const name    = document.getElementById('edit-user-name').value.trim();
      const errEl   = document.getElementById('edit-user-error');
      const saveBtn = document.getElementById('edit-user-save-btn');
      clearErr(errEl);

      if (!name) { setErr(errEl, 'Display name cannot be empty.'); return; }

      saveBtn.disabled = true;
      const { error } = await supabaseClient
        .from('users_profiles')
        .update({ name })
        .eq('id', id);
      saveBtn.disabled = false;

      if (error) { setErr(errEl, error.message); return; }

      getModal('editUserModal')?.hide();
      try { usersCtrl.refresh(await fetchUsers()); } catch (_) {}
    });

    // ── Modal: Delete User ─────────────────────────────────────
    document.getElementById('delete-user-confirm-btn')?.addEventListener('click', async () => {
      const id      = document.getElementById('delete-user-id').value;
      const errEl   = document.getElementById('delete-user-error');
      const delBtn  = document.getElementById('delete-user-confirm-btn');
      clearErr(errEl);
      delBtn.disabled = true;
      const { error } = await supabaseClient.rpc('admin_delete_user', { target_user_id: id });
      delBtn.disabled = false;
      if (error) { setErr(errEl, error.message); return; }
      getModal('deleteUserModal')?.hide();
      try { usersCtrl.refresh(await fetchUsers()); } catch (_) {}
    });

    // ── Modal: Save Pet ────────────────────────────────────────
    document.getElementById('edit-pet-save-btn')?.addEventListener('click', async () => {
      const id      = document.getElementById('edit-pet-id').value;
      const name    = document.getElementById('edit-pet-name').value.trim();
      const species = document.getElementById('edit-pet-species').value;
      const breed   = document.getElementById('edit-pet-breed').value.trim();
      const about   = document.getElementById('edit-pet-about').value.trim();
      const errEl   = document.getElementById('edit-pet-error');
      const saveBtn = document.getElementById('edit-pet-save-btn');
      clearErr(errEl);

      if (!name) { setErr(errEl, 'Pet name cannot be empty.'); return; }

      saveBtn.disabled = true;
      const { error } = await supabaseClient
        .from('pets')
        .update({ name, species, breed: breed || null, about_pet: about || null })
        .eq('id', id);
      saveBtn.disabled = false;

      if (error) { setErr(errEl, error.message); return; }
      getModal('editPetModal')?.hide();
      try { petsCtrl.refresh(await fetchPets(emailMap)); } catch (_) {}
    });

    // ── Modal: Delete Pet ──────────────────────────────────────
    document.getElementById('delete-pet-confirm-btn')?.addEventListener('click', async () => {
      const id     = document.getElementById('delete-pet-id').value;
      const errEl  = document.getElementById('delete-pet-error');
      const delBtn = document.getElementById('delete-pet-confirm-btn');
      clearErr(errEl);
      delBtn.disabled = true;
      const { error } = await supabaseClient.from('pets').delete().eq('id', id);
      delBtn.disabled = false;
      if (error) { setErr(errEl, error.message); return; }
      getModal('deletePetModal')?.hide();
      try { petsCtrl.refresh(await fetchPets(emailMap)); } catch (_) {}
    });

    // ── Modal: Save Story ──────────────────────────────────────
    document.getElementById('edit-story-save-btn')?.addEventListener('click', async () => {
      const id      = document.getElementById('edit-story-id').value;
      const title   = document.getElementById('edit-story-title').value.trim();
      const status  = document.getElementById('edit-story-status').value;
      const errEl   = document.getElementById('edit-story-error');
      const saveBtn = document.getElementById('edit-story-save-btn');
      clearErr(errEl);

      if (!title) { setErr(errEl, 'Title cannot be empty.'); return; }

      saveBtn.disabled = true;
      const { error } = await supabaseClient
        .from('stories')
        .update({ title, status })
        .eq('id', id);
      saveBtn.disabled = false;

      if (error) { setErr(errEl, error.message); return; }
      getModal('editStoryModal')?.hide();
      try { storiesCtrl.refresh(await fetchStories(emailMap)); } catch (_) {}
    });

    // ── Modal: Delete Story ────────────────────────────────────
    document.getElementById('delete-story-confirm-btn')?.addEventListener('click', async () => {
      const id     = document.getElementById('delete-story-id').value;
      const errEl  = document.getElementById('delete-story-error');
      const delBtn = document.getElementById('delete-story-confirm-btn');
      clearErr(errEl);
      delBtn.disabled = true;
      const { error } = await supabaseClient.from('stories').delete().eq('id', id);
      delBtn.disabled = false;
      if (error) { setErr(errEl, error.message); return; }
      getModal('deleteStoryModal')?.hide();
      try { storiesCtrl.refresh(await fetchStories(emailMap)); } catch (_) {}
    });
  },
};
