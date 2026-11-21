import { getAll, create, update, remove, COLLECTIONS } from '../services/db.js';
import { canManageEnrollmentRecords } from '../auth.js';
import {
  loadingHtml, errorHtml, emptyHtml, showModal, showConfirm,
  showToast, pageHeader, escapeHtml, formatDate, renderIcons
} from '../ui.js';

const ESPACIOS = [
  'Consulta 1', 'Consulta 2', 'Quirófano', 'Laboratorio', 'Campo clínico', 'Otro',
];

export async function render(container) {
  container.innerHTML = loadingHtml('Cargando agendamiento...');
  await loadView(container);
}

async function loadView(container) {
  try {
    const [items, students, groups] = await Promise.all([
      getAll(COLLECTIONS.AGENDAMIENTO),
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
      getAll(COLLECTIONS.GROUPS, 'numero'),
    ]);

    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));
    const canManage = canManageEnrollmentRecords();

    const sorted = [...items].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    container.innerHTML = `
      ${pageHeader(
        'Agendamiento de Práctica Profesional',
        'Fechas, grupos, estudiantes y espacios disponibles',
        canManage ? `
          <button type="button" class="btn btn-primary" id="btn-add-cita">
            Nueva cita
          </button>` : ''
      )}

      <div class="card mb-4">
        <div class="card-body">
          <div class="form-row export-filters">
            <div class="form-group">
              <label class="form-label">Filtrar por grupo</label>
              <select id="agenda-filter-group" class="form-control">
                <option value="">Todos los grupos</option>
                ${groups.map(g => `
                  <option value="${g.id}">${escapeHtml(g.nombre || `Grupo ${g.numero}`)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Filtrar por fecha</label>
              <input type="date" id="agenda-filter-date" class="form-control">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Citas programadas (${sorted.length})</h3>
        </div>
        <div class="card-body p-0">
          ${sorted.length === 0
            ? emptyHtml('No hay citas de práctica programadas.', canManage ? 'Nueva cita' : null, 'empty-add')
            : `
            <div class="table-responsive">
              <table class="table" id="agenda-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Grupo</th>
                    <th>Estudiante</th>
                    <th>Espacio</th>
                    <th>Estado</th>
                    ${canManage ? '<th>Acciones</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${sorted.map(item => agendaRow(item, studentMap, groupMap, canManage)).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>`;

    renderIcons();
    attachListeners(container, { students, groups, canManage });
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar agendamiento.');
  }
}

function agendaRow(item, studentMap, groupMap, canManage) {
  const st = studentMap[item.studentId];
  const gr = groupMap[item.groupId];
  const estadoCls = {
    programado: 'badge-info',
    completado: 'badge-success',
    cancelado: 'badge-danger',
  }[item.estado] || 'badge-neutral';

  return `
    <tr data-group-id="${item.groupId || ''}" data-fecha="${item.fecha || ''}">
      <td>${escapeHtml(item.fecha || '—')}</td>
      <td>${escapeHtml(item.horaInicio || '—')}${item.horaFin ? ` – ${escapeHtml(item.horaFin)}` : ''}</td>
      <td>${escapeHtml(gr?.nombre || gr?.numero ? `Grupo ${gr?.numero}` : '—')}</td>
      <td>
        <div class="cell-primary">${escapeHtml(st ? `${st.nombre} ${st.apellido || ''}` : '—')}</div>
        <div class="cell-secondary">${escapeHtml(st?.documento || '')}</div>
      </td>
      <td>${escapeHtml(item.espacio || '—')}</td>
      <td><span class="badge ${estadoCls}">${escapeHtml(item.estado || 'programado')}</span></td>
      ${canManage ? `
        <td>
          <div class="action-btns">
            <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${item.id}">Editar</button>
            <button type="button" class="btn btn-ghost btn-sm danger" data-action="delete" data-id="${item.id}">Eliminar</button>
          </div>
        </td>` : ''}
    </tr>`;
}

