import './my-space.css';
import mySpaceTemplate from './my-space.html?raw';
import { getSession, isLoggedIn } from '../../lib/auth.js';

export const mySpacePage = {
  title: 'Paw Star | My Space',

  render(container) {
    // Guard: redirect to login if not authenticated
    if (!isLoggedIn()) {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/login' } }));
      return;
    }

    container.innerHTML = mySpaceTemplate;

    // Personalise the greeting with user data
    const session = getSession();
    const meta = session?.user?.user_metadata ?? {};
    const firstName = meta.first_name ?? '';
    const lastName  = meta.last_name  ?? '';
    const email     = session?.user?.email ?? '';

    const greetingEl = container.querySelector('#my-space-greeting');
    const emailEl    = container.querySelector('#my-space-email');

    if (greetingEl && firstName) {
      greetingEl.textContent = `Hi, ${firstName}${lastName ? ' ' + lastName : ''}!`;
    }

    if (emailEl && email) {
      emailEl.textContent = email;
    }
  },
};
