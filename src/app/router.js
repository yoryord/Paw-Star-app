import { renderHeader } from '../components/header/header.js';
import { renderFooter } from '../components/footer/footer.js';
import { indexPage } from '../pages/index/index.js';
import { storiesPage } from '../pages/stories/stories.js';

const routes = {
  '/': indexPage,
  '/stories': storiesPage
};

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
  return routes[normalizedPath] ?? indexPage;
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
  const currentRoute = getRoute(path);
  const pageSlot = document.getElementById('page-slot') ?? renderAppShell();

  if (!pageSlot) {
    return;
  }

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
};
