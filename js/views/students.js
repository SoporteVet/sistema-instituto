import { getAll, create, update, remove, COLLECTIONS } from '../services/db.js';
import { isAdmin, canEditStudentRecords } from '../auth.js';
import {
  lookupContribuyente, normalizeIdentificacion, isValidIdentificacion,
  parseNombreContribuyente
} from '../services/hacienda.js';
import {
  loadingHtml, errorHtml, emptyHtml, statusBadge, showModal,
  showConfirm, showToast, pageHeader, escapeHtml, formatDate, renderIcons, today,
  iconSvg, actionBtn
} from '../ui.js';
import { navigateTo } from '../nav.js';
import { studentGroupId } from '../logic/academic.js';

export async function render(container) {
  container.innerHTML = loadingHtml('Cargando estudiantes...');
  await loadStudents(container, '', '');
}

async function loadStudents(container, searchTerm, courseId) {
  try {
    const [students, courses, enrollments, groups] = await Promise.all([
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
      getAll(COLLECTIONS.COURSES, 'orden'),
      getAll(COLLECTIONS.ENROLLMENTS),
      getAll(COLLECTIONS.GROUPS, 'numero'),
    ]);

    let filtered = students;

    if (courseId) {
      const studentIds = new Set(
        enrollments.filter(e => e.courseId === courseId).map(e => e.studentId)
      );
      filtered = filtered.filter(s => studentIds.has(s.id));
    }

    if (searchTerm) {
      filtered = filtered.filter(s =>
        `${s.nombre} ${s.apellido || ''} ${s.documento || ''} ${s.email || ''}`
          .toLowerCase().includes(searchTerm.toLowerCase()));
    }

    const emptyMessage = courseId && searchTerm
      ? 'No se encontraron estudiantes con esa búsqueda en el curso seleccionado.'
      : courseId
        ? 'No hay estudiantes inscritos en este curso.'
        : searchTerm
          ? 'No se encontraron estudiantes con esa búsqueda.'
          : 'No hay estudiantes registrados aún.';

    const canEdit = canEditStudentRecords();

    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));

    container.innerHTML = `
      ${pageHeader('Estudiantes', `${students.length} estudiante(s) registrado(s)`, `
        ${canEdit ? `
        <button type="button" class="btn btn-primary" id="btn-add-student">
          ${iconSvg('user-plus', 16)} Agregar Estudiante
        </button>` : ''}`)}

      <div class="card">
        <div class="card-header">
          <div class="card-filters">
            <div class="search-box">
              ${iconSvg('search', 16)}
              <input type="text" id="student-search" class="search-input" placeholder="Buscar por nombre, documento o email…" value="${escapeHtml(searchTerm)}">
            </div>
            <select id="student-course-filter" class="form-control filter-select" aria-label="Filtrar por curso">
              <option value="">Todos los cursos</option>
              ${courses.map(c => `
                <option value="${c.id}" ${c.id === courseId ? 'selected' : ''}>
                  ${escapeHtml(c.nombre)}${c.codigo ? ` (${escapeHtml(c.codigo)})` : ''}
                </option>`).join('')}
            </select>
          </div>
          <span class="text-muted text-sm">${filtered.length} resultado(s)</span>
        </div>
        <div class="card-body p-0" id="students-table-wrap">
          ${filtered.length === 0
            ? emptyHtml(emptyMessage, courseId || searchTerm ? null : 'Agregar primero', courseId || searchTerm ? null : 'empty-add')
            : `
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Grupo</th>
                    <th>Contacto</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map(s => {
                    const group = groupMap[s.grupoId || s.groupId];
                    const groupLabel = group
                      ? (group.nombre || `Grupo ${group.numero}`)
                      : '—';
                    return `
                    <tr>
                      <td>
                        ${canEdit ? `
                        <button type="button" class="student-name-link" data-action="edit" data-id="${s.id}" title="Editar estudiante">
                          <div class="cell-primary">${escapeHtml(s.nombre)} ${escapeHtml(s.apellido || '')}</div>
                          ${s.fechaNacimiento ? `<div class="cell-secondary">Nac. ${escapeHtml(s.fechaNacimiento)}</div>` : ''}
                        </button>` : `
                        <div>
                          <div class="cell-primary">${escapeHtml(s.nombre)} ${escapeHtml(s.apellido || '')}</div>
                          ${s.fechaNacimiento ? `<div class="cell-secondary">Nac. ${escapeHtml(s.fechaNacimiento)}</div>` : ''}
                        </div>`}
                      </td>
                      <td>${escapeHtml(s.documento || '—')}</td>
                      <td>${escapeHtml(groupLabel)}</td>
                      <td>
                        <div class="cell-primary">${escapeHtml(s.email || '—')}</div>
                        ${s.email2 ? `<div class="cell-secondary">${escapeHtml(s.email2)}</div>` : ''}
                        <div class="cell-secondary">${escapeHtml(s.telefono || '')}</div>
                      </td>
                      <td><span class="text-muted">${escapeHtml(s.fechaIngreso || '—')}</span></td>
                      <td>${statusBadge(s.estado || 'activo')}</td>
                      <td>
                        <div class="action-btns">
                          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="progress" data-id="${s.id}" title="Ver progreso académico">
                            ${actionBtn('Progreso', 'bar-chart-2')}
                          </button>
                          ${canEdit ? `
                          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="edit" data-id="${s.id}" title="Editar estudiante">
                            ${actionBtn('Editar', 'edit-2')}
                          </button>` : ''}
                          ${isAdmin() ? `
                          <button type="button" class="btn btn-ghost btn-sm btn-action danger" data-action="delete" data-id="${s.id}" title="Eliminar estudiante">
                            ${actionBtn('Eliminar', 'trash-2')}
                          </button>` : ''}
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>`;

    renderIcons();
    attachListeners(container, students, groups, searchTerm, courseId);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar los estudiantes.');
  }
}

