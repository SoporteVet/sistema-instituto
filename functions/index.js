const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const VALID_ROLES = new Set([
  'admin',
  'vida_estudiantil',
  'matriculas',
  'coordinacion',
  'director',
  'profesor',
  'estudiante',
]);

async function assertAdmin(uid) {
  const doc = await db.doc(`users/${uid}`).get();
  if (!doc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Perfil de administrador no encontrado.');
  }

  const data = doc.data();
  if (data.rol !== 'admin' || data.activo !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Solo un administrador puede realizar esta acción.');
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateUserInput({ email, password, nombre, rol, activo, requirePassword }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(nombre || '').trim();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new functions.https.HttpsError('invalid-argument', 'Ingresa un correo válido.');
  }

  if (!normalizedName || normalizedName.length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'El nombre debe tener al menos 2 caracteres.');
  }

  if (!VALID_ROLES.has(rol)) {
    throw new functions.https.HttpsError('invalid-argument', 'Selecciona un rol válido.');
  }

  if (typeof activo !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'El estado del usuario no es válido.');
  }

  if (requirePassword) {
    const pwd = String(password || '');
    if (pwd.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    }
  } else if (password != null && String(password).length > 0 && String(password).length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
  }

  return { email: normalizedEmail, nombre: normalizedName, rol, activo, password };
}

function mapAuthError(err) {
  switch (err.code) {
    case 'auth/email-already-exists':
      return new functions.https.HttpsError('already-exists', 'Ese correo ya está registrado.');
    case 'auth/invalid-email':
      return new functions.https.HttpsError('invalid-argument', 'El correo no es válido.');
    case 'auth/invalid-password':
    case 'auth/weak-password':
      return new functions.https.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    case 'auth/user-not-found':
      return new functions.https.HttpsError('not-found', 'Usuario no encontrado en Authentication.');
    default:
      return new functions.https.HttpsError('internal', 'No se pudo completar la operación en Authentication.');
  }
}

exports.createSystemUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  await assertAdmin(context.auth.uid);

  const input = validateUserInput({
    email: data?.email,
    password: data?.password,
    nombre: data?.nombre,
    rol: data?.rol,
    activo: data?.activo !== false,
    requirePassword: true,
  });

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.nombre,
      emailVerified: false,
      disabled: !input.activo,
    });
  } catch (err) {
    throw mapAuthError(err);
  }

  try {
    await db.doc(`users/${userRecord.uid}`).set({
      nombre: input.nombre,
      email: input.email,
      rol: input.rol,
      activo: input.activo,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    await auth.deleteUser(userRecord.uid).catch(() => {});
    throw new functions.https.HttpsError('internal', 'No se pudo guardar el perfil del usuario.');
  }

  return { uid: userRecord.uid };
});

exports.updateSystemUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  await assertAdmin(context.auth.uid);

  const uid = String(data?.uid || '').trim();
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID de usuario requerido.');
  }

  const input = validateUserInput({
    email: data?.email,
    password: data?.password,
    nombre: data?.nombre,
    rol: data?.rol,
    activo: data?.activo !== false,
    requirePassword: false,
  });

  const profileRef = db.doc(`users/${uid}`);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Usuario no encontrado en el sistema.');
  }

  const authUpdate = {
    email: input.email,
    displayName: input.nombre,
    disabled: !input.activo,
  };
  if (data?.password) authUpdate.password = String(data.password);

  try {
    await auth.updateUser(uid, authUpdate);
  } catch (err) {
    throw mapAuthError(err);
  }

  await profileRef.update({
    nombre: input.nombre,
    email: input.email,
    rol: input.rol,
    activo: input.activo,
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { uid };
});

exports.deleteSystemUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  await assertAdmin(context.auth.uid);

  const uid = String(data?.uid || '').trim();
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID de usuario requerido.');
  }

  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'No puedes eliminar tu propio usuario.');
  }

  await db.doc(`users/${uid}`).delete().catch(() => {});

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      throw mapAuthError(err);
    }
  }

  return { uid };
});
