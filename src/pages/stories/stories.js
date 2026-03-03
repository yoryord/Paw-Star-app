import './stories.css';
import storiesTemplate from './stories.html?raw';
import { supabaseClient } from '../../lib/supabase.js';
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// ─── Constants ────────────────────────────────────────────

const STORIES_PER_PAGE = 10;

// ─── Helpers ─────────────────────────────────────────────────

const toSafeText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
};

// ─── Data fetching ────────────────────────────────────────────

const fetchPublishedStories = async () => {
  const { data, error } = await supabaseClient
    .from('stories')
    .select('id, title, content, cover_image_url, updated_at, owner_id')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

const fetchOwnerNames = async (ownerIds) => {
  if (!ownerIds.length) return {};
  const { data, error } = await supabaseClient
    .from('users_profiles')
    .select('id, name')
    .in('id', ownerIds);

  if (error) return {};
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.name]));
};

// ─── Render helpers ───────────────────────────────────────────

const stripHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html ?? '';
  return tmp.textContent ?? tmp.innerText ?? '';
};

const truncate = (text, max = 180) =>
  text && text.length > max ? `${text.slice(0, max).trimEnd()}…` : (text ?? '');

const renderStoryCard = (story, ownerNames) => {
  const title     = toSafeText(story.title ?? 'Untitled');
  const excerpt   = toSafeText(truncate(stripHtml(story.content)));
  const ownerName = toSafeText(ownerNames[story.owner_id] ?? 'Unknown');
  const date      = formatDate(story.updated_at);
  const href      = `/stories/${encodeURIComponent(story.id)}/view`;

  const coverHtml = story.cover_image_url
    ? `<div class="story-card-cover-wrap">
         <img class="story-card-cover" src="${toSafeText(story.cover_image_url)}" alt="${title} cover" loading="lazy" />
       </div>`
    : `<div class="story-card-cover-wrap story-card-cover-empty">
         <span aria-hidden="true">📝</span>
       </div>`;

  return `
    <article class="story-card">
      <a href="${href}" data-link class="story-card-link" aria-label="Read: ${title}">
        ${coverHtml}
        <div class="story-card-body">
          <h2 class="story-card-title">${title}</h2>
          <p class="story-card-excerpt">${excerpt}</p>
          <footer class="story-card-footer">
            <span class="story-card-owner">👤 ${ownerName}</span>
            ${ date ? `<span class="story-card-date">${date}</span>` : '' }
          </footer>
        </div>
      </a>
    </article>
  `;
};

// ─── Page export ──────────────────────────────────────────────

