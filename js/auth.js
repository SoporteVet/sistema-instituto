import { auth, db, firebaseConfig } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDocFromServer
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COLLECTIONS } from './services/db.js';
import { ROLES, getRoleLabel, canAccess, canEditStudents, canManageEnrollments, canMarkPractica } from './logic/permissions.js';

async function fetchUserProfile(uid) {
  await auth.currentUser?.getIdToken(true);
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const snapshot = await getDocFromServer(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

function isUserActive(userData) {
  if (!userData) return false;
  const activo = userData.activo;
  return activo !== false && activo !== 'false' && activo !== 0;
}

// ─── Module-level state ───────────────────────────────────────────────────────

let _currentUser = null;
let _currentRole = null;
let _currentUserData = null;

export function getCurrentUser()     { return _currentUser; }
export function getCurrentRole()     { return _currentRole; }
export function getCurrentUserData() { return _currentUserData; }
export function isAdmin()            { return _currentRole === ROLES.ADMIN; }
export function isTeacher()          { return _currentRole === ROLES.PROFESOR; }
export function canEditStudentRecords() { return canEditStudents(_currentRole); }
export function canManageEnrollmentRecords() { return canManageEnrollments(_currentRole); }
export function canMarkPracticaHours() { return canMarkPractica(_currentRole); }
export function isAuthenticated()    { return _currentUser !== null; }

// Etiqueta legible del rol actual.
export function currentRoleLabel()   { return getRoleLabel(_currentRole); }

// Indica si el usuario actual puede acceder a una ruta/panel.
export function hasAccess(route)     { return canAccess(route, _currentRole); }

// ─── Auth actions ─────────────────────────────────────────────────────────────

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  _currentUser = null;
  _currentRole = null;
  _currentUserData = null;
  await signOut(auth);
}

// ─── Auth state listener ──────────────────────────────────────────────────────

/**
 * Initializes Firebase auth state listener.
 * @param {{ onLogin: (user, userData) => void, onLogout: (reason?) => void }} callbacks
 */
export function initAuth({ onLogin, onLogout }) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        console.info('[Auth] Buscando perfil en Firestore:', {
          projectId: firebaseConfig.projectId,
          path: `users/${user.uid}`,
          email: user.email,
        });

        const userData = await fetchUserProfile(user.uid);

        if (!userData || !isUserActive(userData)) {
          _currentUser = null;
          _currentRole = null;
          _currentUserData = null;
          await signOut(auth);
          onLogout('unauthorized', { uid: user.uid, email: user.email });
          return;
        }

        _currentUser = user;
        _currentRole = userData.rol;
        _currentUserData = userData;
        onLogin(user, userData);
      } catch (err) {
        console.error('Error fetching user data:', err);
        _currentUser = null;
        _currentRole = null;
        _currentUserData = null;
        await signOut(auth);
        let reason = 'error';
        if (err?.code === 'permission-denied') reason = 'permission';
        else if (err?.code === 'unavailable' || err?.message?.includes('network')) reason = 'network';
        onLogout(reason, { uid: user.uid, email: user.email, detail: err?.code || err?.message });
      }
    } else {
      _currentUser = null;
      _currentRole = null;
      _currentUserData = null;
      onLogout();
    }
  });
}

// ─── Sidebar nav visibility ───────────────────────────────────────────────────

export function applyRoleVisibility() {
  // Muestra/oculta cada enlace de navegación según los permisos del rol actual.
  document.querySelectorAll('.nav-link[data-route]').forEach(el => {
    el.style.display = canAccess(el.dataset.route, _currentRole) ? '' : 'none';
  });

  // Oculta secciones del sidebar que se quedaron sin enlaces visibles.
  document.querySelectorAll('.nav-section').forEach(section => {
    let node = section.nextElementSibling;
    let hasVisible = false;
    while (node && !node.classList.contains('nav-section')) {
      if (node.classList.contains('nav-link') && node.style.display !== 'none') {
        hasVisible = true;
        break;
      }
      node = node.nextElementSibling;
    }
    section.style.display = hasVisible ? '' : 'none';
  });
}