function attachListeners(container, students, groups, currentSearch, currentCourseId) {
  const canEdit = canEditStudentRecords();

  if (canEdit) {
    container.querySelector('#btn-add-student')?.addEventListener('click', () => openStudentModal(null, groups, container, currentSearch, currentCourseId));
    container.querySelector('#empty-add')?.addEventListener('click', () => openStudentModal(null, groups, container, currentSearch, currentCourseId));
  }

  let searchTimeout;
  container.querySelector('#student-search')?.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadStudents(container, e.target.value, currentCourseId), 300);
  });

  container.querySelector('#student-course-filter')?.addEventListener('change', e => {
    loadStudents(container, currentSearch, e.target.value);
  });

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const student = students.find(s => s.id === id);
    if (!student) return;

    if (action === 'edit' && canEditStudentRecords()) {
      openStudentModal(student, groups, container, currentSearch, currentCourseId);
    }
    if (action === 'progress') {
      const groupId = studentGroupId(student);
      if (!groupId) {
        showToast('Asigna un grupo al estudiante para ver su progreso', 'warning');
        return;
      }
      navigateTo(`grupos/${groupId}/${id}`);
    }
    if (action === 'delete' && isAdmin()) {
      const ok = await showConfirm(
        `¿Eliminar a ${student.nombre} ${student.apellido || ''}? Esta acción no se puede deshacer.`,
        'Eliminar Estudiante'
      );
      if (ok) {
        try {
          await remove(COLLECTIONS.STUDENTS, id);
          showToast('Estudiante eliminado', 'success');
          await loadStudents(container, currentSearch, currentCourseId);
        } catch {
          showToast('Error al eliminar el estudiante', 'error');
        }
      }
    }
  }, { capture: false });
}

