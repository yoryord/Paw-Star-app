import './index.css';
import indexTemplate from './index.html?raw';
import { isLoggedIn } from '../../lib/auth.js';

export const indexPage = {
  title: 'Paw Star | Home',
  async render(container) {
    container.innerHTML = indexTemplate;

    const loggedIn = await isLoggedIn();
    if (loggedIn) {
      const authButtons = container.querySelector('#landing-auth-buttons');
      if (authButtons) {
        authButtons.classList.add('d-none');
      }
    }
  }
};