function attachListeners(container, ctx) {
  const { students, groups, canManage } = ctx;

  container.querySelector('#btn-add-cita')?.addEventListener('click', () =>
    openCitaModal(null, students, groups, container));
  container.querySelector('#empty-add')?.addEventListener('click', () =>
    openCitaModal(null, students, groups, container));

  container.querySelector('#agenda-filter-group')?.addEventListener('change', applyFilters);
  container.querySelector('#agenda-filter-date')?.addEventListener('change', applyFilters);

  function applyFilters() {
    const g = container.querySelector('#agenda-filter-group')?.value || '';
    const f = container.querySelector('#agenda-filter-date')?.value || '';
    container.querySelectorAll('#agenda-table tbody tr').forEach(row => {
      const okG = !g || row.dataset.groupId === g;
      const okF = !f || row.dataset.fecha === f;
      row.style.display = okG && okF ? '' : 'none';
    });
  }

  if (!canManage) return;

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const items = await getAll(COLLECTIONS.AGENDAMIENTO);
    const item = items.find(x => x.id === btn.dataset.id);
    if (!item) return;

    if (btn.dataset.action === 'edit') {
      openCitaModal(item, students, groups, container);
    }
    if (btn.dataset.action === 'delete') {
      const ok = await showConfirm('¿Eliminar esta cita de práctica?', 'Eliminar cita');
      if (ok) {
        try {
          await remove(COLLECTIONS.AGENDAMIENTO, item.id);
          showToast('Cita eliminada', 'success');
          await loadView(container);
        } catch {
          showToast('Error al eliminar', 'error');
        }
      }
    }
  });
}

function groupLabel(g) {
  return g?.nombre || (g?.numero != null ? `Grupo ${g.numero}` : '');
}

function studentLabel(s) {
  if (!s) return '';
  const name = `${s.nombre || ''} ${s.apellido || ''}`.trim();
  return s.documento ? `${name} · ${s.documento}` : name;
}

function comboField({ name, id, label, value, display, placeholder }) {
  return `
    <div class="form-group">
      <label class="form-label required" for="${id}-q">${label}</label>
      <div class="combo">
        <input type="hidden" name="${name}" id="${id}" value="${escapeHtml(value || '')}">
        <input type="search" id="${id}-q" class="form-control combo-input"
          value="${escapeHtml(display || '')}" placeholder="${escapeHtml(placeholder)}"
          autocomplete="off">
        <div class="combo-menu hidden" id="${id}-menu"></div>
      </div>
    </div>`;
}

