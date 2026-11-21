import { initAuth, login, logout, applyRoleVisibility, currentRoleLabel, getCurrentRole } from './auth.js';
import { initRouter } from './router.js';
import { navigateTo } from './nav.js';
import { showToast } from './ui.js';
import { canAccess, homeRoute } from './logic/permissions.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const loginScreen = document.getElementById('login-screen');
const appShell    = document.getElementById('app');
const loginForm   = document.getElementById('login-form');
const loginError  = document.getElementById('login-error');
const loginBtn    = document.getElementById('login-btn');
const userNameEl  = document.getElementById('sidebar-user-name');
const userRoleEl  = document.getElementById('sidebar-user-role');
const logoutBtn   = document.getElementById('btn-logout');
const menuToggle  = document.getElementById('btn-menu-toggle');
const sidebar     = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// ─── Auth callbacks ───────────────────────────────────────────────────────────

function resetLoginButton() {
  if (loginBtn) {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Ingresar';
  }
}

function onLogin(user, userData) {
  resetLoginButton();
  // Populate user info
  if (userNameEl) userNameEl.textContent = userData.nombre || user.email;
  if (userRoleEl) userRoleEl.textContent = currentRoleLabel();

  // Apply role-based nav visibility
  applyRoleVisibility();

  // Show app, hide login
  loginScreen?.classList.add('hidden');
  appShell?.classList.remove('hidden');

  const raw = (window.location.hash || '').replace(/^#\/?/, '');
  const key = raw.split('/')[0] || 'dashboard';
  if (!canAccess(key, getCurrentRole())) {
    window.location.hash = `#/${homeRoute(getCurrentRole())}`;
  }

  // Init router on first login
  initRouter();
}

function onLogout(reason, context = {}) {
  resetLoginButton();
  appShell?.classList.add('hidden');
  loginScreen?.classList.remove('hidden');

  const uidLine = context.uid
    ? ` UID de tu sesion: ${context.uid}`
    : '';

  if (reason === 'unauthorized') {
    showLoginError(
      `No se encontro tu perfil en Firestore.${uidLine} ` +
      `Verifica que exista el documento users/${context.uid || '{UID}'} ` +
      `con rol admin y activo true (boolean). El ID del documento debe ser exactamente ese UID.`
    );
  } else if (reason === 'permission') {
    showLoginError(
      `Sin permiso para leer tu perfil.${uidLine} Publica las reglas de Firestore Database (no Realtime Database).`
    );
  } else if (reason === 'network') {
    showLoginError(
      'No se pudo conectar a Firestore. Desactiva bloqueadores de anuncios (uBlock, AdGuard) o prueba en ventana de incognito.'
    );
  } else if (reason === 'error') {
    showLoginError(
      `Error al verificar tu acceso.${uidLine} Abre F12 > Console y revisa el error. Detalle: ${context.detail || 'desconocido'}`
    );
  }
}

// ─── Login form ───────────────────────────────────────────────────────────────

loginForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = loginForm.querySelector('[name="email"]').value.trim();
  const password = loginForm.querySelector('[name="password"]').value;

  loginError?.classList.add('hidden');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Ingresando…';

  try {
    await login(email, password);
    // onLogin fires via onAuthStateChanged
  } catch (err) {
    const msg = getLoginErrorMessage(err.code);
    showLoginError(msg);
    loginBtn.disabled = false;
    loginBtn.textContent = 'Ingresar';
  }
});

function showLoginError(msg) {
  if (!loginError) return;
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function getLoginErrorMessage(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':   return 'Email o contraseña incorrectos.';
    case 'auth/too-many-requests': return 'Demasiados intentos. Espera unos minutos.';
    case 'auth/network-request-failed': return 'Sin conexión. Verifica tu internet.';
    default: return 'Error al iniciar sesión. Intenta de nuevo.';
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

logoutBtn?.addEventListener('click', async () => {
  try {
    await logout();
  } catch {}
});

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-link[data-route]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.route);
    // Close sidebar on mobile
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');
  });
});

// ─── Mobile sidebar toggle ───────────────────────────────────────────────────

menuToggle?.addEventListener('click', () => {
  sidebar?.classList.toggle('open');
  sidebarOverlay?.classList.toggle('active');
});

sidebarOverlay?.addEventListener('click', () => {
  sidebar?.classList.remove('open');
  sidebarOverlay?.classList.remove('active');
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

// En desarrollo local, quitar service workers viejos de otros proyectos en :5500
if (
  (location.hostname === '127.0.0.1' || location.hostname === 'localhost') &&
  'serviceWorker' in navigator
) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .catch(() => {});
}

initAuth({ onLogin, onLogout });
