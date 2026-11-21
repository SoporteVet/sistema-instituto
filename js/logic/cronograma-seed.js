/**
 * Cronograma oficial — Profesores, meses, materias (ATV) y grupos.
 */

export const CRONOGRAMA_PROFESORES = [
  { id: 'javier', nombre: 'Javier', color: 'prof-javier' },
  { id: 'randall', nombre: 'Randall', color: 'prof-randall' },
  { id: 'abel', nombre: 'Abel', color: 'prof-abel' },
  { id: 'paul', nombre: 'Paul', color: 'prof-paul' },
];

export const CRONOGRAMA_MESES = [
  { mes: 1, anio: 2026, label: 'enero' },
  { mes: 2, anio: 2026, label: 'febrero' },
  { mes: 3, anio: 2026, label: 'marzo' },
  { mes: 4, anio: 2026, label: 'abril' },
  { mes: 5, anio: 2026, label: 'mayo' },
  { mes: 6, anio: 2026, label: 'junio' },
  { mes: 7, anio: 2026, label: 'julio' },
  { mes: 8, anio: 2026, label: 'agosto' },
  { mes: 9, anio: 2026, label: 'septiembre' },
  { mes: 10, anio: 2026, label: 'octubre' },
  { mes: 11, anio: 2026, label: 'noviembre' },
  { mes: 12, anio: 2026, label: 'diciembre' },
  { mes: 1, anio: 2027, label: 'enero 2027' },
  { mes: 2, anio: 2027, label: 'febrero 2027' },
  { mes: 3, anio: 2027, label: 'marzo 2027' },
  { mes: 4, anio: 2027, label: 'abril 2027' },
  { mes: 5, anio: 2027, label: 'mayo 2027' },
  { mes: 6, anio: 2027, label: 'junio 2027' },
  { mes: 7, anio: 2027, label: 'julio 2027' },
  { mes: 8, anio: 2027, label: 'agosto 2027' },
];

export const CRONOGRAMA_GRUPOS = [8, 9, 10, 11, 12, 13];

