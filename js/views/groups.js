import { getAll, create, update, remove, getCronogramaByGroup, COLLECTIONS } from '../services/db.js';
import { isAdmin } from '../auth.js';
import { studentGroupId } from '../logic/academic.js';
import {
  renderStudentProgress, exportAsistenciaMes, exportMateriaGrupo,
} from './student-progress.js';
import {
  loadingHtml, errorHtml, emptyHtml, statusBadge, showModal,
  showConfirm, showToast, pageHeader, escapeHtml, renderIcons, actionBtn
} from '../ui.js';
import { navigateTo } from '../nav.js';

const ESTADOS = [
  { value: 'activo',   label: 'Activo' },
  { value: 'graduado', label: 'Graduado' },
  { value: 'inactivo', label: 'Inactivo' },
];

export async function render(container, params = []) {
  const groupId = params[0] || '';
  const studentId = params[1] || '';

  container.innerHTML = loadingHtml('Cargando grupos...');

  if (studentId && groupId) {
    await renderStudentInGroup(container, groupId, studentId);
    return;
  }

  if (groupId) {
    await renderGroupDetail(container, groupId);
    return;
  }

  await loadGroups(container);
}

async function loadGroups(container) {
  try {
    const groups = await getAll(COLLECTIONS.GROUPS, 'numero');

    container.innerHTML = `
      ${pageHeader('Grupos', `${groups.length} grupo(s) registrado(s)`, isAdmin() ? `
        <button class="btn btn-primary" id="btn-add-group">
          <i data-lucide="plus"></i> Agregar Grupo
        </button>` : '')}

      <div class="card">
        <div class="card-body p-0">
          ${groups.length === 0
            ? emptyHtml('No hay grupos registrados aún.', isAdmin() ? 'Agregar primer grupo' : null, 'empty-add')
            : `
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Grupo</th>
                    <th>Año</th>
                    <th>Inicio</th>
                    <th>Horario</th>
                    <th>Sede</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${groups.map(g => `
                    <tr>
                      <td><span class="order-badge">${g.numero ?? '—'}</span></td>
                      <td>
                        <button type="button" class="student-name-link" data-action="detail" data-id="${g.id}" title="Ver estudiantes y progreso">
                          <div class="cell-primary">${escapeHtml(g.nombre || `Grupo ${g.numero ?? ''}`)}</div>
                          ${g.observaciones ? `<div class="cell-secondary">${escapeHtml(g.observaciones.slice(0, 60))}${g.observaciones.length > 60 ? '…' : ''}</div>` : ''}
                        </button>
                      </td>
                      <td>${escapeHtml(String(g.anio || '—'))}</td>
                      <td><span class="text-muted">${escapeHtml(g.fechaInicio || '—')}</span></td>
                      <td>${escapeHtml(g.horario || '—')}</td>
                      <td>${escapeHtml(g.sede || '—')}</td>
                      <td>${statusBadge(g.estado || 'activo')}</td>
                      <td>
                        <div class="action-btns">
                          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="detail" data-id="${g.id}" title="Estudiantes y progreso">
                            ${actionBtn('Ver', 'users')}
                          </button>
                          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="notas" data-id="${g.id}" title="Notas del grupo">
                            ${actionBtn('Notas', 'star')}
                          </button>
                          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="cronograma" data-id="${g.id}" title="Cronograma">
                            ${actionBtn('Crono', 'calendar-days')}
                          </button>
                          ${isAdmin() ? `
                          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="edit" data-id="${g.id}" title="Editar">
                            ${actionBtn('Editar', 'edit-2')}
                          </button>
                          <button type="button" class="btn btn-ghost btn-sm btn-action danger" data-action="delete" data-id="${g.id}" title="Eliminar">
                            ${actionBtn('Eliminar', 'trash-2')}
                          </button>` : ''}
                        </div>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>`;

    renderIcons();
    attachListListeners(container, groups);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar los grupos.');
  }
}

function attachListListeners(container, groups) {
  if (isAdmin()) {
    container.querySelector('#btn-add-group')?.addEventListener('click', () => openGroupModal(null, container, groups));
    container.querySelector('#empty-add')?.addEventListener('click', () => openGroupModal(null, container, groups));
  }

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const group = groups.find(g => g.id === id);
    if (!group) return;

    if (action === 'detail') navigateTo(`grupos/${id}`);
    if (action === 'cronograma') navigateTo(`cronograma/${id}`);
    if (action === 'notas') navigateTo(`notas/${id}`);
    if (action === 'edit' && isAdmin()) openGroupModal(group, container, groups);
    if (action === 'delete' && isAdmin()) {
      const ok = await showConfirm(
        `¿Eliminar "${group.nombre || `Grupo ${group.numero}`}"? El cronograma asociado no se eliminará automáticamente.`,
        'Eliminar Grupo'
      );
      if (ok) {
        try {
          await remove(COLLECTIONS.GROUPS, id);
          showToast('Grupo eliminado', 'success');
          await loadGroups(container);
        } catch {
          showToast('Error al eliminar el grupo', 'error');
        }
      }
    }
  }, { capture: false });
}