export const storiesPage = {
  title: 'Paw Star | Stories',

  async render(container) {
    container.innerHTML = storiesTemplate;

    const loadingEl       = container.querySelector('#stories-loading');
    const errorEl         = container.querySelector('#stories-error');
    const emptyEl         = container.querySelector('#stories-empty');
    const noResultsEl     = container.querySelector('#stories-no-results');
    const gridEl          = container.querySelector('#stories-grid');

    // ── Search bar elements ────────────────────────────────────
    const criteriaBtn     = container.querySelector('#search-criteria-btn');
    const criteriaIcon    = container.querySelector('.criteria-icon');
    const criteriaLabel   = container.querySelector('.criteria-label');
    const criteriaItems   = container.querySelectorAll('.stories-criteria-item');
    const textInput       = container.querySelector('#search-input-text');
    const dateInput       = container.querySelector('#search-input-date');
    const inputClearBtn   = container.querySelector('#search-input-clear');
    const sortDescBtn     = container.querySelector('#sort-desc');
    const sortAscBtn      = container.querySelector('#sort-asc');
    const resetBtn        = container.querySelector('#search-clear');

    let allStories  = [];
    let ownerNames  = {};
    let sortAsc     = false;             // default: newest first
    let activeCriteria = 'title';        // 'title' | 'author' | 'date'
    let filteredStories = [];            // current filtered+sorted results
    let currentPageNum  = 1;            // current pagination page

    // ── Pagination elements ──────────────────────────────────────
    const paginationEl = container.querySelector('#stories-pagination');
    const pageListEl   = container.querySelector('#stories-page-list');

    // ── Bootstrap Dropdown (dynamically injected HTML needs manual init) ────
    const dropdownInstance = new bootstrap.Dropdown(criteriaBtn);

    // ── Switch criteria ────────────────────────────────────────
    const setCriteria = (item) => {
      activeCriteria = item.dataset.criteria;
      const isDate   = activeCriteria === 'date';

      criteriaIcon.textContent  = item.dataset.icon;
      criteriaLabel.textContent = item.dataset.criteria.charAt(0).toUpperCase() + item.dataset.criteria.slice(1);

      textInput.placeholder = item.dataset.placeholder ?? '';
      textInput.value       = '';
      dateInput.value       = '';

      textInput.classList.toggle('d-none',  isDate);
      dateInput.classList.toggle('d-none', !isDate);

      criteriaItems.forEach((el) => el.classList.remove('active'));
      item.classList.add('active');

      applyFiltersAndRender();
    };

    criteriaItems.forEach((item) => {
      item.addEventListener('click', () => {
        setCriteria(item);
        dropdownInstance.hide();
      });
    });

    // ── Filtering & rendering ──────────────────────────────────
    const applyFiltersAndRender = (resetPage = true) => {
      const textVal = textInput.value.trim().toLowerCase();
      const dateVal = dateInput.value; // 'YYYY-MM-DD' or ''

      let results = allStories.filter((story) => {
        if (activeCriteria === 'title') {
          return !textVal || (story.title ?? '').toLowerCase().includes(textVal);
        }
        if (activeCriteria === 'author') {
          const name = (ownerNames[story.owner_id] ?? '').toLowerCase();
          return !textVal || name.includes(textVal);
        }
        if (activeCriteria === 'date') {
          const storyDate = story.updated_at ? story.updated_at.slice(0, 10) : '';
          return !dateVal || storyDate === dateVal;
        }
        return true;
      });

      // Sort by date
      results = results.slice().sort((a, b) => {
        const ta = new Date(a.updated_at).getTime();
        const tb = new Date(b.updated_at).getTime();
        return sortAsc ? ta - tb : tb - ta;
      });

      filteredStories = results;
      if (resetPage) currentPageNum = 1;

      const hasResults = results.length > 0;
      noResultsEl?.classList.toggle('d-none', hasResults || !allStories.length);
      emptyEl?.classList.toggle('d-none', allStories.length > 0);

      renderCurrentPage();
    };

    // ── Render one page of stories ──────────────────────────────
    const renderCurrentPage = () => {
      const start = (currentPageNum - 1) * STORIES_PER_PAGE;
      const pageItems = filteredStories.slice(start, start + STORIES_PER_PAGE);

      gridEl.innerHTML = pageItems.length
        ? pageItems.map((s) => renderStoryCard(s, ownerNames)).join('')
        : '';

      renderStoriesPagination();
    };

    // ── Render pagination controls ──────────────────────────────
    const renderStoriesPagination = () => {
      const totalPages = Math.ceil(filteredStories.length / STORIES_PER_PAGE);
      if (totalPages <= 1) {
        paginationEl?.classList.add('d-none');
        return;
      }
      paginationEl?.classList.remove('d-none');
      if (!pageListEl) return;

      const page = currentPageNum;
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
          numbersHtml += `<li class="page-item disabled"><span class="page-link stories-page-link" aria-hidden="true">…</span></li>`;
        }
        numbersHtml += `<li class="page-item${p === page ? ' active' : ''}"><button class="page-link stories-page-link" data-page="${p}"${p === page ? ' aria-current="page"' : ''}>${p}</button></li>`;
        prev = p;
      });

      pageListEl.innerHTML = `
        <li class="page-item${page <= 1 ? ' disabled' : ''}">
          <button class="page-link stories-page-link" id="stories-prev-btn" aria-label="Previous page">${PREV_SVG}</button>
        </li>
        ${numbersHtml}
        <li class="page-item${page >= totalPages ? ' disabled' : ''}">
          <button class="page-link stories-page-link" id="stories-next-btn" aria-label="Next page">${NEXT_SVG}</button>
        </li>`;

      pageListEl.querySelector('#stories-prev-btn')?.addEventListener('click', () => {
        if (currentPageNum > 1) { currentPageNum--; renderCurrentPage(); gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
      pageListEl.querySelector('#stories-next-btn')?.addEventListener('click', () => {
        if (currentPageNum < totalPages) { currentPageNum++; renderCurrentPage(); gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
      pageListEl.querySelectorAll('[data-page]').forEach((btn) =>
        btn.addEventListener('click', () => {
          currentPageNum = parseInt(btn.dataset.page, 10);
          renderCurrentPage();
          gridEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
      );
    };

    // ── Sort buttons ───────────────────────────────────────────
    const setSort = (asc) => {
      sortAsc = asc;
      sortDescBtn.classList.toggle('active', !asc);
      sortAscBtn.classList.toggle('active',   asc);
      applyFiltersAndRender();
    };

    sortDescBtn?.addEventListener('click', () => setSort(false));
    sortAscBtn?.addEventListener('click',  () => setSort(true));

    // ── Input listeners ────────────────────────────────────────
    textInput?.addEventListener('input', applyFiltersAndRender);
    dateInput?.addEventListener('input', applyFiltersAndRender);

    // ── Clear current input (×) ────────────────────────────────
    inputClearBtn?.addEventListener('click', () => {
      textInput.value = '';
      dateInput.value = '';
      textInput.focus();
      applyFiltersAndRender();
    });

    // ── Reset all filters ──────────────────────────────────────
    resetBtn?.addEventListener('click', () => {
      const titleItem = container.querySelector('.stories-criteria-item[data-criteria="title"]');
      if (titleItem) setCriteria(titleItem);
      setSort(false);
    });

    // ── Initial data load ──────────────────────────────────────
    try {
      const stories = await fetchPublishedStories();

      loadingEl?.classList.add('d-none');

      if (!stories.length) {
        emptyEl?.classList.remove('d-none');
        return;
      }

      allStories = stories;
      const uniqueOwnerIds = [...new Set(stories.map((s) => s.owner_id).filter(Boolean))];
      ownerNames = await fetchOwnerNames(uniqueOwnerIds);

      gridEl?.classList.remove('d-none');
      applyFiltersAndRender();
    } catch (err) {
      console.error('[Stories] Load failed:', err);
      loadingEl?.classList.add('d-none');
      if (errorEl) {
        errorEl.textContent = err?.message ?? 'Failed to load stories. Please try again.';
        errorEl.classList.remove('d-none');
      }
    }
  },
};