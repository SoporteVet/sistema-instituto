/** Reglas académicas compartidas (notas, convocatoria, historial). */

export function calcEstadoNota(nota, notaMinima = 70) {
  if (nota === null || nota === undefined || nota === '') return '';
  const n = Number(nota);
  if (!Number.isFinite(n)) return '';
  if (n >= notaMinima) return 'APROBADO';
  if (n >= 60) return 'CONVOCATORIA';
  return 'REPROBADO';
}

/** Nota final efectiva: extraordinaria reemplaza ordinaria si es mayor. */
export function calcNotaFinal(ordinaria, extraordinaria) {
  const o = ordinaria !== null && ordinaria !== undefined && ordinaria !== ''
    ? Number(ordinaria) : null;
  const e = extraordinaria !== null && extraordinaria !== undefined && extraordinaria !== ''
    ? Number(extraordinaria) : null;
  const oOk = o !== null && Number.isFinite(o);
  const eOk = e !== null && Number.isFinite(e);
  if (eOk && oOk) return Math.max(o, e);
  if (eOk) return e;
  if (oOk) return o;
  return null;
}

export function resolveEstadoFinal(ordinaria, extraordinaria, estadoNotaManual, notaMinima = 70) {
  if (estadoNotaManual) {
    const s = String(estadoNotaManual).toUpperCase();
    if (s === 'CONGELADO') return 'CONGELADO';
  }
  const final = calcNotaFinal(ordinaria, extraordinaria);
  if (final === null) return estadoNotaManual ? String(estadoNotaManual).toUpperCase() : '';
  return calcEstadoNota(final, notaMinima);
}

/** Estudiante va directo a convocatoria (60–69 sin extraordinaria aprobatoria). */
export function isConvocatoriaDirecta(enrollment, course) {
  const min = course?.notaMinima ?? 70;
  const ordinaria = enrollment?.nota;
  const extra = enrollment?.notaExtraordinaria;
  const final = calcNotaFinal(ordinaria, extra);
  if (final !== null && final >= min) return false;
  if (String(enrollment?.estadoNota || '').toUpperCase() === 'APROBADO') return false;
  const n = Number(ordinaria);
  return Number.isFinite(n) && n >= 60 && n < min;
}

export function studentGroupId(student) {
  return student?.grupoId || student?.groupId || '';
}

export function enrollmentBelongsToGroup(enrollment, student, groupId) {
  if (!groupId) return false;
  if (enrollment?.groupId === groupId) return true;
  return studentGroupId(student) === groupId;
}

export function formatMesAnio(year, month) {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${meses[month - 1] || ''} ${year}`;
}

export function asistenciaEnMes(asistencia, year, month) {
  const out = {};
  Object.entries(asistencia || {}).forEach(([fecha, val]) => {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(fecha);
    if (!m) return;
    if (Number(m[1]) === year && Number(m[2]) === month) out[fecha] = val;
  });
  return out;
}
