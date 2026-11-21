import { normalizeIdentificacion, isValidIdentificacion } from '../services/hacienda.js';

export { normalizeIdentificacion, isValidIdentificacion };

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function minutosEntre(inicio, fin) {
  const a = toDate(inicio);
  const b = toDate(fin);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

export function formatMinutos(minutos) {
  if (minutos === null || minutos === undefined || minutos === '') return '—';
  const m = Math.max(0, Math.round(Number(minutos) || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}

export function findStudentByDocumento(students, documento) {
  const id = normalizeIdentificacion(documento);
  if (!isValidIdentificacion(id)) return null;
  return students.find(s => normalizeIdentificacion(s.documento) === id) || null;
}

export function sesionAbierta(registros, studentId) {
  if (!studentId) return null;
  return registros.find(r => r.studentId === studentId && r.estado === 'abierto') || null;
}

export function horasPorArea(registros, studentId) {
  const closed = (registros || []).filter(r => r.studentId === studentId && r.estado === 'cerrado');
  const map = new Map();
  for (const r of closed) {
    const key = r.areaId || r.areaNombre || 'sin-area';
    const prev = map.get(key) || {
      areaId: r.areaId || '',
      areaNombre: r.areaNombre || 'Área',
      minutos: 0,
    };
    prev.minutos += Number(r.minutos) || 0;
    map.set(key, prev);
  }
  const rows = [...map.values()].sort((a, b) =>
    (a.areaNombre || '').localeCompare(b.areaNombre || '', 'es')
  );
  const totalMinutos = rows.reduce((sum, row) => sum + row.minutos, 0);
  return { rows, totalMinutos };
}

export function registroFechaKey(reg) {
  const d = toDate(reg?.entrada);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toDatetimeLocalValue(value) {
  const d = toDate(value) || new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

(function selfCheck() {
  if (minutosEntre('2026-01-01T08:00:00.000Z', '2026-01-01T10:30:00.000Z') !== 150) {
    throw new Error('practica-horas: minutosEntre');
  }
  const { rows, totalMinutos } = horasPorArea([
    { studentId: '1', estado: 'cerrado', areaId: 'a', areaNombre: 'Lab', minutos: 60 },
    { studentId: '1', estado: 'abierto', areaId: 'a', areaNombre: 'Lab', minutos: null },
    { studentId: '1', estado: 'cerrado', areaId: 'b', areaNombre: 'Quirófano', minutos: 90 },
    { studentId: '2', estado: 'cerrado', areaId: 'a', areaNombre: 'Lab', minutos: 30 },
  ], '1');
  if (totalMinutos !== 150 || rows.length !== 2) {
    throw new Error('practica-horas: horasPorArea');
  }
})();
