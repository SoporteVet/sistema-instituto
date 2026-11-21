import { getEnrollmentsByStudent, getWhere, COLLECTIONS } from '../services/db.js';
import { horasPracticaBlockHtml } from './practicas.js';
import { getStudentProgress, getProgressStats } from '../logic/progression.js';
import {
  calcNotaFinal, resolveEstadoFinal, enrollmentBelongsToGroup, asistenciaEnMes,
} from '../logic/academic.js';
import {
  exportAsistenciaMesPdf, exportHistorialEstudiantePdf, exportHistorialMateriaGrupoPdf,
} from '../services/pdf-export.js';
import {
  loadingHtml, errorHtml, escapeHtml, formatDate, renderIcons, showToast,
} from '../ui.js';

export function buildHistorialRows(studentId, ctx) {
  const { courses, enrollments } = ctx;
  const studentEnrollments = enrollments.filter(e => e.studentId === studentId);
  const progress = getStudentProgress(studentEnrollments, courses);
  return progress.map(p => {
    const ord = p.enrollment?.nota;
    const extra = p.enrollment?.notaExtraordinaria;
    const final = calcNotaFinal(ord, extra);
    const estado = resolveEstadoFinal(ord, extra, p.enrollment?.estadoNota, p.course.notaMinima ?? 70);
    return {
      codigo: p.course.codigo,
      materia: p.course.nombre,
      notaOrdinaria: ord ?? null,
      notaExtra: extra ?? null,
      notaFinal: final,
      estado,
      bloqueado: p.status === 'bloqueado',
    };
  });
}