function studentEstadoOptions(selected = 'activo') {
  const options = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'congelado', label: 'Congelado' },
    { value: 'graduado', label: 'Graduado' },
  ];
  return options.map(o =>
    `<option value="${o.value}" ${selected === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');
}

function studentForm(student = null, groups = []) {
  const s = student || {};
  const selectedGroupId = s.grupoId || s.groupId || '';
  return `
    <form id="student-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">Nombre(s)</label>
          <input type="text" name="nombre" class="form-control" value="${escapeHtml(s.nombre || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label required">Apellido(s)</label>
          <input type="text" name="apellido" class="form-control" value="${escapeHtml(s.apellido || '')}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cédula / Documento</label>
          <div class="cedula-lookup">
            <input type="text" name="documento" id="student-documento" class="form-control"
              inputmode="numeric" autocomplete="off"
              placeholder="Ej. 123456789" value="${escapeHtml(s.documento || '')}">
            <button type="button" id="btn-lookup-cedula" class="btn btn-outline btn-sm">
              Consultar
            </button>
          </div>
          <p id="cedula-lookup-status" class="form-hint hidden"></p>
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Nacimiento</label>
          <input type="date" name="fechaNacimiento" class="form-control" value="${escapeHtml(s.fechaNacimiento || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email principal</label>
          <input type="email" name="email" class="form-control" value="${escapeHtml(s.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Email secundario</label>
          <input type="email" name="email2" class="form-control" value="${escapeHtml(s.email2 || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" name="telefono" class="form-control" value="${escapeHtml(s.telefono || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Fecha de Ingreso</label>
          <input type="date" name="fechaIngreso" class="form-control" value="${escapeHtml(s.fechaIngreso || today())}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Grupo</label>
          <select name="grupoId" class="form-control">
            <option value="">— Sin grupo —</option>
            ${groups.map(g => `
              <option value="${g.id}" ${selectedGroupId === g.id ? 'selected' : ''}>
                ${escapeHtml(g.nombre || `Grupo ${g.numero}`)}${g.anio ? ` · ${g.anio}` : ''}
              </option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select name="estado" class="form-control">
            ${studentEstadoOptions(s.estado || 'activo')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Dirección</label>
          <input type="text" name="direccion" class="form-control" value="${escapeHtml(s.direccion || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notas / Observaciones</label>
        <textarea name="notas" class="form-control" rows="2">${escapeHtml(s.notas || '')}</textarea>
      </div>
    </form>`;
}

function attachCedulaLookup(isEdit = false) {
  const docInput = document.getElementById('student-documento');
  const lookupBtn = document.getElementById('btn-lookup-cedula');
  const statusEl = document.getElementById('cedula-lookup-status');
  const form = document.getElementById('student-form');
  if (!docInput || !lookupBtn || !form) return;

  let lookupInProgress = false;
  let lastLookupId = normalizeIdentificacion(docInput.value);

  const setStatus = (msg, type = 'info') => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden', 'form-hint-success', 'form-hint-error');
    if (type === 'success') statusEl.classList.add('form-hint-success');
    if (type === 'error') statusEl.classList.add('form-hint-error');
    if (!msg) statusEl.classList.add('hidden');
  };

  const fillFromLookup = (data) => {
    const { nombre, apellido } = parseNombreContribuyente(data.nombre, data.tipoIdentificacion);
    if (nombre) form.nombre.value = nombre;
    if (apellido) form.apellido.value = apellido;
    setStatus(`Datos obtenidos de Hacienda: ${data.nombre}`, 'success');
  };

  const doLookup = async () => {
    if (lookupInProgress) return;

    const normalized = normalizeIdentificacion(docInput.value);
    if (!normalized) {
      setStatus('Ingrese un número de cédula.', 'error');
      return;
    }
    if (!isValidIdentificacion(normalized)) {
      setStatus('La cédula debe tener entre 9 y 12 dígitos.', 'error');
      return;
    }
    if (normalized === lastLookupId && form.nombre.value.trim()) return;

    lookupInProgress = true;
    lookupBtn.disabled = true;
    lookupBtn.textContent = 'Consultando…';
    setStatus('Consultando en Hacienda…');

    try {
      const data = await lookupContribuyente(normalized);
      docInput.value = normalized;
      lastLookupId = normalized;
      fillFromLookup(data);
    } catch (err) {
      setStatus(err.message || 'Error al consultar la cédula.', 'error');
    } finally {
      lookupInProgress = false;
      lookupBtn.disabled = false;
      lookupBtn.textContent = 'Consultar';
    }
  };

  lookupBtn.addEventListener('click', doLookup);
  docInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doLookup();
    }
  });
  if (!isEdit) {
    docInput.addEventListener('blur', () => {
      if (isValidIdentificacion(docInput.value)) doLookup();
    });
  }
}

function openStudentModal(student, groups, container, currentSearch = '', currentCourseId = '') {
  const isEdit = !!student;
  showModal({
    title: isEdit ? 'Editar Estudiante' : 'Agregar Estudiante',
    content: studentForm(student, groups),
    confirmLabel: isEdit ? 'Guardar cambios' : 'Agregar estudiante',
    size: 'lg',
    onConfirm: async (closeModal) => {
      const form = document.getElementById('student-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const data = Object.fromEntries(new FormData(form));
      if (!data.grupoId) delete data.grupoId;
      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Guardando…';

      try {
        if (isEdit) {
          await update(COLLECTIONS.STUDENTS, student.id, data);
          showToast('Estudiante actualizado', 'success');
        } else {
          await create(COLLECTIONS.STUDENTS, data);
          showToast('Estudiante agregado', 'success');
        }
        closeModal();
        await loadStudents(container, currentSearch, currentCourseId);
      } catch (err) {
        console.error(err);
        const msg = err?.code === 'permission-denied'
          ? 'No tienes permiso para guardar estos cambios.'
          : 'Error al guardar el estudiante';
        showToast(msg, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = isEdit ? 'Guardar cambios' : 'Agregar estudiante';
      }
    },
  });
  attachCedulaLookup(isEdit);
}
