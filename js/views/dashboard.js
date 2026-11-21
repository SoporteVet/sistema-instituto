import { getAll, COLLECTIONS } from '../services/db.js';
import { getStudentProgress } from '../logic/progression.js';
import { studentGroupId } from '../logic/academic.js';
import { loadingHtml, errorHtml, formatDate, statusBadge, statCard, renderIcons, showToast, actionBtn } from '../ui.js';
import { navigateTo } from '../nav.js';

export async function render(container) {
  container.innerHTML = loadingHtml('Cargando dashboard...');

  try {
    const [students, courses, enrollments] = await Promise.all([
      getAll(COLLECTIONS.STUDENTS),
      getAll(COLLECTIONS.COURSES, 'orden'),
      getAll(COLLECTIONS.ENROLLMENTS),
    ]);

    // ── Stats calculation ─────────────────────────────────────────────────────
    const activeStudents = students.filter(s => s.estado !== 'inactivo');

    let pendingPayments = 0;
    let blockedStudents = new Set();
    let approvedEnrollments = 0;
    let inProgressEnrollments = 0;

    const enrollmentsByStudent = {};
    for (const e of enrollments) {
      if (!enrollmentsByStudent[e.studentId]) enrollmentsByStudent[e.studentId] = [];
      enrollmentsByStudent[e.studentId].push(e);
    }

    for (const student of students) {
      const sEnrollments = enrollmentsByStudent[student.id] || [];
      const progress = getStudentProgress(sEnrollments, courses);
      for (const p of progress) {
        if (p.status === 'bloqueado') blockedStudents.add(student.id);
        if (p.status === 'aprobado') approvedEnrollments++;
        if (p.status === 'en_curso') inProgressEnrollments++;
        if (p.enrollment) {
          const payItems = p.course.paymentItems || [];
          const pagos = p.enrollment.pagos || {};
          const unpaid = payItems.filter(item => !pagos[item.id]?.pagado).length;
          if (unpaid > 0) pendingPayments++;
        }
      }
    }

    // ── Recent enrollments (last 8) ───────────────────────────────────────────
    const recentEnrollments = [...enrollments]
      .sort((a, b) => {
        const da = a.creadoEn?.toDate?.() || new Date(0);
        const db_ = b.creadoEn?.toDate?.() || new Date(0);
        return db_ - da;
      })
      .slice(0, 8);

    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
    const courseMap  = Object.fromEntries(courses.map(c => [c.id, c]));
    container._studentMap = studentMap;

    // ── Render ────────────────────────────────────────────────────────────────
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Resumen del instituto veterinario</p>
        </div>
      </div>

      <div class="stats-grid">
        ${statCard('Estudiantes Activos', activeStudents.length, 'users', 'stat-forest')}
        ${statCard('Inscripciones Activas', inProgressEnrollments, 'book-open', 'stat-amber')}
        ${statCard('Pagos Pendientes', pendingPayments, 'credit-card', 'stat-warn')}
        ${statCard('Estudiantes Bloqueados', blockedStudents.size, 'lock', 'stat-danger')}
        ${statCard('Cursos Aprobados', approvedEnrollments, 'check-circle', 'stat-success')}
        ${statCard('Cursos en el Sistema', courses.length, 'layers', 'stat-info')}
      </div>

      <div class="card mt-6">
        <div class="card-header">
          <h2 class="card-title">Inscripciones Recientes</h2>
          <button class="btn btn-primary btn-sm" id="btn-goto-inscripciones">
            <i data-lucide="plus"></i> Nueva inscripción
          </button>
        </div>
        <div class="card-body p-0">
          ${recentEnrollments.length === 0 ? `
            <div class="empty-state py-8">
              <div class="empty-icon">📋</div>
              <p>No hay inscripciones aún</p>
            </div>
          ` : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Curso</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${recentEnrollments.map(e => {
                  const student = studentMap[e.studentId];
                  const course  = courseMap[e.courseId];
                  if (!student || !course) return '';
                  const progress = getStudentProgress([e], [course]);
                  const st = progress[0]?.status || 'en_curso';
                  const groupId = e.groupId || studentGroupId(student);
                  return `
                    <tr>
                      <td>
                        <div class="cell-primary">${student.nombre} ${student.apellido || ''}</div>
                        <div class="cell-secondary">${student.documento || ''}</div>
                      </td>
                      <td>
                        <div class="cell-primary">${course.nombre}</div>
                        <div class="cell-secondary">${course.codigo}</div>
                      </td>
                      <td><span class="text-muted">${formatDate(e.creadoEn)}</span></td>
                      <td>${statusBadge(st)}</td>
                      <td>
                        <button type="button" class="btn btn-ghost btn-sm btn-action" data-goto-progress="${e.studentId}" data-group-id="${groupId || ''}" title="Ver progreso">
                          ${actionBtn('Progreso', 'bar-chart-2')}
                        </button>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
        </div>
      </div>

      <div class="dashboard-quick-links mt-6">
        <h3 class="section-title">Accesos Rápidos</h3>
        <div class="quick-grid">
          <button class="quick-card" data-goto="estudiantes">
            <i data-lucide="users"></i>
            <span>Gestionar Estudiantes</span>
          </button>
          <button class="quick-card" data-goto="cursos">
            <i data-lucide="layers"></i>
            <span>Gestionar Cursos</span>
          </button>
          <button class="quick-card" data-goto="inscripciones">
            <i data-lucide="file-plus"></i>
            <span>Nueva Inscripción</span>
          </button>
          <button class="quick-card" data-goto="notas">
            <i data-lucide="star"></i>
            <span>Registrar Notas</span>
          </button>
          <button class="quick-card" data-goto="grupos">
            <i data-lucide="trending-up"></i>
            <span>Progreso por Grupo</span>
          </button>
        </div>
      </div>`;

    renderIcons();
    attachListeners(container);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar el dashboard. Verifica la conexión a Firebase.');
  }
}

function attachListeners(container) {
  container.querySelector('#btn-goto-inscripciones')?.addEventListener('click', () => navigateTo('inscripciones'));

  container.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
  });

  container.querySelectorAll('[data-goto-progress]').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.dataset.gotoProgress;
      const groupId = btn.dataset.groupId || studentGroupId(container._studentMap?.[studentId]);
      if (!groupId) {
        showToast('Asigna un grupo al estudiante para ver su progreso', 'warning');
        return;
      }
      navigateTo(`grupos/${groupId}/${studentId}`);
    });
  });
}