function getGroupStudents(students, groupId) {
  return students
    .filter(s => studentGroupId(s) === groupId)
    .sort((a, b) => `${a.apellido || ''} ${a.nombre || ''}`.localeCompare(`${b.apellido || ''} ${b.nombre || ''}`, 'es'));
}

function getGroupCourses(courses, cronogramaEntries, enrollments, students, groupId) {
  const courseIds = new Set();
  cronogramaEntries.forEach(e => { if (e.courseId) courseIds.add(e.courseId); });
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  enrollments.forEach(e => {
    if (e.courseId && (e.groupId === groupId || studentGroupId(studentMap[e.studentId]) === groupId)) {
      courseIds.add(e.courseId);
    }
  });
  return courses.filter(c => courseIds.has(c.id));
}

async function renderGroupDetail(container, groupId) {
  try {
    const [groups, students, courses, enrollments, cronogramaEntries] = await Promise.all([
      getAll(COLLECTIONS.GROUPS, 'numero'),
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
      getAll(COLLECTIONS.COURSES, 'orden'),
      getAll(COLLECTIONS.ENROLLMENTS),
      getCronogramaByGroup(groupId),
    ]);

    const group = groups.find(g => g.id === groupId);
    if (!group) {
      container.innerHTML = errorHtml('Grupo no encontrado.') + backToGroupsBtn();
      attachBackListener(container);
      return;
    }

    const groupStudents = getGroupStudents(students, groupId);
    const groupCourses = getGroupCourses(courses, cronogramaEntries, enrollments, students, groupId);
    const now = new Date();
    const ctx = { students, courses, groups, enrollments };

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-text">
          <button type="button" class="btn btn-ghost btn-sm mb-2" id="btn-back-grupos">
            <i data-lucide="arrow-left"></i> Volver a grupos
          </button>
          <h1 class="page-title">${escapeHtml(group.nombre || `Grupo ${group.numero ?? ''}`)}</h1>
          <p class="page-subtitle">
            ${escapeHtml(String(group.anio || ''))}${group.horario ? ' · ' + escapeHtml(group.horario) : ''}
            ${group.sede ? ' · ' + escapeHtml(group.sede) : ''}
            · ${groupStudents.length} estudiante(s)
          </p>
        </div>
        <div class="page-header-actions">
          <button type="button" class="btn btn-outline btn-sm" data-goto-notas="${groupId}">
            <i data-lucide="star"></i> Notas
          </button>
          <button type="button" class="btn btn-outline btn-sm" data-goto-cronograma="${groupId}">
            <i data-lucide="calendar-days"></i> Cronograma
          </button>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">Exportaciones PDF</h3>
        </div>
        <div class="card-body export-panel">
          <div class="export-block">
            <h4 class="export-title">Asistencia y notas por mes</h4>
            <div class="form-row export-filters">
              <select id="exp-course-1" class="form-control">
                <option value="">Materia…</option>
                ${groupCourses.map(c => `<option value="${c.id}">${escapeHtml(c.codigo)} – ${escapeHtml(c.nombre)}</option>`).join('')}
              </select>
              <input type="month" id="exp-month-1" class="form-control" value="${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}">
              <button type="button" class="btn btn-outline btn-sm" id="btn-pdf-asistencia">Descargar PDF</button>
            </div>
          </div>
          <div class="export-block">
            <h4 class="export-title">Historial de materia del grupo</h4>
            <div class="form-row export-filters">
              <select id="exp-course-3" class="form-control">
                <option value="">Materia…</option>
                ${groupCourses.map(c => `<option value="${c.id}">${escapeHtml(c.codigo)} – ${escapeHtml(c.nombre)}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-outline btn-sm" id="btn-pdf-materia-grupo">Descargar PDF</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Estudiantes del grupo</h3>
          <p class="text-muted text-sm">Selecciona un estudiante para ver su progreso académico individual.</p>
        </div>
        <div class="card-body p-0">
          ${groupStudents.length === 0
            ? emptyHtml('No hay estudiantes asignados a este grupo.')
            : `
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Documento</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${groupStudents.map(s => `
                    <tr>
                      <td>
                        <button type="button" class="student-name-link" data-action="student-progress" data-student-id="${s.id}">
                          <div class="cell-primary">${escapeHtml(s.nombre)} ${escapeHtml(s.apellido || '')}</div>
                        </button>
                      </td>
                      <td>${escapeHtml(s.documento || '—')}</td>
                      <td>
                        <div class="cell-primary">${escapeHtml(s.email || '—')}</div>
                        <div class="cell-secondary">${escapeHtml(s.telefono || '')}</div>
                      </td>
                      <td>${statusBadge(s.estado || 'activo')}</td>
                      <td>
                        <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="student-progress" data-student-id="${s.id}" title="Ver progreso">
                          ${actionBtn('Progreso', 'bar-chart-2')}
                        </button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>`;

    renderIcons();

    container.querySelector('#btn-back-grupos')?.addEventListener('click', () => navigateTo('grupos'));
    container.querySelector(`[data-goto-notas="${groupId}"]`)?.addEventListener('click', () => navigateTo(`notas/${groupId}`));
    container.querySelector(`[data-goto-cronograma="${groupId}"]`)?.addEventListener('click', () => navigateTo(`cronograma/${groupId}`));

    container.querySelector('#btn-pdf-asistencia')?.addEventListener('click', async () => {
      await exportAsistenciaMes(
        groupId,
        container.querySelector('#exp-course-1')?.value,
        container.querySelector('#exp-month-1')?.value,
        ctx
      );
    });
    container.querySelector('#btn-pdf-materia-grupo')?.addEventListener('click', async () => {
      await exportMateriaGrupo(groupId, container.querySelector('#exp-course-3')?.value, ctx);
    });

    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="student-progress"]');
      if (!btn) return;
      navigateTo(`grupos/${groupId}/${btn.dataset.studentId}`);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar el grupo.');
  }
}

async function renderStudentInGroup(container, groupId, studentId) {
  try {
    const [groups, students, courses, enrollments] = await Promise.all([
      getAll(COLLECTIONS.GROUPS, 'numero'),
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
      getAll(COLLECTIONS.COURSES, 'orden'),
      getAll(COLLECTIONS.ENROLLMENTS),
    ]);

    const group = groups.find(g => g.id === groupId);
    const student = students.find(s => s.id === studentId);

    if (!group) {
      container.innerHTML = errorHtml('Grupo no encontrado.') + backToGroupsBtn();
      attachBackListener(container);
      return;
    }

    if (!student || studentGroupId(student) !== groupId) {
      container.innerHTML = errorHtml('Este estudiante no pertenece al grupo seleccionado.') + `
        <button type="button" class="btn btn-outline mt-4" id="btn-back-group">Volver al grupo</button>`;
      container.querySelector('#btn-back-group')?.addEventListener('click', () => navigateTo(`grupos/${groupId}`));
      return;
    }

    const ctx = { students, courses, groups, enrollments };

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-text">
          <button type="button" class="btn btn-ghost btn-sm mb-2" id="btn-back-group">
            <i data-lucide="arrow-left"></i> Volver a ${escapeHtml(group.nombre || `Grupo ${group.numero ?? ''}`)}
          </button>
          <h1 class="page-title">Progreso académico</h1>
          <p class="page-subtitle">${escapeHtml(student.nombre)} ${escapeHtml(student.apellido || '')} · ${escapeHtml(group.nombre || `Grupo ${group.numero ?? ''}`)}</p>
        </div>
      </div>
      <div id="student-progress-panel"></div>`;

    renderIcons();
    container.querySelector('#btn-back-group')?.addEventListener('click', () => navigateTo(`grupos/${groupId}`));

    await renderStudentProgress(container.querySelector('#student-progress-panel'), studentId, ctx);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar el progreso del estudiante.');
  }
}

function backToGroupsBtn() {
  return `<button type="button" class="btn btn-outline mt-4" id="btn-back-grupos">Volver a grupos</button>`;
}

function attachBackListener(container) {
  container.querySelector('#btn-back-grupos')?.addEventListener('click', () => navigateTo('grupos'));
}

function groupForm(group, groups) {
  const g = group || {};
  const nextNumero = group
    ? g.numero
    : (groups.reduce((max, x) => Math.max(max, Number(x.numero) || 0), 0) + 1);
  const currentYear = new Date().getFullYear();
  return `
    <form id="group-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">Número de grupo</label>
          <input type="number" name="numero" class="form-control" value="${g.numero ?? nextNumero}" min="1" required>
        </div>
        <div class="form-group">
          <label class="form-label required">Año</label>
          <input type="number" name="anio" class="form-control" value="${g.anio ?? currentYear}" min="2000" max="2100" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre del grupo</label>
        <input type="text" name="nombre" class="form-control" value="${escapeHtml(g.nombre || '')}" placeholder="Ej. Grupo ${g.numero ?? nextNumero}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha de inicio</label>
          <input type="date" name="fechaInicio" class="form-control" value="${escapeHtml(g.fechaInicio || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select name="estado" class="form-control">
            ${ESTADOS.map(s => `<option value="${s.value}" ${(g.estado || 'activo') === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Horario</label>
        <input type="text" name="horario" class="form-control" value="${escapeHtml(g.horario || '')}" placeholder="Lunes y martes 6:00pm - 10:00pm">
      </div>
      <div class="form-group">
        <label class="form-label">Sede</label>
        <input type="text" name="sede" class="form-control" value="${escapeHtml(g.sede || '')}" placeholder="Central">
      </div>
      <div class="form-group">
        <label class="form-label">Observaciones / seguimiento administrativo</label>
        <textarea name="observaciones" class="form-control" rows="2">${escapeHtml(g.observaciones || '')}</textarea>
      </div>
    </form>`;
}

function openGroupModal(group, container, groups) {
  const isEdit = !!group;
  showModal({
    title: isEdit ? 'Editar Grupo' : 'Agregar Grupo',
    content: groupForm(group, groups),
    confirmLabel: isEdit ? 'Guardar cambios' : 'Agregar grupo',
    size: 'md',
    onConfirm: async (close) => {
      const form = document.getElementById('group-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const fd = new FormData(form);
      const numero = Number(fd.get('numero'));
      const data = {
        numero,
        anio: Number(fd.get('anio')),
        nombre: fd.get('nombre').trim() || `Grupo ${numero}`,
        fechaInicio: fd.get('fechaInicio') || '',
        estado: fd.get('estado'),
        horario: fd.get('horario').trim(),
        sede: fd.get('sede').trim(),
        observaciones: fd.get('observaciones').trim(),
      };

      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Guardando…';

      try {
        if (isEdit) {
          await update(COLLECTIONS.GROUPS, group.id, data);
          showToast('Grupo actualizado', 'success');
        } else {
          await create(COLLECTIONS.GROUPS, data);
          showToast('Grupo creado', 'success');
        }
        close();
        await loadGroups(container);
      } catch (err) {
        console.error(err);
        const msg = err?.code === 'permission-denied'
          ? 'No tienes permiso para guardar estos cambios.'
          : 'Error al guardar el grupo';
        showToast(msg, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = isEdit ? 'Guardar cambios' : 'Agregar grupo';
      }
    },
  });
}
