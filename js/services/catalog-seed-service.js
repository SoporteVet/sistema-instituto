import { db } from '../firebase.js';
import {
  collection, doc, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COLLECTIONS, getAll } from './db.js';
import { getCatalogCourses, PLAN_ESTUDIOS_2026 } from '../logic/catalog-seed.js';

const BATCH_LIMIT = 450;

async function commitBatches(operations) {
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + BATCH_LIMIT);
    chunk.forEach(({ ref, data, merge }) => {
      if (merge) batch.set(ref, data, { merge: true });
      else batch.set(ref, data);
    });
    await batch.commit();
  }
}

function newDocRef(col) {
  return doc(collection(db, col));
}

/**
 * Carga o actualiza ATV-001..013 del Plan de Estudios 2026 en Firestore.
 * @param {(msg: string, pct: number) => void} onProgress
 * @returns {Promise<{ coursesCreated: number, coursesUpdated: number, courseByCode: object }>}
 */
export async function seedPlanEstudios2026(onProgress = () => {}) {
  const stats = { coursesCreated: 0, coursesUpdated: 0 };

  onProgress('Cargando cursos existentes…', 10);
  const existingCourses = await getAll(COLLECTIONS.COURSES, 'orden');
  const courseByCode = Object.fromEntries(existingCourses.map(c => [c.codigo, c]));
  const pendingOps = [];
  const catalog = getCatalogCourses();

  onProgress('Preparando Plan de Estudios 2026…', 30);
  for (const cat of catalog) {
    const existing = courseByCode[cat.codigo];
    const data = {
      codigo: cat.codigo,
      nombre: cat.nombre,
      orden: cat.orden,
      descripcion: cat.descripcion || '',
      notaMinima: cat.notaMinima,
      planAnio: PLAN_ESTUDIOS_2026.anio,
      paymentItems: existing?.paymentItems || cat.paymentItems || [],
      requisitos: cat.requisitos,
      actualizadoEn: serverTimestamp(),
    };

    if (existing) {
      pendingOps.push({
        ref: doc(db, COLLECTIONS.COURSES, existing.id),
        data,
        merge: true,
      });
      courseByCode[cat.codigo] = { ...existing, ...data, id: existing.id };
      stats.coursesUpdated++;
    } else {
      const ref = newDocRef(COLLECTIONS.COURSES);
      pendingOps.push({
        ref,
        data: { ...data, creadoEn: serverTimestamp() },
        merge: false,
      });
      courseByCode[cat.codigo] = { id: ref.id, ...data };
      stats.coursesCreated++;
    }
  }

  onProgress('Guardando cursos…', 60);
  if (pendingOps.length) await commitBatches(pendingOps);
  pendingOps.length = 0;

  onProgress('Vinculando prerequisitos…', 80);
  for (const cat of catalog) {
    if (!cat.prerequisitoCodigo) continue;
    const course = courseByCode[cat.codigo];
    const prev = courseByCode[cat.prerequisitoCodigo];
    if (course?.id && prev?.id) {
      pendingOps.push({
        ref: doc(db, COLLECTIONS.COURSES, course.id),
        data: { prerequisitoId: prev.id, actualizadoEn: serverTimestamp() },
        merge: true,
      });
      courseByCode[cat.codigo] = { ...course, prerequisitoId: prev.id };
    }
  }

  if (pendingOps.length) await commitBatches(pendingOps);

  onProgress('Plan de Estudios 2026 listo', 100);
  return { ...stats, courseByCode };
}
