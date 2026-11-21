import { db } from '../firebase.js';
import {
  collection, doc, writeBatch, serverTimestamp, getDocs, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COLLECTIONS, getAll } from './db.js';
import {
  CRONOGRAMA_ASIGNACIONES,
  CRONOGRAMA_GRUPOS,
  mesToCuatrimestre,
  monthDateRange,
} from '../logic/cronograma-seed.js';

const BATCH_LIMIT = 450;

async function commitBatches(operations) {
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    operations.slice(i, i + BATCH_LIMIT).forEach(({ ref, data, merge }) => {
      if (merge) batch.set(ref, data, { merge: true });
      else batch.set(ref, data);
    });
    await batch.commit();
  }
}

function newDocRef(col) {
  return doc(collection(db, col));
}

async function deleteCronogramaForGroups(groupIds) {
  const pending = [];
  for (const groupId of groupIds) {
    const snap = await getDocs(query(collection(db, COLLECTIONS.CRONOGRAMA), where('groupId', '==', groupId)));
    snap.docs.forEach(d => pending.push({ ref: d.ref }));
  }

  for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    pending.slice(i, i + BATCH_LIMIT).forEach(({ ref }) => batch.delete(ref));
    await batch.commit();
  }

  return pending.length;
}

export async function seedOfficialCronograma(options = {}, onProgress = () => {}) {
  const { replaceExisting = true, createGroups = true } = options;
  const stats = {
    groupsCreated: 0,
    groupsUpdated: 0,
    entriesCreated: 0,
    entriesDeleted: 0,
    skipped: [],
  };

  onProgress('Cargando grupos y cursos…', 10);
  const [existingGroups, courses] = await Promise.all([
    getAll(COLLECTIONS.GROUPS, 'numero'),
    getAll(COLLECTIONS.COURSES, 'orden'),
  ]);

  const groupByNumero = Object.fromEntries(existingGroups.map(g => [Number(g.numero), g]));
  const courseByCode = Object.fromEntries(courses.map(c => [c.codigo, c]));
  const pendingOps = [];

  if (createGroups) {
    onProgress('Preparando grupos 8–13…', 25);
    for (const numero of CRONOGRAMA_GRUPOS) {
      const existing = groupByNumero[numero];
      const data = {
        numero,
        nombre: `Grupo ${numero}`,
        anio: 2026,
        fechaInicio: '',
        horario: '',
        sede: 'Central',
        estado: 'activo',
        observaciones: '',
        actualizadoEn: serverTimestamp(),
      };

      if (existing) {
        pendingOps.push({
          ref: doc(db, COLLECTIONS.GROUPS, existing.id),
          data,
          merge: true,
        });
        groupByNumero[numero] = { ...existing, ...data };
        stats.groupsUpdated++;
      } else {
        const ref = newDocRef(COLLECTIONS.GROUPS);
        pendingOps.push({
          ref,
          data: { ...data, creadoEn: serverTimestamp() },
          merge: false,
        });
        groupByNumero[numero] = { id: ref.id, ...data };
        stats.groupsCreated++;
      }
    }
  }

  if (pendingOps.length) await commitBatches(pendingOps);
  pendingOps.length = 0;

  const affectedGroupIds = CRONOGRAMA_GRUPOS.map(n => groupByNumero[n]?.id).filter(Boolean);

  if (replaceExisting && affectedGroupIds.length) {
    onProgress('Limpiando cronograma anterior…', 40);
    stats.entriesDeleted = await deleteCronogramaForGroups(affectedGroupIds);
  }

  onProgress('Generando entradas del cronograma…', 55);
  const entryMap = new Map();

  for (const asig of CRONOGRAMA_ASIGNACIONES) {
    const course = courseByCode[asig.codigo];
    if (!course) {
      stats.skipped.push(`Curso ${asig.codigo} no encontrado`);
      continue;
    }

    const { start, end } = monthDateRange(asig.mes, asig.anio);
    const bloque = {
      fechaInicio: start,
      fechaFin: end,
      tipo: 'teoria',
      descripcion: `${asig.profesor} · ${asig.mes}/${asig.anio}`,
    };

    for (const numeroGrupo of asig.grupos) {
      const group = groupByNumero[numeroGrupo];
      if (!group?.id) {
        stats.skipped.push(`Grupo ${numeroGrupo} no encontrado`);
        continue;
      }

      const key = `${group.id}__${course.id}`;
      const existing = entryMap.get(key);

      if (existing) {
        existing.bloques.push(bloque);
      } else {
        entryMap.set(key, {
          groupId: group.id,
          courseId: course.id,
          codigo: course.codigo,
          materiaNombre: course.nombre,
          profesor: asig.profesor,
          cuatrimestre: mesToCuatrimestre(asig.mes),
          orden: course.orden || 0,
          bloques: [bloque],
          horasTeoricas: 0,
          horasPracticas: 0,
          seguimiento: '',
        });
      }
    }
  }

  onProgress('Guardando cronograma…', 75);
  for (const data of entryMap.values()) {
    pendingOps.push({
      ref: newDocRef(COLLECTIONS.CRONOGRAMA),
      data: { ...data, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() },
      merge: false,
    });
    stats.entriesCreated++;
  }

  if (pendingOps.length) await commitBatches(pendingOps);

  onProgress('Cronograma oficial cargado', 100);
  return stats;
}
