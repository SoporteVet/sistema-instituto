import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { app, firebaseConfig } from '../firebase.js';
import { COLLECTIONS, createWithId, update, remove } from './db.js';

const functions = getFunctions(app);
const SECONDARY_APP = 'user-admin';

function getCallable(name) {
  return httpsCallable(functions, name);
}

function isFunctionsUnavailable(err) {
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  return (
    code === 'functions/not-found' ||
    code === 'functions/unavailable' ||
    code === 'functions/internal' ||
    code === 'functions/failed-precondition' && /blaze|billing|cloud run/i.test(message) ||
    /NOT_FOUND|not found|Cloud Run|Cloud Functions|billing|Blaze/i.test(message)
  );
}

function getSecondaryAuth() {
  const secondary = getApps().some(a => a.name === SECONDARY_APP)
    ? getApp(SECONDARY_APP)
    : initializeApp(firebaseConfig, SECONDARY_APP);
  return getAuth(secondary);
}

function mapClientAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') {
    const mapped = new Error('Ese correo ya está registrado.');
    mapped.code = 'functions/already-exists';
    return mapped;
  }
  if (code === 'auth/invalid-email') {
    return new Error('El correo no es válido.');
  }
  if (code === 'auth/weak-password' || code === 'auth/invalid-password') {
    return new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  return err;
}

async function createSystemUserClient(payload) {
  const adminAuth = getSecondaryAuth();
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(
      adminAuth,
      String(payload.email || '').trim(),
      String(payload.password || '')
    );
  } catch (err) {
    await signOut(adminAuth).catch(() => {});
    throw mapClientAuthError(err);
  }

  try {
    await createWithId(COLLECTIONS.USERS, cred.user.uid, {
      nombre: String(payload.nombre || '').trim(),
      email: String(payload.email || '').trim().toLowerCase(),
      rol: payload.rol,
      activo: payload.activo !== false,
    });
  } catch (err) {
    await signOut(adminAuth).catch(() => {});
    throw err;
  }

  await signOut(adminAuth).catch(() => {});
  return { uid: cred.user.uid };
}

async function updateSystemUserClient(payload) {
  if (payload.password) {
    throw new Error('En el plan gratuito no se puede cambiar la contraseña de otro usuario. Cambia el resto de datos o crea un usuario nuevo.');
  }

  await update(COLLECTIONS.USERS, payload.uid, {
    nombre: String(payload.nombre || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    rol: payload.rol,
    activo: payload.activo !== false,
  });
  return { uid: payload.uid };
}

async function deleteSystemUserClient(uid) {
  await remove(COLLECTIONS.USERS, uid);
  return { uid };
}

export function getUserApiError(err) {
  const code = err?.code || '';
  const message = err?.message || '';

  if (code === 'functions/unauthenticated') return 'Debes iniciar sesión.';
  if (code === 'functions/permission-denied') return message || 'No tienes permiso para esta acción.';
  if (code === 'functions/already-exists' || code === 'auth/email-already-in-use') {
    return message || 'Ese correo ya está registrado.';
  }
  if (code === 'functions/invalid-argument') return message || 'Revisa los datos del formulario.';
  if (code === 'functions/not-found') return message || 'Usuario no encontrado.';
  if (code === 'functions/failed-precondition') return message || 'No se puede completar la acción.';
  if (code === 'permission-denied') return 'No tienes permiso para guardar este usuario.';

  return message || 'Error al procesar la solicitud de usuario.';
}

export async function createSystemUser(payload) {
  try {
    const result = await getCallable('createSystemUser')(payload);
    return result.data;
  } catch (err) {
    if (!isFunctionsUnavailable(err)) throw err;
    return createSystemUserClient(payload);
  }
}

export async function updateSystemUser(payload) {
  try {
    const result = await getCallable('updateSystemUser')(payload);
    return result.data;
  } catch (err) {
    if (!isFunctionsUnavailable(err)) throw err;
    return updateSystemUserClient(payload);
  }
}

export async function deleteSystemUser(uid) {
  try {
    const result = await getCallable('deleteSystemUser')({ uid });
    return result.data;
  } catch (err) {
    if (!isFunctionsUnavailable(err)) throw err;
    return deleteSystemUserClient(uid);
  }
}