function citaForm(item, students, groups) {
  const c = item || {};
  const selectedGroup = groups.find(g => g.id === c.groupId);
  const selectedStudent = students.find(s => s.id === c.studentId);

  return `
    <form id="cita-form" class="form-grid">
      <div class="form-row">
        ${comboField({
          name: 'groupId',
          id: 'cita-group',
          label: 'Grupo',
          value: c.groupId || '',
          display: groupLabel(selectedGroup),
          placeholder: 'Escribir para buscar grupo…',
        })}
        ${comboField({
          name: 'studentId',
          id: 'cita-student',
          label: 'Estudiante',
          value: c.studentId || '',
          display: studentLabel(selectedStudent),
          placeholder: 'Escribir para buscar estudiante…',
        })}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">Fecha</label>
          <input type="date" name="fecha" class="form-control" value="${escapeHtml(c.fecha || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Hora inicio</label>
          <input type="time" name="horaInicio" class="form-control" value="${escapeHtml(c.horaInicio || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Hora fin</label>
          <input type="time" name="horaFin" class="form-control" value="${escapeHtml(c.horaFin || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">Espacio</label>
          <select name="espacio" class="form-control" required>
            <option value="">— Seleccionar —</option>
            ${ESPACIOS.map(e => `
              <option value="${e}" ${c.espacio === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select name="estado" class="form-control">
            <option value="programado" ${c.estado === 'programado' || !c.estado ? 'selected' : ''}>Programado</option>
            <option value="completado" ${c.estado === 'completado' ? 'selected' : ''}>Completado</option>
            <option value="cancelado" ${c.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Observaciones</label>
        <textarea name="observaciones" class="form-control" rows="2">${escapeHtml(c.observaciones || '')}</textarea>
      </div>
    </form>`;
}

function openCitaModal(item, students, groups, container) {
  const isEdit = !!item;
  showModal({
    title: isEdit ? 'Editar cita de práctica' : 'Nueva cita de práctica',
    content: citaForm(item, students, groups),
    confirmLabel: isEdit ? 'Guardar' : 'Agendar',
    size: 'lg',
    onConfirm: async (close) => {
      const form = document.getElementById('cita-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const fd = new FormData(form);
      if (!fd.get('groupId')) { showToast('Selecciona un grupo', 'warning'); return; }
      if (!fd.get('studentId')) { showToast('Selecciona un estudiante', 'warning'); return; }
      const data = {
        groupId: fd.get('groupId'),
        studentId: fd.get('studentId'),
        fecha: fd.get('fecha'),
        horaInicio: fd.get('horaInicio') || '',
        horaFin: fd.get('horaFin') || '',
        espacio: fd.get('espacio'),
        estado: fd.get('estado') || 'programado',
        tipo: 'practica_profesional',
        observaciones: fd.get('observaciones')?.trim() || '',
      };
      try {
        if (isEdit) {
          await update(COLLECTIONS.AGENDAMIENTO, item.id, data);
          showToast('Cita actualizada', 'success');
        } else {
          await create(COLLECTIONS.AGENDAMIENTO, data);
          showToast('Cita agendada', 'success');
        }
        close();
        await loadView(container);
      } catch (err) {
        console.error(err);
        showToast('Error al guardar la cita', 'error');
      }
    },
  });

  requestAnimationFrame(() => bindCitaCombos(students, groups, item));
}

function studentsForGroup(students, groupId) {
  if (!groupId) return students;
  return students.filter(s => (s.grupoId || s.groupId) === groupId);
}

function bindCombo({ hiddenId, items, getId, getLabel, onChange }) {
  const hidden = document.getElementById(hiddenId);
  const input = document.getElementById(`${hiddenId}-q`);
  const menu = document.getElementById(`${hiddenId}-menu`);
  if (!hidden || !input || !menu) return { setItems() {} };

  let list = items;

  function renderMenu() {
    const q = input.value.toLowerCase().trim();
    const filtered = list.filter(x => getLabel(x).toLowerCase().includes(q));
    menu.innerHTML = filtered.length
      ? filtered.slice(0, 40).map(x => `
          <button type="button" class="combo-option" data-id="${getId(x)}">
            ${escapeHtml(getLabel(x))}
          </button>`).join('')
      : `<div class="combo-empty">Sin coincidencias</div>`;
    menu.classList.remove('hidden');
  }

  function pick(id) {
    const item = list.find(x => getId(x) === id);
    if (!item) return;
    hidden.value = id;
    input.value = getLabel(item);
    menu.classList.add('hidden');
    onChange?.(item);
  }

  input.addEventListener('focus', renderMenu);
  input.addEventListener('input', () => {
    hidden.value = '';
    renderMenu();
  });
  menu.addEventListener('click', e => {
    const opt = e.target.closest('[data-id]');
    if (opt) pick(opt.dataset.id);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.combo')) menu.classList.add('hidden');
  });

  return {
    setItems(next) {
      list = next;
      if (!list.some(x => getId(x) === hidden.value)) {
        hidden.value = '';
        input.value = '';
      }
    },
  };
}

function bindCitaCombos(students, groups, item) {
  const studentCombo = bindCombo({
    hiddenId: 'cita-student',
    items: studentsForGroup(students, item?.groupId),
    getId: s => s.id,
    getLabel: studentLabel,
  });
  bindCombo({
    hiddenId: 'cita-group',
    items: groups,
    getId: g => g.id,
    getLabel: groupLabel,
    onChange: g => studentCombo.setItems(studentsForGroup(students, g.id)),
  });
}
