/** Re-exporta reglas académicas + helpers de planilla. */
import { resolveEstadoFinal as resolveEstadoFinalAcademic } from './academic.js';

export {
  calcEstadoNota,
  calcNotaFinal,
  resolveEstadoFinal,
  isConvocatoriaDirecta,
  enrollmentBelongsToGroup,
  studentGroupId,
  asistenciaEnMes,
} from './academic.js';

export const ASISTENCIA_OPCIONES = [
  { value: '', label: '—' },
  { value: 'P', label: 'P' },
  { value: 'A', label: 'A' },
  { value: 'J', label: 'J' },
  { value: 'CONGELADO', label: 'CONGELADO' },
];

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatFechaClase(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const dia = Number(m[3]);
  const mes = MESES_CORTO[Number(m[2]) - 1] || '';
  return `${String(dia).padStart(2, '0')}-${mes}`;
}

export function collectFechasClase(enrollments) {
  const set = new Set();
  enrollments.forEach(e => {
    Object.keys(e.asistencia || {}).forEach(k => {
      if (k) set.add(k);
    });
  });
  return [...set].sort();
}

export function estadoNotaClass(estado) {
  const s = String(estado || '').toUpperCase();
  if (s === 'APROBADO') return 'nota-estado-aprobado';
  if (s === 'REPROBADO') return 'nota-estado-reprobado';
  if (s === 'CONVOCATORIA') return 'nota-estado-convocatoria';
  if (s === 'CONGELADO') return 'nota-estado-congelado';
  return '';
}

export function resolveEstadoFila(student, enrollment, course) {
  if (student?.estado === 'congelado') return 'CONGELADO';
  if (enrollment?.estadoNota) return String(enrollment.estadoNota).toUpperCase();
  const min = course?.notaMinima ?? 70;
  return resolveEstadoFinalAcademic(
    enrollment?.nota,
    enrollment?.notaExtraordinaria,
    '',
    min
  );
}

export function resolveEnrollmentGroupId(enrollment, student, fallbackGroupId) {
  return enrollment?.groupId || student?.grupoId || student?.groupId || fallbackGroupId || '';
}
