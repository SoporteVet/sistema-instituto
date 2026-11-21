import { calcNotaFinal } from './academic.js';

/**
 * Evalúa si una inscripción cumple todos los requisitos configurados del curso.
 * @param {object|null} enrollment - Documento de inscripción
 * @param {object} course - Documento del curso
 * @returns {boolean}
 */
export function isEnrollmentApproved(enrollment, course) {
  if (!enrollment) return false;
  const req = course.requisitos || {};

  if (req.notaMinima) {
    const final = calcNotaFinal(enrollment.nota, enrollment.notaExtraordinaria);
    const min = course.notaMinima || 0;
    if (final === null || final < min) {
      return false;
    }
  }

  if (req.pagosCompletos) {
    const paymentItems = course.paymentItems || [];
    const pagos = enrollment.pagos || {};
    const allPaid = paymentItems.every(item => pagos[item.id]?.pagado === true);
    if (!allPaid) return false;
  }

  return true;
}

/**
 * Calcula el progreso completo de un estudiante a través de todos los cursos.
 * @param {object[]} enrollments - Inscripciones del estudiante
 * @param {object[]} courses - Todos los cursos
 * @returns {object[]} - Array de objetos con curso, inscripción, estado y requerimientos faltantes
 */
export function getStudentProgress(enrollments, courses) {
  const sorted = [...courses].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  return sorted.map((course, index) => {
    const enrollment = enrollments.find(e => e.courseId === course.id) || null;
    const prevCourse = index > 0 ? sorted[index - 1] : null;
    const prevEnrollment = prevCourse
      ? enrollments.find(e => e.courseId === prevCourse.id)
      : null;

    let prerequisiteMet = true;
    if (course.requisitos?.cursoPrevio && prevCourse) {
      prerequisiteMet = isEnrollmentApproved(prevEnrollment, prevCourse);
    }

    const approved = enrollment ? isEnrollmentApproved(enrollment, course) : false;
    const finalNota = enrollment
      ? calcNotaFinal(enrollment.nota, enrollment.notaExtraordinaria)
      : null;
    const minNota = course.notaMinima ?? 70;
    const enConvocatoria = enrollment && !approved && finalNota !== null
      && finalNota >= 60 && finalNota < minNota;

    let status;
    if (approved) {
      status = 'aprobado';
    } else if (enConvocatoria) {
      status = 'convocatoria';
    } else if (enrollment) {
      status = prerequisiteMet ? 'en_curso' : 'bloqueado';
    } else {
      status = prerequisiteMet ? 'disponible' : 'bloqueado';
    }

    const paymentItems = course.paymentItems || [];
    const pagos = enrollment?.pagos || {};
    const paidCount = paymentItems.filter(item => pagos[item.id]?.pagado).length;

    const missing = [];
    if (enrollment && !approved) {
      const req = course.requisitos || {};
      if (req.notaMinima) {
        const final = calcNotaFinal(enrollment.nota, enrollment.notaExtraordinaria);
        if (final === null || final < (course.notaMinima || 0)) {
          if (enConvocatoria) {
            missing.push(`Convocatoria: nota ${final} (requiere ${course.notaMinima} para aprobar)`);
          } else {
            missing.push(`Nota mínima ${course.notaMinima} (actual: ${final !== null ? final : 'sin calificar'})`);
          }
        }
      }
      if (req.pagosCompletos && paidCount < paymentItems.length) {
        missing.push(`Pagos: ${paidCount}/${paymentItems.length} completados`);
      }
      if (req.cursoPrevio && !prerequisiteMet) {
        missing.push(`Prerequisito "${prevCourse?.nombre || prevCourse?.codigo}" no aprobado`);
      }
    }

    return {
      course,
      enrollment,
      status,
      prerequisiteMet,
      approved,
      paymentProgress: { paid: paidCount, total: paymentItems.length },
      missing
    };
  });
}

/**
 * Verifica si un estudiante puede inscribirse a un curso.
 * @param {string} courseId
 * @param {object[]} enrollments - Inscripciones actuales del estudiante
 * @param {object[]} courses - Todos los cursos
 * @returns {{ canEnroll: boolean, reason: string|null }}
 */
export function canEnrollInCourse(courseId, enrollments, courses) {
  const course = courses.find(c => c.id === courseId);
  if (!course) return { canEnroll: false, reason: 'Curso no encontrado' };

  const existing = enrollments.find(e => e.courseId === courseId);
  if (existing) return { canEnroll: false, reason: 'Ya está inscrito en este curso' };

  if (course.requisitos?.cursoPrevio) {
    const sorted = [...courses].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const courseIndex = sorted.findIndex(c => c.id === courseId);
    if (courseIndex > 0) {
      const prevCourse = sorted[courseIndex - 1];
      const prevEnrollment = enrollments.find(e => e.courseId === prevCourse.id);
      if (!isEnrollmentApproved(prevEnrollment, prevCourse)) {
        return {
          canEnroll: false,
          reason: `Debe aprobar primero "${prevCourse.nombre || prevCourse.codigo}"`
        };
      }
    }
  }

  return { canEnroll: true, reason: null };
}

/**
 * Obtiene estadísticas rápidas del progreso de un estudiante.
 * @param {object[]} progress - Resultado de getStudentProgress()
 */
export function getProgressStats(progress) {
  return {
    total: progress.length,
    aprobados: progress.filter(p => p.status === 'aprobado').length,
    convocatoria: progress.filter(p => p.status === 'convocatoria').length,
    enCurso: progress.filter(p => p.status === 'en_curso').length,
    disponibles: progress.filter(p => p.status === 'disponible').length,
    bloqueados: progress.filter(p => p.status === 'bloqueado').length,
  };
}
