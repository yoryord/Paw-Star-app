import './not-found.css';
import notFoundTemplate from './not-found.html?raw';

const REDIRECT_DELAY_S = 5;

export const notFoundPage = {
  title: 'Paw Star | Page Not Found',

  render(container) {
    container.innerHTML = notFoundTemplate;

    const goHome = () => {
      window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/' } }));
    };

    // Wire up the button
    container.querySelector('#not-found-home-btn')?.addEventListener('click', goHome);

    // Countdown timer
    const countdownEl = container.querySelector('#not-found-countdown');
    let remaining = REDIRECT_DELAY_S;
    let timerId = null;

    const tick = () => {
      remaining -= 1;
      if (countdownEl) countdownEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(timerId);
        goHome();
      }
    };

    timerId = setInterval(tick, 1000);

    // Clean up timer if the user navigates away before it fires
    const cleanup = () => {
      clearInterval(timerId);
      window.removeEventListener('paw:navigate', cleanup);
    };
    window.addEventListener('paw:navigate', cleanup, { once: true });
  },
};