export async function exportEstudiantePdf(studentId, ctx) {
  try {
    const student = ctx.students.find(s => s.id === studentId);
    const rows = buildHistorialRows(studentId, ctx);
    const bloqueado = rows.some(r => r.bloqueado);
    await exportHistorialEstudiantePdf({ student, rows, bloqueado });
    showToast('PDF generado', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al generar PDF', 'error');
  }
}

export async function exportAsistenciaMes(groupId, courseId, monthVal, ctx) {
  if (!groupId || !courseId || !monthVal) {
    showToast('Completa materia y mes', 'warning');
    return;
  }
  const [year, month] = monthVal.split('-').map(Number);
  const group = ctx.groups.find(g => g.id === groupId);
  const course = ctx.courses.find(c => c.id === courseId);
  const studentMap = Object.fromEntries(ctx.students.map(s => [s.id, s]));

  const rows = ctx.enrollments
    .filter(e => e.courseId === courseId && enrollmentBelongsToGroup(e, studentMap[e.studentId], groupId))
    .map(e => {
      const st = studentMap[e.studentId] || {};
      const mesAsist = asistenciaEnMes(e.asistencia, year, month);
      const fechas = Object.keys(mesAsist).sort();
      const final = calcNotaFinal(e.nota, e.notaExtraordinaria);
      return {
        nombre: `${st.nombre || ''} ${st.apellido || ''}`.trim(),
        cedula: st.documento || '',
        asistencia: mesAsist,
        notaFinal: final,
        estado: resolveEstadoFinal(e.nota, e.notaExtraordinaria, e.estadoNota, course?.notaMinima ?? 70),
        _fechas: fechas,
      };
    });

  const fechasMes = [...new Set(rows.flatMap(r => r._fechas))].sort();
  if (!fechasMes.length) {
    showToast('No hay registros de asistencia en ese mes', 'warning');
    return;
  }

  try {
    await exportAsistenciaMesPdf({
      group, course, year, month,
      fechasMes,
      rows: rows.map(({ _fechas, ...r }) => r),
    });
    showToast('PDF generado', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al generar PDF', 'error');
  }
}

export async function exportMateriaGrupo(groupId, courseId, ctx) {
  if (!groupId || !courseId) {
    showToast('Selecciona materia', 'warning');
    return;
  }
  const group = ctx.groups.find(g => g.id === groupId);
  const course = ctx.courses.find(c => c.id === courseId);
  const studentMap = Object.fromEntries(ctx.students.map(s => [s.id, s]));

  const rows = ctx.enrollments
    .filter(e => e.courseId === courseId && enrollmentBelongsToGroup(e, studentMap[e.studentId], groupId))
    .map(e => {
      const st = studentMap[e.studentId] || {};
      const ord = e.nota;
      const extra = e.notaExtraordinaria;
      return {
        nombre: `${st.nombre || ''} ${st.apellido || ''}`.trim(),
        cedula: st.documento || '',
        notaOrdinaria: ord ?? null,
        notaExtra: extra ?? null,
        notaFinal: calcNotaFinal(ord, extra),
        estado: resolveEstadoFinal(ord, extra, e.estadoNota, course?.notaMinima ?? 70),
      };
    });

  if (!rows.length) {
    showToast('No hay inscripciones para esa materia en este grupo', 'warning');
    return;
  }

  try {
    await exportHistorialMateriaGrupoPdf({ group, course, rows });
    showToast('PDF generado', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error al generar PDF', 'error');
  }
}

export async function renderStudentProgress(container, studentId, ctx) {
  if (!studentId) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = loadingHtml('Calculando progreso...');

  try {
    const student = ctx.students.find(s => s.id === studentId);
    if (!student) {
      container.innerHTML = errorHtml('Estudiante no encontrado.');
      return;
    }

    const enrollments = await getEnrollmentsByStudent(studentId);
    const practicaRegistros = await getWhere(COLLECTIONS.PRACTICA_REGISTROS, 'studentId', '==', studentId);
    const progress = getStudentProgress(enrollments, ctx.courses);
    const stats = getProgressStats(progress);
    const bloqueado = stats.bloqueados > 0;

    container.innerHTML = `
      <div class="student-profile-card card mb-4">
        <div class="card-body student-profile-body">
          <div class="student-avatar">${getInitials(student)}</div>
          <div class="student-info">
            <h2 class="student-name">${escapeHtml(student.nombre)} ${escapeHtml(student.apellido || '')}</h2>
            <p class="text-muted">${escapeHtml(student.documento || '')} ${student.email ? '· ' + escapeHtml(student.email) : ''}</p>
            ${bloqueado ? `<p class="text-danger text-sm"><strong>⚠ Estudiante con materias bloqueadas</strong></p>` : ''}
          </div>
          <div class="student-quick-stats">
            <div class="qs-item qs-success"><strong>${stats.aprobados}</strong><span>Aprobados</span></div>
            <div class="qs-item qs-warn"><strong>${stats.convocatoria || 0}</strong><span>Convocatoria</span></div>
            <div class="qs-item qs-info"><strong>${stats.enCurso}</strong><span>En Curso</span></div>
            <div class="qs-item qs-danger"><strong>${stats.bloqueados}</strong><span>Bloqueados</span></div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="btn-pdf-this-student">PDF historial</button>
        </div>
      </div>

      <div class="progress-overview-bar mb-4">
        <div class="pob-label">
          <span>Progreso general: ${stats.aprobados} de ${stats.total} cursos aprobados</span>
          <span>${Math.round((stats.aprobados / Math.max(stats.total, 1)) * 100)}%</span>
        </div>
        <div class="pob-bar">
          <div class="pob-fill pob-approved"  style="width:${(stats.aprobados  / Math.max(stats.total, 1)) * 100}%"></div>
          <div class="pob-fill pob-in-progress" style="width:${(stats.enCurso  / Math.max(stats.total, 1)) * 100}%"></div>
        </div>
      </div>

      ${horasPracticaBlockHtml(practicaRegistros, studentId)}

      <div class="timeline">
        ${progress.map((p, i) => renderTimelineItem(p, i, progress.length)).join('')}
      </div>`;

    container.querySelector('#btn-pdf-this-student')?.addEventListener('click', async () => {
      await exportEstudiantePdf(studentId, ctx);
    });

    renderIcons();
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar el progreso del estudiante.');
  }
}

function getInitials(student) {
  if (!student) return '?';
  const n = (student.nombre || '').charAt(0).toUpperCase();
  const a = (student.apellido || '').charAt(0).toUpperCase();
  return n + (a || '');
}

function renderTimelineItem(p, index, total) {
  const { course, enrollment, status, paymentProgress, missing } = p;
  const req = course.requisitos || {};

  const statusConfig = {
    aprobado:     { icon: 'check-circle', cls: 'tl-approved',     label: 'Aprobado',     dot: 'dot-approved' },
    convocatoria: { icon: 'alert-circle', cls: 'tl-convocatoria', label: 'Convocatoria', dot: 'dot-convocatoria' },
    en_curso:     { icon: 'book-open',    cls: 'tl-in-progress',  label: 'En Curso',     dot: 'dot-in-progress' },
    disponible:   { icon: 'circle',       cls: 'tl-available',    label: 'Disponible',   dot: 'dot-available' },
    bloqueado:    { icon: 'lock',         cls: 'tl-blocked',      label: 'Bloqueado',    dot: 'dot-blocked' },
  };
  const sc = statusConfig[status] || statusConfig.bloqueado;

  const ord = enrollment?.nota;
  const extra = enrollment?.notaExtraordinaria;
  const final = calcNotaFinal(ord, extra);
  const notaMin = req.notaMinima ? course.notaMinima : null;
  const notaOk = notaMin !== null && final !== null && final >= notaMin;

  const payItems = course.paymentItems || [];

  return `
    <div class="timeline-item ${sc.cls}">
      <div class="tl-connector">
        <div class="tl-dot ${sc.dot}">
          <i data-lucide="${sc.icon}"></i>
        </div>
        ${index < total - 1 ? '<div class="tl-line"></div>' : ''}
      </div>

      <div class="tl-card card">
        <div class="tl-card-header">
          <div class="tl-course-info">
            <code class="code-tag">${escapeHtml(course.codigo)}</code>
            <h3 class="tl-course-name">${escapeHtml(course.nombre)}</h3>
          </div>
          <span class="badge ${badgeCls(status)}">${sc.label}</span>
        </div>

        ${missing.length > 0 ? `
          <div class="tl-missing">
            <p class="tl-missing-title">Requisitos pendientes:</p>
            <ul>${missing.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
          </div>` : ''}

        <div class="tl-details">
          ${req.notaMinima ? `
            <div class="tl-detail-item">
              <i data-lucide="star"></i>
              <span>Nota ord. ${ord ?? '—'} · Extra. ${extra ?? '—'} · Final
                <strong class="${final !== null ? (notaOk ? 'text-success' : 'text-danger') : 'text-muted'}">
                  ${final !== null ? final : '—'}
                </strong>
                <span class="text-muted"> / mín. ${notaMin}</span>
              </span>
            </div>` : ''}

          ${req.pagosCompletos && payItems.length > 0 ? `
            <div class="tl-detail-item">
              <i data-lucide="credit-card"></i>
              <span>Pagos: 
                <strong class="${paymentProgress.paid === paymentProgress.total ? 'text-success' : 'text-warning'}">
                  ${paymentProgress.paid}/${paymentProgress.total}
                </strong>
              </span>
            </div>` : ''}

          ${enrollment ? `
            <div class="tl-detail-item tl-detail-date">
              <i data-lucide="calendar"></i>
              <span>Inscrito el ${formatDate(enrollment.creadoEn)}</span>
            </div>` : ''}
        </div>
      </div>
    </div>`;
}

function badgeCls(status) {
  return {
    aprobado: 'badge-success',
    convocatoria: 'badge-warning',
    en_curso: 'badge-info',
    disponible: 'badge-warning',
    bloqueado: 'badge-danger',
  }[status] || 'badge-neutral';
}
