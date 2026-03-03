import './stories.css';
import storiesTemplate from './stories.html?raw';
import { supabaseClient } from '../../lib/supabase.js';

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

    const loadingEl = container.querySelector('#stories-loading');
    const errorEl   = container.querySelector('#stories-error');
    const emptyEl   = container.querySelector('#stories-empty');
    const gridEl    = container.querySelector('#stories-grid');

    try {
      const stories = await fetchPublishedStories();

      loadingEl?.classList.add('d-none');

      if (!stories.length) {
        emptyEl?.classList.remove('d-none');
        return;
      }

      const uniqueOwnerIds = [...new Set(stories.map((s) => s.owner_id).filter(Boolean))];
      const ownerNames = await fetchOwnerNames(uniqueOwnerIds);

      gridEl.innerHTML = stories.map((s) => renderStoryCard(s, ownerNames)).join('');
      gridEl?.classList.remove('d-none');
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