import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const COLLECTIONS = {
  USERS: 'users',
  STUDENTS: 'students',
  COURSES: 'courses',
  ENROLLMENTS: 'enrollments',
  GROUPS: 'groups',
  CRONOGRAMA: 'cronograma',
  PROYECTO_FINAL: 'proyectoFinal',
  AGENDAMIENTO: 'agendamiento',
  PRACTICA_AREAS: 'practicaAreas',
  PRACTICA_REGISTROS: 'practicaRegistros',
};

export async function getAll(col, orderByField = null) {
  const ref = collection(db, col);
  const q = orderByField ? query(ref, orderBy(orderByField)) : ref;
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getById(col, id) {
  const ref = doc(db, col, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export async function create(col, data) {
  const ref = collection(db, col);
  const docRef = await addDoc(ref, { ...data, creadoEn: serverTimestamp() });
  return docRef.id;
}

export async function createWithId(col, id, data) {
  const ref = doc(db, col, id);
  await setDoc(ref, { ...data, creadoEn: serverTimestamp() });
  return id;
}

export async function update(col, id, data) {
  const ref = doc(db, col, id);
  await updateDoc(ref, { ...data, actualizadoEn: serverTimestamp() });
}

export async function remove(col, id) {
  const ref = doc(db, col, id);
  await deleteDoc(ref);
}

export async function getWhere(col, field, op, value) {
  const ref = collection(db, col);
  const q = query(ref, where(field, op, value));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getWhereMultiple(col, conditions, orderByField = null) {
  const ref = collection(db, col);
  let q = ref;
  const clauses = conditions.map(([field, op, value]) => where(field, op, value));
  if (orderByField) {
    q = query(ref, ...clauses, orderBy(orderByField));
  } else {
    q = query(ref, ...clauses);
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getEnrollmentsByStudent(studentId) {
  return getWhere(COLLECTIONS.ENROLLMENTS, 'studentId', '==', studentId);
}

export async function getEnrollmentsByCourse(courseId) {
  return getWhere(COLLECTIONS.ENROLLMENTS, 'courseId', '==', courseId);
}

export async function getStudentEnrollmentForCourse(studentId, courseId) {
  const results = await getWhereMultiple(COLLECTIONS.ENROLLMENTS, [
    ['studentId', '==', studentId],
    ['courseId', '==', courseId]
  ]);
  return results[0] || null;
}

export async function getCoursesSorted() {
  return getAll(COLLECTIONS.COURSES, 'orden');
}

export async function getGroupsSorted() {
  return getAll(COLLECTIONS.GROUPS, 'numero');
}

export async function getCronogramaByGroup(groupId) {
  return getWhere(COLLECTIONS.CRONOGRAMA, 'groupId', '==', groupId);
}
