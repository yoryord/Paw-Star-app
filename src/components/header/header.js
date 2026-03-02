import './header.css';
import { isLoggedIn, clearSession, getDisplayName } from '../../lib/auth.js';
import { supabaseClient } from '../../lib/supabase.js';

/** Dispatch a SPA navigation event (avoids circular dependency with router). */
const navigate = (path) => {
  window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path } }));
};

const buildNavLinks = () => {
  if (isLoggedIn()) {
    const name = getDisplayName();
    return `
      <span class="header-user-name">${name ? `Hi, ${name}` : ''}</span>
      <button type="button" class="header-link header-logout-btn nav-link border-0" id="header-logout-btn">
        Logout
      </button>
      <button class="header-link header-my-space nav-link border-0" type="button" data-page="/my-space">My Space</button>
      <button class="header-link header-stories nav-link border-0" type="button" data-page="/stories">Stories</button>
    `;
  }

  return `
    <button class="header-link nav-link border-0" type="button" data-page="/stories">Stories</button>
    <button class="header-link nav-link border-0" type="button" data-page="/login">Login</button>
    <button class="header-link nav-link border-0" type="button" data-page="/register">Create Account</button>
  `;
};

const buildHeader = () => `
  <header class="app-header border-bottom sticky-top">
    <nav class="navbar navbar-expand-lg w-100 px-0">
      <div class="container d-flex justify-content-between align-items-center">
        <a class="navbar-brand fw-semibold mb-0" href="/" data-link>Paw Star</a>
        <button class="navbar-toggler border-0 p-2" type="button"
          data-bs-toggle="collapse" data-bs-target="#navbarNav"
          aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <div class="navbar-nav ms-auto d-flex align-items-center">
            ${buildNavLinks()}
          </div>
        </div>
      </div>
    </nav>
  </header>
`;

export const renderHeader = (container) => {
  if (!container) return;

  container.innerHTML = buildHeader();

  // Handle logout button
  const logoutBtn = container.querySelector('#header-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await clearSession();
      navigate('/');
    });
  }

  // Handle navigation buttons
  const navButtons = container.querySelectorAll('[data-page]');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.getAttribute('data-page');
      navigate(page);
    });
  });
};

