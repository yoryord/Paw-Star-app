import './login.css';
import loginTemplate from './login.html?raw';
import { supabaseClient } from '../../lib/supabase.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function showAlert(el, message, type = 'error') {
  el.textContent = message;
  el.className = `auth-alert ${type === 'error' ? 'alert-error' : 'alert-success'}`;
  el.classList.remove('d-none');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert(el) {
  el.classList.add('d-none');
  el.className = 'auth-alert d-none';
}

function setLoading(btn, loading) {
  const label = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.spinner-border');
  btn.disabled = loading;
  if (loading) {
    label.style.opacity = '0.6';
    spinner.classList.remove('d-none');
  } else {
    label.style.opacity = '';
    spinner.classList.add('d-none');
  }
}

function initPasswordToggle(container) {
  container.querySelectorAll('.auth-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = container.getElementById(btn.dataset.target);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.querySelector('.eye-open').classList.toggle('d-none', isPassword);
      btn.querySelector('.eye-slash').classList.toggle('d-none', !isPassword);
    });
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const loginPage = {
  title: 'Paw Star | Sign In',

  render(container) {
    container.innerHTML = loginTemplate;

    const form = container.querySelector('#login-form');
    const alertEl = container.querySelector('#login-alert');
    const submitBtn = container.querySelector('#login-submit');

    if (!form) return;

    // Password visibility toggle
    initPasswordToggle(container);

    // Client-side validation + submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertEl);

      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      const email = form.email.value.trim();
      const password = form.password.value;

      setLoading(submitBtn, true);

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/my-space' } }));
      } catch (err) {
        showAlert(alertEl, err?.message ?? 'Login failed. Please check your credentials.', 'error');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  },
};
