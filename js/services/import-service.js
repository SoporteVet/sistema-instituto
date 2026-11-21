import { db } from '../firebase.js';
import {
  collection, doc, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { COLLECTIONS, getAll } from './db.js';
import { seedPlanEstudios2026 } from './catalog-seed-service.js';

const BATCH_LIMIT = 450;

export const DEFAULT_IMPORT_OPTIONS = {
  seedCatalog: true,
  createGroups: true,
  updateStudents: true,
  updateEnrollments: true,
};

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
 * @param {object[]} validRows - filas válidas del parser
 * @param {object} options
 * @param {(msg: string, pct: number) => void} onProgress
 */
export async function runImport(validRows, options = {}, onProgress = () => {}) {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
  const stats = {
    coursesCreated: 0,
    coursesUpdated: 0,
    groupsCreated: 0,
    groupsUpdated: 0,
    studentsCreated: 0,
    studentsUpdated: 0,
    enrollmentsCreated: 0,
    enrollmentsUpdated: 0,
  };

  const estudianteRows = validRows.filter(r => r.rowType === 'estudiante');
  const matriculaRows = validRows.filter(r => r.rowType === 'matricula');
  const hasMatricula = matriculaRows.length > 0;
  const hasEstudiantes = estudianteRows.length > 0;

  onProgress('Iniciando importación…', 2);
  onProgress('Cargando datos existentes…', 5);
  const [existingCourses, existingGroups, existingStudents, existingEnrollments] = await Promise.all([
    getAll(COLLECTIONS.COURSES, 'orden'),
    getAll(COLLECTIONS.GROUPS, 'numero'),
    getAll(COLLECTIONS.STUDENTS),
    getAll(COLLECTIONS.ENROLLMENTS),
  ]);

  const courseByCode = Object.fromEntries(existingCourses.map(c => [c.codigo, c]));
  const groupByNumero = Object.fromEntries(existingGroups.map(g => [Number(g.numero), g]));
  const studentByDoc = Object.fromEntries(
    existingStudents.filter(s => s.documento).map(s => [String(s.documento), s])
  );
  const enrollmentKey = (sid, cid) => `${sid}__${cid}`;
  const enrollmentByKey = Object.fromEntries(
    existingEnrollments.map(e => [enrollmentKey(e.studentId, e.courseId), e])
  );

  const pendingOps = [];

  // ── 1. Catálogo ATV (solo si hay filas de matrícula/inscripción) ───────────
  if (hasMatricula && opts.seedCatalog) {
    onProgress('Preparando catálogo de cursos…', 15);
    const catResult = await seedPlanEstudios2026((msg, pct) => onProgress(msg, 15 + Math.round(pct * 0.1)));
    stats.coursesCreated += catResult.coursesCreated;
    stats.coursesUpdated += catResult.coursesUpdated;
    Object.assign(courseByCode, catResult.courseByCode);
  }

  onProgress('Cursos listos…', 25);

  // ── 2. Grupos (padrón + matrícula) ────────────────────────────────────────
  const rowsWithGrupo = [...matriculaRows, ...estudianteRows];
  const groupNumeros = [...new Set(rowsWithGrupo.map(r => r.grupoNumero).filter(Boolean))];

  if (opts.createGroups && groupNumeros.length) {
    onProgress('Preparando grupos…', 35);
    const groupHorarios = {};
    rowsWithGrupo.forEach(r => {
      if (r.grupoNumero && r.horario && !groupHorarios[r.grupoNumero]) {
        groupHorarios[r.grupoNumero] = r.horario;
      }
    });

    for (const numero of groupNumeros) {
      const existing = groupByNumero[numero];
      const sample = rowsWithGrupo.find(r => r.grupoNumero === numero);
      const fechaRef = sample?.fechaInicio || sample?.fechaIngreso || '';
      const data = {
        numero,
        nombre: `Grupo ${numero}`,
        anio: fechaRef ? Number(fechaRef.slice(0, 4)) || new Date().getFullYear() : new Date().getFullYear(),
        fechaInicio: fechaRef,
        horario: groupHorarios[numero] || '',
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

  onProgress('Guardando grupos…', 45);
  if (pendingOps.length) await commitBatches(pendingOps);
  pendingOps.length = 0;

  // ── 3. Estudiantes (padrón + matrícula) ───────────────────────────────────
  onProgress('Preparando estudiantes…', 55);

  function upsertStudent(row, extra = {}) {
    const existing = studentByDoc[row.documento];
    const estado = row.estado || (row.estadoImport === 'congelado' ? 'congelado' : 'activo');
    const data = {
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      documento: row.documento,
      email: row.email || '',
      email2: row.email2 || '',
      telefono: row.telefono || '',
      fechaIngreso: row.fechaIngreso || row.fechaInicio || '',
      fechaNacimiento: row.fechaNacimiento || '',
      estado,
      direccion: '',
      notas: row.notas || '',
      ...extra,
      actualizadoEn: serverTimestamp(),
    };

    if (existing) {
      if (opts.updateStudents) {
        pendingOps.push({
          ref: doc(db, COLLECTIONS.STUDENTS, existing.id),
          data,
          merge: true,
        });
        studentByDoc[row.documento] = { ...existing, ...data, id: existing.id };
        stats.studentsUpdated++;
      }
    } else {
      const ref = newDocRef(COLLECTIONS.STUDENTS);
      pendingOps.push({
        ref,
        data: { ...data, creadoEn: serverTimestamp() },
        merge: false,
      });
      studentByDoc[row.documento] = { id: ref.id, ...data };
      stats.studentsCreated++;
    }
  }

  const studentRowsMap = new Map();
  estudianteRows.forEach(r => studentRowsMap.set(r.documento, r));
  matriculaRows.forEach(r => {
    if (!studentRowsMap.has(r.documento) || r.fechaInicio) {
      studentRowsMap.set(r.documento, r);
    }
  });

  for (const row of studentRowsMap.values()) {
    const group = groupByNumero[row.grupoNumero];
    upsertStudent(row, group?.id ? { grupoId: group.id } : {});
  }

  onProgress('Guardando estudiantes…', 65);
  if (pendingOps.length) await commitBatches(pendingOps);
  pendingOps.length = 0;

  // Refrescar estudiantes si hubo creates (ids ya en map)

  // ── 4. Inscripciones (solo matrícula) ─────────────────────────────────────
  if (hasMatricula) {
    onProgress('Preparando inscripciones…', 75);
    for (const row of matriculaRows) {
      const student = studentByDoc[row.documento];
      const course = courseByCode[row.codigoCurso];
      const group = groupByNumero[row.grupoNumero];
      if (!student?.id || !course?.id) continue;

      const key = enrollmentKey(student.id, course.id);
      const existing = enrollmentByKey[key];
      const paymentItems = course.paymentItems || [];
      const pagos = existing?.pagos || {};
      paymentItems.forEach(item => {
        if (!pagos[item.id]) pagos[item.id] = { pagado: false, fecha: null };
      });

      const data = {
        studentId: student.id,
        courseId: course.id,
        ...(group?.id ? { groupId: group.id } : {}),
        nota: row.nota,
        profesor: row.profesor || '',
        horario: row.horario || '',
        tipoMatricula: row.tipoMatricula || 'normal',
        pagos,
        actualizadoEn: serverTimestamp(),
      };

      if (existing) {
        if (opts.updateEnrollments) {
          pendingOps.push({
            ref: doc(db, COLLECTIONS.ENROLLMENTS, existing.id),
            data,
            merge: true,
          });
          stats.enrollmentsUpdated++;
        } else if (group?.id && existing.groupId !== group.id) {
          pendingOps.push({
            ref: doc(db, COLLECTIONS.ENROLLMENTS, existing.id),
            data: { groupId: group.id, actualizadoEn: serverTimestamp() },
            merge: true,
          });
          stats.enrollmentsUpdated++;
        }
      } else {
        const ref = newDocRef(COLLECTIONS.ENROLLMENTS);
        pendingOps.push({
          ref,
          data: { ...data, creadoEn: serverTimestamp() },
          merge: false,
        });
        enrollmentByKey[key] = { id: ref.id, ...data };
        stats.enrollmentsCreated++;
      }
    }

    onProgress('Guardando inscripciones…', 90);
    if (pendingOps.length) await commitBatches(pendingOps);
    pendingOps.length = 0;
  }

  if (!hasMatricula && hasEstudiantes) {
    onProgress('Importación de estudiantes completada', 100);
  } else {
    onProgress('Importación completada', 100);
  }
  return stats;
}
