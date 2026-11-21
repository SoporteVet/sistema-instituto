/**
 * Catálogo oficial Plan de Estudios 2026 — Asistente Técnico Veterinario
 * ATV-001 .. ATV-013 con prerequisitos encadenados por orden.
 */

const RAW_COURSES = [
  { codigo: 'ATV-001', nombre: 'Anatomía', orden: 1 },
  { codigo: 'ATV-002', nombre: 'Zootecnia y Nutrición', orden: 2 },
  { codigo: 'ATV-003', nombre: 'Fisiología', orden: 3 },
  { codigo: 'ATV-004', nombre: 'Patología', orden: 4 },
  { codigo: 'ATV-005', nombre: 'Terminología Ética Profesional', orden: 5 },
  { codigo: 'ATV-006', nombre: 'Enfermedades Infecciosas', orden: 6 },
  { codigo: 'ATV-007', nombre: 'Parasitarias', orden: 7 },
  { codigo: 'ATV-008', nombre: 'Farmacología', orden: 8 },
  { codigo: 'ATV-009', nombre: 'Laboratorio Clínico', orden: 9 },
  { codigo: 'ATV-010', nombre: 'Asistente Consulta Externa', orden: 10 },
  { codigo: 'ATV-011', nombre: 'Asistente Medicina Interna', orden: 11 },
  { codigo: 'ATV-012', nombre: 'Asistente de Quirófano', orden: 12 },
  { codigo: 'ATV-013', nombre: 'Proyecto Final', orden: 13 },
];

export function getCatalogCourses() {
  return RAW_COURSES.map((c, index) => {
    const notaMinima = c.codigo === 'ATV-013' ? 80 : 70;
    const prev = index > 0 ? RAW_COURSES[index - 1] : null;
    return {
      codigo: c.codigo,
      nombre: c.nombre,
      orden: c.orden,
      descripcion: '',
      notaMinima,
      prerequisitoCodigo: prev ? prev.codigo : null,
      paymentItems: [],
      requisitos: {
        cursoPrevio: index > 0,
        notaMinima: true,
        pagosCompletos: false,
      },
    };
  });
}

export const CATALOG_CODES = RAW_COURSES.map(c => c.codigo);

export const PLAN_ESTUDIOS_2026 = {
  titulo: 'Plan de Estudios 2026',
  anio: 2026,
  programa: 'Asistente Técnico Veterinario',
  cursos: RAW_COURSES,
};
