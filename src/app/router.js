import { renderHeader } from '../components/header/header.js';
import { renderFooter } from '../components/footer/footer.js';
import { indexPage } from '../pages/index/index.js';
import { storiesPage } from '../pages/stories/stories.js';
import { loginPage } from '../pages/login/login.js';
import { registerPage } from '../pages/register/register.js';
import { mySpacePage } from '../pages/my-space/my-space.js';
import { profilePage } from '../pages/profile/profile.js';
import { notFoundPage } from '../pages/not-found/not-found.js';
import { isLoggedIn } from '../lib/auth.js';

const routes = {
  '/': indexPage,
  '/stories': storiesPage,
  '/login': loginPage,
  '/register': registerPage,
  '/my-space': mySpacePage,
  '/profile': profilePage,
  '/404': notFoundPage,
};

/** Routes that require an authenticated session. */
const protectedRoutes = new Set(['/my-space', '/profile']);

const normalizePath = (path) => {
  if (!path) {
    return '/';
  }

  if (path !== '/' && path.endsWith('/')) {
    return path.slice(0, -1);
  }

  return path;
};

const getRoute = (path) => {
  const normalizedPath = normalizePath(path);
  return routes[normalizedPath] ?? notFoundPage;
};

const renderAppShell = () => {
  const app = document.getElementById('app');

  if (!app) {
    return null;
  }

  app.innerHTML = `
    <div class="d-flex flex-column min-vh-100">
      <div id="header-slot"></div>
      <main id="page-slot" class="flex-grow-1"></main>
      <div id="footer-slot"></div>
    </div>
  `;

  renderHeader(document.getElementById('header-slot'));
  renderFooter(document.getElementById('footer-slot'));

  return document.getElementById('page-slot');
};

const renderRoute = (path) => {
  const normalizedPath = normalizePath(path);

  // Auth guard: redirect unauthenticated users away from protected routes
  if (protectedRoutes.has(normalizedPath) && !isLoggedIn()) {
    window.history.replaceState({}, '', '/404');
    const pageSlot = document.getElementById('page-slot') ?? renderAppShell();
    if (pageSlot) {
      notFoundPage.render(pageSlot);
      document.title = notFoundPage.title;
    }
    return;
  }

  const currentRoute = getRoute(normalizedPath);
  const pageSlot = document.getElementById('page-slot') ?? renderAppShell();

  if (!pageSlot) {
    return;
  }

  // Re-render header on every navigation so auth state is always reflected
  const headerSlot = document.getElementById('header-slot');
  if (headerSlot) renderHeader(headerSlot);

  currentRoute.render(pageSlot);
  document.title = currentRoute.title;
};

export const navigateTo = (path) => {
  const targetPath = normalizePath(path);

  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, '', targetPath);
  }

  renderRoute(targetPath);
};

const handleLinkClick = (event) => {
  const link = event.target.closest('a[data-link]');

  if (!link) {
    return;
  }

  event.preventDefault();
  navigateTo(link.getAttribute('href'));
};

export const initRouter = () => {
  renderAppShell();
  renderRoute(window.location.pathname);

  window.addEventListener('popstate', () => renderRoute(window.location.pathname));
  document.addEventListener('click', handleLinkClick);

  // Pages dispatch this event to trigger SPA navigation without importing navigateTo
  window.addEventListener('paw:navigate', (e) => navigateTo(e.detail?.path ?? '/'));
};
