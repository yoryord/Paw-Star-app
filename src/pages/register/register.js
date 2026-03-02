import './register.css';
import registerTemplate from './register.html?raw';
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

// Password strength scorer (0-3)
function scorePassword(password) {
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[0-9!@#$%^&*]/.test(password)) score++;
  return score;
}

function initStrengthBar(container) {
  const input = container.querySelector('#register-password');
  const bar = container.querySelector('#password-strength-bar');
  const fill = container.querySelector('#strength-fill');
  const label = container.querySelector('#strength-label');

  if (!input || !bar) return;

  input.addEventListener('input', () => {
    const val = input.value;
    if (!val) {
      bar.classList.add('d-none');
      return;
    }

    bar.classList.remove('d-none');
    const score = scorePassword(val);
    const levels = ['weak', 'medium', 'strong'];
    const texts  = ['Weak', 'Medium', 'Strong'];
    const level  = Math.min(score, 2);

    fill.className  = `strength-fill strength-${levels[level]}`;
    label.className = `strength-label strength-${levels[level]}`;
    label.textContent = texts[level];
  });
}

function validateConfirmPassword(container) {
  const password = container.querySelector('#register-password');
  const confirm  = container.querySelector('#register-confirm-password');

  if (!password || !confirm) return;

  const check = () => {
    if (confirm.value && confirm.value !== password.value) {
      confirm.setCustomValidity('Passwords do not match.');
      confirm.classList.add('is-invalid');
    } else {
      confirm.setCustomValidity('');
      confirm.classList.remove('is-invalid');
    }
  };

  password.addEventListener('input', check);
  confirm.addEventListener('input', check);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const registerPage = {
  title: 'Paw Star | Create Account',

  render(container) {
    container.innerHTML = registerTemplate;

    const form      = container.querySelector('#register-form');
    const alertEl   = container.querySelector('#register-alert');
    const submitBtn = container.querySelector('#register-submit');

    if (!form) return;

    initPasswordToggle(container);
    initStrengthBar(container);
    validateConfirmPassword(container);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertEl);

      // Run the confirm-password check before checkValidity
      const password = form.password.value;
      const confirm  = form.confirmPassword.value;
      const confirmInput = container.querySelector('#register-confirm-password');
      if (confirm !== password) {
        confirmInput.setCustomValidity('Passwords do not match.');
      } else {
        confirmInput.setCustomValidity('');
      }

      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      const email     = form.email.value.trim();
      const firstName = form.firstName.value.trim();
      const lastName  = form.lastName.value.trim();

      setLoading(submitBtn, true);

      try {
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName } },
        });
        if (error) throw error;

        window.dispatchEvent(new CustomEvent('paw:navigate', { detail: { path: '/my-space' } }));
      } catch (err) {
        showAlert(alertEl, err?.message ?? 'Registration failed. Please try again.', 'error');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  },
};
