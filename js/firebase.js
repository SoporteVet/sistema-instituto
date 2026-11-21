import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  initializeFirestore,
  memoryLocalCache
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export { app };
export const auth = getAuth(app);
// Evita leer cache local vacia cuando la red esta bloqueada (ad blockers)
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export { firebaseConfig };