export const CRONOGRAMA_ASIGNACIONES = [
  { profesor: 'Javier', mes: 1, anio: 2026, codigo: 'ATV-001', grupos: [10] },
  { profesor: 'Javier', mes: 2, anio: 2026, codigo: 'ATV-006', grupos: [9] },
  { profesor: 'Javier', mes: 5, anio: 2026, codigo: 'ATV-001', grupos: [11] },
  { profesor: 'Javier', mes: 6, anio: 2026, codigo: 'ATV-006', grupos: [10] },
  { profesor: 'Javier', mes: 9, anio: 2026, codigo: 'ATV-001', grupos: [12] },
  { profesor: 'Javier', mes: 10, anio: 2026, codigo: 'ATV-006', grupos: [11] },
  { profesor: 'Javier', mes: 1, anio: 2027, codigo: 'ATV-001', grupos: [13] },
  { profesor: 'Javier', mes: 2, anio: 2027, codigo: 'ATV-006', grupos: [12] },

  { profesor: 'Randall', mes: 1, anio: 2026, codigo: 'ATV-009', grupos: [8, 9] },
  { profesor: 'Randall', mes: 1, anio: 2026, codigo: 'ATV-005', grupos: [8, 9], nota: 'Terminología y ética' },
  { profesor: 'Randall', mes: 2, anio: 2026, codigo: 'ATV-010', grupos: [8] },
  { profesor: 'Randall', mes: 3, anio: 2026, codigo: 'ATV-011', grupos: [8] },
  { profesor: 'Randall', mes: 4, anio: 2026, codigo: 'ATV-012', grupos: [8] },
  { profesor: 'Randall', mes: 5, anio: 2026, codigo: 'ATV-009', grupos: [9] },
  { profesor: 'Randall', mes: 6, anio: 2026, codigo: 'ATV-010', grupos: [9] },
  { profesor: 'Randall', mes: 7, anio: 2026, codigo: 'ATV-011', grupos: [9] },
  { profesor: 'Randall', mes: 8, anio: 2026, codigo: 'ATV-012', grupos: [9] },
  { profesor: 'Randall', mes: 9, anio: 2026, codigo: 'ATV-009', grupos: [10] },
  { profesor: 'Randall', mes: 10, anio: 2026, codigo: 'ATV-010', grupos: [10] },
  { profesor: 'Randall', mes: 11, anio: 2026, codigo: 'ATV-011', grupos: [10] },
  { profesor: 'Randall', mes: 12, anio: 2026, codigo: 'ATV-012', grupos: [10] },
  { profesor: 'Randall', mes: 1, anio: 2027, codigo: 'ATV-009', grupos: [11] },
  { profesor: 'Randall', mes: 2, anio: 2027, codigo: 'ATV-010', grupos: [11] },
  { profesor: 'Randall', mes: 3, anio: 2027, codigo: 'ATV-011', grupos: [11] },
  { profesor: 'Randall', mes: 4, anio: 2027, codigo: 'ATV-012', grupos: [11] },
  { profesor: 'Randall', mes: 5, anio: 2027, codigo: 'ATV-009', grupos: [12] },
  { profesor: 'Randall', mes: 6, anio: 2027, codigo: 'ATV-010', grupos: [12] },
  { profesor: 'Randall', mes: 7, anio: 2027, codigo: 'ATV-011', grupos: [12] },
  { profesor: 'Randall', mes: 8, anio: 2027, codigo: 'ATV-012', grupos: [12] },

  { profesor: 'Abel', mes: 3, anio: 2026, codigo: 'ATV-007', grupos: [9] },
  { profesor: 'Abel', mes: 4, anio: 2026, codigo: 'ATV-008', grupos: [9] },
  { profesor: 'Abel', mes: 5, anio: 2026, codigo: 'ATV-005', grupos: [10] },
  { profesor: 'Abel', mes: 7, anio: 2026, codigo: 'ATV-007', grupos: [10] },
  { profesor: 'Abel', mes: 8, anio: 2026, codigo: 'ATV-008', grupos: [10] },
  { profesor: 'Abel', mes: 9, anio: 2026, codigo: 'ATV-005', grupos: [11] },
  { profesor: 'Abel', mes: 11, anio: 2026, codigo: 'ATV-007', grupos: [11] },
  { profesor: 'Abel', mes: 12, anio: 2026, codigo: 'ATV-008', grupos: [11] },
  { profesor: 'Abel', mes: 1, anio: 2027, codigo: 'ATV-005', grupos: [12] },
  { profesor: 'Abel', mes: 3, anio: 2027, codigo: 'ATV-007', grupos: [12] },
  { profesor: 'Abel', mes: 4, anio: 2027, codigo: 'ATV-008', grupos: [12] },

  { profesor: 'Paul', mes: 2, anio: 2026, codigo: 'ATV-002', grupos: [10] },
  { profesor: 'Paul', mes: 3, anio: 2026, codigo: 'ATV-003', grupos: [10] },
  { profesor: 'Paul', mes: 4, anio: 2026, codigo: 'ATV-004', grupos: [10] },
  { profesor: 'Paul', mes: 6, anio: 2026, codigo: 'ATV-002', grupos: [11] },
  { profesor: 'Paul', mes: 7, anio: 2026, codigo: 'ATV-003', grupos: [11] },
  { profesor: 'Paul', mes: 8, anio: 2026, codigo: 'ATV-004', grupos: [11] },
  { profesor: 'Paul', mes: 10, anio: 2026, codigo: 'ATV-002', grupos: [12] },
  { profesor: 'Paul', mes: 11, anio: 2026, codigo: 'ATV-003', grupos: [12] },
  { profesor: 'Paul', mes: 12, anio: 2026, codigo: 'ATV-004', grupos: [12] },
];

export function mesToCuatrimestre(mes) {
  if (mes <= 3) return 1;
  if (mes <= 6) return 2;
  if (mes <= 9) return 3;
  return 4;
}

export function monthDateRange(mes, anio) {
  const start = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const lastDay = new Date(anio, mes, 0).getDate();
  const end = `${anio}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function buildProfesorGrid(profesorNombre, courseNames = {}) {
  const asignaciones = CRONOGRAMA_ASIGNACIONES.filter(a => a.profesor === profesorNombre);

  return CRONOGRAMA_MESES.map(({ mes, anio, label }) => {
    const items = asignaciones.filter(a => a.mes === mes && a.anio === anio);
    if (!items.length) return { mes, anio, label, celdas: [] };

    const celdas = items.map(item => ({
      codigo: item.codigo,
      curso: courseNames[item.codigo] || item.nota || item.codigo,
      grupos: item.grupos,
      gruposLabel: item.grupos.length > 1 ? item.grupos.join(' y ') : String(item.grupos[0]),
    }));

    return { mes, anio, label, celdas };
  });
}
