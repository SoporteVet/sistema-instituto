// ─── Roles y permisos del sistema ─────────────────────────────────────────────
// Define los roles disponibles, sus etiquetas legibles y a qué rutas (paneles)
// puede acceder cada rol. El rol `admin` (Soporte TI / Administrador master) es
// supremo y siempre tiene acceso total.

export const ROLES = {
  ADMIN: 'admin',
  VIDA_ESTUDIANTIL: 'vida_estudiantil',
  MATRICULAS: 'matriculas',
  COORDINACION: 'coordinacion',
  DIRECTOR: 'director',
  PROFESOR: 'profesor',
  ESTUDIANTE: 'estudiante',
};

// Lista de roles válidos (para selects y validaciones del cliente).
export const ROLE_LIST = [
  ROLES.ADMIN,
  ROLES.VIDA_ESTUDIANTIL,
  ROLES.MATRICULAS,
  ROLES.COORDINACION,
  ROLES.DIRECTOR,
  ROLES.PROFESOR,
  ROLES.ESTUDIANTE,
];

// Etiquetas legibles por rol.
export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.VIDA_ESTUDIANTIL]: 'Vida Estudiantil',
  [ROLES.MATRICULAS]: 'Matrículas',
  [ROLES.COORDINACION]: 'Coordinación',
  [ROLES.DIRECTOR]: 'Director Académico',
  [ROLES.PROFESOR]: 'Profesor',
  [ROLES.ESTUDIANTE]: 'Estudiante',
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || 'Desconocido';
}

// Mapa ruta -> roles permitidos. `admin` se concede siempre en canAccess(),
// por lo que no es necesario listarlo en cada ruta.
export const ROUTE_ACCESS = {
  dashboard: [
    ROLES.VIDA_ESTUDIANTIL, ROLES.MATRICULAS, ROLES.COORDINACION,
    ROLES.DIRECTOR, ROLES.PROFESOR,
  ],
  grupos: [
    ROLES.VIDA_ESTUDIANTIL, ROLES.MATRICULAS, ROLES.COORDINACION, ROLES.DIRECTOR,
  ],
  cronograma: [
    ROLES.VIDA_ESTUDIANTIL, ROLES.MATRICULAS, ROLES.COORDINACION, ROLES.DIRECTOR,
  ],
  estudiantes: [
    ROLES.VIDA_ESTUDIANTIL, ROLES.MATRICULAS, ROLES.COORDINACION, ROLES.DIRECTOR,
  ],
  inscripciones: [
    ROLES.MATRICULAS,
  ],
  notas: [
    ROLES.MATRICULAS, ROLES.DIRECTOR, ROLES.PROFESOR,
  ],
  agendamiento: [
    ROLES.VIDA_ESTUDIANTIL, ROLES.MATRICULAS, ROLES.COORDINACION, ROLES.DIRECTOR,
  ],
  practicas: [
    ROLES.VIDA_ESTUDIANTIL, ROLES.MATRICULAS, ROLES.COORDINACION, ROLES.DIRECTOR,
    ROLES.ESTUDIANTE,
  ],
  cursos: [],      // solo admin (configuración)
  usuarios: [],    // solo admin (Soporte TI)
  importacion: [], // solo admin
};

/**
 * Indica si un rol puede acceder a una ruta del sistema.
 * El rol `admin` siempre tiene acceso.
 * @param {string} route
 * @param {string} role
 * @returns {boolean}
 */
export function canAccess(route, role) {
  if (!role) return false;
  if (role === ROLES.ADMIN) return true;
  const allowed = ROUTE_ACCESS[route];
  if (!allowed) return false;
  return allowed.includes(role);
}

/** Roles que pueden crear/editar fichas de estudiantes (alineado con Firestore). */
export function canEditStudents(role) {
  if (!role) return false;
  if (role === ROLES.ADMIN) return true;
  return [
    ROLES.VIDA_ESTUDIANTIL,
    ROLES.MATRICULAS,
    ROLES.COORDINACION,
    ROLES.DIRECTOR,
  ].includes(role);
}

/** Roles que pueden crear inscripciones (alineado con Firestore enrollments create). */
export function canManageEnrollments(role) {
  return canEditStudents(role);
}

/** Entrada/salida de práctica: personal de matrícula o kiosco de estudiante. */
export function canMarkPractica(role) {
  if (canEditStudents(role)) return true;
  return role === ROLES.ESTUDIANTE;
}

/** Ruta inicial según el rol. */
export function homeRoute(role) {
  return role === ROLES.ESTUDIANTE ? 'practicas' : 'dashboard';
}
