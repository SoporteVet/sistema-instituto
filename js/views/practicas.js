import { getAll, create, update, remove, COLLECTIONS } from '../services/db.js';
import { canEditStudentRecords, canMarkPracticaHours, getCurrentUser, getCurrentUserData, isAdmin } from '../auth.js';
import { navigateTo } from '../nav.js';
import {
  loadingHtml, errorHtml, emptyHtml, statusBadge, showModal, showConfirm,
  showToast, pageHeader, escapeHtml, renderIcons, actionBtn, iconSvg,
} from '../ui.js';
import {
  findStudentByDocumento, formatMinutos, horasPorArea, isValidIdentificacion,
  minutosEntre, normalizeIdentificacion, registroFechaKey, sesionAbierta,
  toDate, toDatetimeLocalValue,
} from '../logic/practica-horas.js';

const TABS = [
  { id: 'kiosco', label: 'Kiosco' },
  { id: 'registros', label: 'Registros' },
  { id: 'areas', label: 'Áreas' },
];

function tabFromParams(params) {
  const key = params?.[0];
  return TABS.some(t => t.id === key) ? key : 'kiosco';
}

function studentName(s) {
  return `${s?.nombre || ''} ${s?.apellido || ''}`.trim() || 'Sin nombre';
}

function initials(s) {
  const n = (s?.nombre || '').charAt(0).toUpperCase();
  const a = (s?.apellido || '').charAt(0).toUpperCase();
  return n + (a || '') || '?';
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString('es-CR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function staffMeta() {
  const user = getCurrentUser();
  const data = getCurrentUserData() || {};
  return {
    registradoPorUid: user?.uid || '',
    registradoPorNombre: data.nombre || user?.email || '',
  };
}

export async function render(container, params) {
  container.innerHTML = loadingHtml('Cargando prácticas...');
  const tab = canEditStudentRecords() ? tabFromParams(params) : 'kiosco';
  return loadView(container, tab);
}

async function loadView(container, tab, filters = {}) {
  try {
    const [areas, registros, students] = await Promise.all([
      getAll(COLLECTIONS.PRACTICA_AREAS),
      getAll(COLLECTIONS.PRACTICA_REGISTROS),
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
    ]);

    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
    const sortedAreas = [...areas].sort((a, b) => (a.orden || 0) - (b.orden || 0)
      || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    const canEdit = canEditStudentRecords();
    const canMark = canMarkPracticaHours();
    const admin = isAdmin();
    const viewTab = canEdit ? tab : 'kiosco';

    container.innerHTML = `
      ${pageHeader('Horas de práctica', 'Entrada y salida por cédula y área')}
      ${canEdit ? `
      <div class="practicas-tabs" role="tablist">
        ${TABS.map(t => `
          <button type="button" class="practicas-tab ${t.id === viewTab ? 'active' : ''}"
            data-tab="${t.id}" role="tab" aria-selected="${t.id === viewTab}">
            ${escapeHtml(t.label)}
          </button>`).join('')}
      </div>` : ''}
      <div id="practicas-panel">
        ${viewTab === 'registros'
          ? renderRegistros(registros, studentMap, sortedAreas, filters, canEdit, admin)
          : viewTab === 'areas'
            ? renderAreas(sortedAreas, canEdit, admin)
            : renderKiosco(sortedAreas, canMark)}
      </div>`;

    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(`practicas/${btn.dataset.tab}`));
    });

    if (viewTab === 'kiosco') bindKiosco(container, { areas: sortedAreas, registros, students, canEdit: canMark, cedula: filters.cedula });
    if (viewTab === 'registros') bindRegistros(container, { registros, studentMap, areas: sortedAreas, filters, canEdit, admin });
    if (viewTab === 'areas') bindAreas(container, { canEdit, admin });

    renderIcons();

    return () => {
      if (container._kioscoTimer) {
        clearInterval(container._kioscoTimer);
        container._kioscoTimer = null;
      }
    };
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar horas de práctica.');
  }
}

function renderKiosco(areas, canEdit) {
  const activas = areas.filter(a => a.activo !== false);
  return `
    <div class="kiosco-wrap card">
      <div class="card-body">
        <label class="form-label" for="kiosco-cedula">Cédula / documento</label>
        <div class="kiosco-search">
          <input type="text" id="kiosco-cedula" class="form-control kiosco-cedula-input"
            inputmode="numeric" autocomplete="off" placeholder="Ingrese el número de cédula">
          <button type="button" class="btn btn-primary" id="kiosco-buscar">Buscar</button>
        </div>
        <p class="form-hint">El estudiante se busca por cédula. Debe estar registrado en Estudiantes.</p>
        ${!canEdit ? '<p class="text-muted text-sm">Solo lectura: no puedes marcar entrada ni salida.</p>' : ''}
        ${activas.length === 0
          ? '<p class="text-warning text-sm">No hay áreas activas. Créalas en la pestaña Áreas.</p>'
          : ''}
        <div id="kiosco-result"></div>
      </div>
    </div>`;
}

function kioscoCardHtml(student, abierta, areas) {
  const activas = areas.filter(a => a.activo !== false);
  const adentro = !!abierta;
  return `
    <div class="kiosco-student">
      <div class="student-avatar">${escapeHtml(initials(student))}</div>
      <div>
        <h2 class="kiosco-name">${escapeHtml(studentName(student))}</h2>
        <p class="text-muted">${escapeHtml(student.documento || '')}</p>
        ${student.estado && student.estado !== 'activo'
          ? `<p class="text-warning text-sm">Estado: ${escapeHtml(student.estado)}</p>` : ''}
      </div>
    </div>
    ${adentro ? `
      <div class="kiosco-open alert alert-info">
        <p><strong>Adentro</strong> en ${escapeHtml(abierta.areaNombre || 'área')}</p>
        <p class="text-sm">Entrada: ${escapeHtml(formatDateTime(abierta.entrada))}</p>
        <p class="text-sm">Tiempo: <strong id="kiosco-elapsed">${escapeHtml(formatMinutos(minutosEntre(abierta.entrada, new Date())))}</strong></p>
      </div>
      <button type="button" class="btn btn-primary kiosco-action-btn" id="kiosco-salida">Marcar salida</button>
    ` : `
      <div class="form-group mt-4">
        <label class="form-label required" for="kiosco-area">Área de práctica</label>
        <select id="kiosco-area" class="form-control" ${activas.length ? '' : 'disabled'}>
          <option value="">— Seleccionar área —</option>
          ${activas.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join('')}
        </select>
      </div>
      <button type="button" class="btn btn-primary kiosco-action-btn" id="kiosco-entrada" ${activas.length ? '' : 'disabled'}>
        Marcar entrada
      </button>
    `}`;
}

function bindKiosco(container, ctx) {
  const input = container.querySelector('#kiosco-cedula');
  const result = container.querySelector('#kiosco-result');
  if (ctx.cedula && input) input.value = ctx.cedula;

  const lookup = () => {
    if (container._kioscoTimer) {
      clearInterval(container._kioscoTimer);
      container._kioscoTimer = null;
    }
    const raw = input.value;
    if (!isValidIdentificacion(raw)) {
      result.innerHTML = `<p class="text-danger">La cédula debe tener entre 9 y 12 dígitos.</p>`;
      return;
    }
    const student = findStudentByDocumento(ctx.students, raw);
    if (!student) {
      result.innerHTML = `<p class="text-danger">No hay estudiante con esa cédula.</p>`;
      return;
    }
    const abierta = sesionAbierta(ctx.registros, student.id);
    result.innerHTML = kioscoCardHtml(student, abierta, ctx.areas);
    result._student = student;
    result._abierta = abierta;

    if (abierta) {
      const tick = () => {
        const el = result.querySelector('#kiosco-elapsed');
        if (el) el.textContent = formatMinutos(minutosEntre(abierta.entrada, new Date()));
      };
      container._kioscoTimer = setInterval(tick, 30000);
      result.querySelector('#kiosco-salida')?.addEventListener('click', () => marcarSalida(container, ctx, student, abierta));
    } else {
      result.querySelector('#kiosco-entrada')?.addEventListener('click', () => marcarEntrada(container, ctx, student));
    }
  };

  container.querySelector('#kiosco-buscar')?.addEventListener('click', lookup);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookup();
    }
  });
  if (ctx.cedula) lookup();
}

async function marcarEntrada(container, ctx, student) {
  if (!ctx.canEdit) {
    showToast('No tienes permiso para registrar entrada', 'warning');
    return;
  }
  const areaId = container.querySelector('#kiosco-area')?.value;
  const area = ctx.areas.find(a => a.id === areaId);
  if (!area) {
    showToast('Selecciona un área', 'warning');
    return;
  }
  if (sesionAbierta(ctx.registros, student.id)) {
    showToast('El estudiante ya tiene una entrada abierta', 'warning');
    return;
  }
  try {
    await create(COLLECTIONS.PRACTICA_REGISTROS, {
      studentId: student.id,
      documento: normalizeIdentificacion(student.documento),
      areaId: area.id,
      areaNombre: area.nombre,
      entrada: new Date().toISOString(),
      salida: null,
      minutos: null,
      estado: 'abierto',
      ...staffMeta(),
    });
    showToast('Entrada registrada', 'success');
    await loadView(container, 'kiosco', { cedula: student.documento });
  } catch (err) {
    console.error(err);
    showToast('Error al registrar la entrada', 'error');
  }
}

async function marcarSalida(container, ctx, student, abierta) {
  if (!ctx.canEdit) {
    showToast('No tienes permiso para registrar salida', 'warning');
    return;
  }
  const ahora = new Date();
  const minutos = minutosEntre(abierta.entrada, ahora);
  if (minutos === null) {
    showToast('La hora de salida no es válida', 'warning');
    return;
  }
  try {
    await update(COLLECTIONS.PRACTICA_REGISTROS, abierta.id, {
      salida: ahora.toISOString(),
      minutos,
      estado: 'cerrado',
      ...staffMeta(),
    });
    showToast(`Salida registrada · ${formatMinutos(minutos)}`, 'success');
    await loadView(container, 'kiosco', { cedula: student.documento });
  } catch (err) {
    console.error(err);
    showToast('Error al registrar la salida', 'error');
  }
}

function renderRegistros(registros, studentMap, areas, filters, canEdit, admin) {
  const search = (filters.search || '').toLowerCase().trim();
  const fecha = filters.fecha || '';
  const areaId = filters.areaId || '';

  const sorted = [...registros].sort((a, b) => {
    const da = toDate(a.entrada)?.getTime() || 0;
    const db = toDate(b.entrada)?.getTime() || 0;
    return db - da;
  });

  const filtered = sorted.filter(r => {
    const st = studentMap[r.studentId] || {};
    const hay = `${studentName(st)} ${st.documento || ''} ${r.documento || ''} ${r.areaNombre || ''}`.toLowerCase();
    if (search && !hay.includes(search)) return false;
    if (fecha && registroFechaKey(r) !== fecha) return false;
    if (areaId && r.areaId !== areaId) return false;
    return true;
  });

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-filters">
          <div class="search-box">
            ${iconSvg('search', 16)}
            <input type="text" id="practica-search" class="search-input"
              placeholder="Buscar por nombre o cédula…" value="${escapeHtml(filters.search || '')}">
          </div>
          <input type="date" id="practica-fecha" class="form-control filter-select" value="${escapeHtml(fecha)}">
          <select id="practica-area-filter" class="form-control filter-select">
            <option value="">Todas las áreas</option>
            ${areas.map(a => `
              <option value="${a.id}" ${a.id === areaId ? 'selected' : ''}>${escapeHtml(a.nombre)}</option>`).join('')}
          </select>
        </div>
        <span class="text-muted text-sm">${filtered.length} registro(s)</span>
      </div>
      <div class="card-body p-0">
        ${filtered.length === 0
          ? emptyHtml('No hay registros de práctica con esos filtros.')
          : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Cédula</th>
                  <th>Área</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas</th>
                  <th>Estado</th>
                  ${(canEdit || admin) ? '<th></th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${filtered.map(r => {
                  const st = studentMap[r.studentId] || {};
                  return `
                    <tr>
                      <td>${escapeHtml(studentName(st) || '—')}</td>
                      <td>${escapeHtml(st.documento || r.documento || '—')}</td>
                      <td>${escapeHtml(r.areaNombre || '—')}</td>
                      <td>${escapeHtml(formatDateTime(r.entrada))}</td>
                      <td>${escapeHtml(formatDateTime(r.salida))}</td>
                      <td>${escapeHtml(formatMinutos(r.minutos))}</td>
                      <td>${statusBadge(r.estado)}</td>
                      ${(canEdit || admin) ? `
                        <td>
                          <div class="action-btns">
                            ${canEdit && r.estado === 'abierto' ? `
                              <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="cerrar" data-id="${r.id}">
                                ${actionBtn('Cerrar', 'clock')}
                              </button>` : ''}
                            ${admin ? `
                              <button type="button" class="btn btn-ghost btn-sm btn-action danger" data-action="delete" data-id="${r.id}">
                                ${actionBtn('Eliminar', 'trash-2')}
                              </button>` : ''}
                          </div>
                        </td>` : ''}
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    </div>`;
}

function bindRegistros(container, ctx) {
  const apply = () => {
    const next = {
      search: container.querySelector('#practica-search')?.value || '',
      fecha: container.querySelector('#practica-fecha')?.value || '',
      areaId: container.querySelector('#practica-area-filter')?.value || '',
    };
    loadView(container, 'registros', next);
  };

  container.querySelector('#practica-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') apply();
  });
  container.querySelector('#practica-search')?.addEventListener('change', apply);
  container.querySelector('#practica-fecha')?.addEventListener('change', apply);
  container.querySelector('#practica-area-filter')?.addEventListener('change', apply);

  container.querySelectorAll('[data-action="cerrar"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = ctx.registros.find(r => r.id === btn.dataset.id);
      if (item) openCerrarModal(item, ctx.studentMap[item.studentId], container, ctx.filters);
    });
  });
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm(
        'Se eliminará esta entrada/salida. Esta acción no se puede deshacer.',
        'Eliminar registro'
      );
      if (!ok) return;
      try {
        await remove(COLLECTIONS.PRACTICA_REGISTROS, btn.dataset.id);
        showToast('Registro eliminado', 'success');
        await loadView(container, 'registros', ctx.filters);
      } catch (err) {
        console.error(err);
        showToast('Error al eliminar', 'error');
      }
    });
  });
}

function openCerrarModal(item, student, container, filters) {
  showModal({
    title: 'Cerrar sesión de práctica',
    content: `
      <p class="mb-3">${escapeHtml(studentName(student))} · ${escapeHtml(item.areaNombre || '')}</p>
      <p class="text-sm text-muted mb-3">Entrada: ${escapeHtml(formatDateTime(item.entrada))}</p>
      <form id="cerrar-practica-form">
        <div class="form-group">
          <label class="form-label required">Hora de salida</label>
          <input type="datetime-local" name="salida" class="form-control" required
            value="${escapeHtml(toDatetimeLocalValue(new Date()))}">
        </div>
      </form>`,
    confirmLabel: 'Cerrar sesión',
    onConfirm: async (close) => {
      const form = document.getElementById('cerrar-practica-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const salida = new Date(form.salida.value);
      const minutos = minutosEntre(item.entrada, salida);
      if (minutos === null) {
        showToast('La salida debe ser posterior a la entrada', 'warning');
        return;
      }
      try {
        await update(COLLECTIONS.PRACTICA_REGISTROS, item.id, {
          salida: salida.toISOString(),
          minutos,
          estado: 'cerrado',
          ...staffMeta(),
        });
        showToast(`Sesión cerrada · ${formatMinutos(minutos)}`, 'success');
        close();
        await loadView(container, 'registros', filters);
      } catch (err) {
        console.error(err);
        showToast('Error al cerrar la sesión', 'error');
      }
    },
  });
}

function renderAreas(areas, canEdit, admin) {
  return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Áreas de práctica</h3>
        ${canEdit ? `
          <button type="button" class="btn btn-primary btn-sm" id="btn-add-area">Agregar área</button>` : ''}
      </div>
      <div class="card-body p-0">
        ${areas.length === 0
          ? emptyHtml('No hay áreas. Agrega Consulta, Quirófano u otras según el instituto.')
          : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  ${canEdit ? '<th></th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${areas.map(a => `
                  <tr>
                    <td>${escapeHtml(String(a.orden ?? '—'))}</td>
                    <td>${escapeHtml(a.nombre || '')}</td>
                    <td>${a.activo === false ? statusBadge('inactivo') : statusBadge('activo')}</td>
                    ${canEdit ? `
                      <td>
                        <div class="action-btns">
                          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="edit-area" data-id="${a.id}">
                            ${actionBtn('Editar', 'edit-2')}
                          </button>
                          ${admin ? `
                            <button type="button" class="btn btn-ghost btn-sm btn-action danger" data-action="delete-area" data-id="${a.id}">
                              ${actionBtn('Eliminar', 'trash-2')}
                            </button>` : ''}
                        </div>
                      </td>` : ''}
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    </div>`;
}

function bindAreas(container, { canEdit, admin }) {
  container.querySelector('#btn-add-area')?.addEventListener('click', () => openAreaModal(null, container));
  container.querySelectorAll('[data-action="edit-area"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const areas = await getAll(COLLECTIONS.PRACTICA_AREAS);
      const item = areas.find(a => a.id === btn.dataset.id);
      if (item) openAreaModal(item, container);
    });
  });
  if (!admin) return;
  container.querySelectorAll('[data-action="delete-area"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm(
        'Los registros existentes conservan el nombre del área. ¿Eliminar del catálogo?',
        'Eliminar área'
      );
      if (!ok) return;
      try {
        await remove(COLLECTIONS.PRACTICA_AREAS, btn.dataset.id);
        showToast('Área eliminada', 'success');
        await loadView(container, 'areas');
      } catch (err) {
        console.error(err);
        showToast('Error al eliminar el área', 'error');
      }
    });
  });
}

function openAreaModal(item, container) {
  const isEdit = !!item;
  showModal({
    title: isEdit ? 'Editar área' : 'Nueva área',
    content: `
      <form id="area-practica-form" class="form-grid">
        <div class="form-group">
          <label class="form-label required">Nombre</label>
          <input type="text" name="nombre" class="form-control" required
            value="${escapeHtml(item?.nombre || '')}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Orden</label>
            <input type="number" name="orden" class="form-control" min="0"
              value="${escapeHtml(String(item?.orden ?? 0))}">
          </div>
          <div class="form-group">
            <label class="form-label">Estado</label>
            <select name="activo" class="form-control">
              <option value="true" ${item?.activo !== false ? 'selected' : ''}>Activo</option>
              <option value="false" ${item?.activo === false ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
        </div>
      </form>`,
    confirmLabel: isEdit ? 'Guardar' : 'Crear área',
    onConfirm: async (close) => {
      const form = document.getElementById('area-practica-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const fd = new FormData(form);
      const data = {
        nombre: String(fd.get('nombre') || '').trim(),
        orden: Number(fd.get('orden')) || 0,
        activo: fd.get('activo') !== 'false',
      };
      if (!data.nombre) {
        showToast('El nombre es obligatorio', 'warning');
        return;
      }
      try {
        if (isEdit) {
          await update(COLLECTIONS.PRACTICA_AREAS, item.id, data);
          showToast('Área actualizada', 'success');
        } else {
          await create(COLLECTIONS.PRACTICA_AREAS, data);
          showToast('Área creada', 'success');
        }
        close();
        await loadView(container, 'areas');
      } catch (err) {
        console.error(err);
        showToast('Error al guardar el área', 'error');
      }
    },
  });
}

export function horasPracticaBlockHtml(registros, studentId) {
  const { rows, totalMinutos } = horasPorArea(registros, studentId);
  if (!rows.length) {
    return `
      <div class="card mb-4">
        <div class="card-header"><h3 class="card-title">Horas de práctica por área</h3></div>
        <div class="card-body"><p class="text-muted">Aún no hay horas de práctica cerradas.</p></div>
      </div>`;
  }
  return `
    <div class="card mb-4">
      <div class="card-header">
        <h3 class="card-title">Horas de práctica por área</h3>
        <span class="text-muted text-sm">Total: ${escapeHtml(formatMinutos(totalMinutos))}</span>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-compact">
            <thead><tr><th>Área</th><th>Horas</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${escapeHtml(r.areaNombre)}</td>
                  <td><strong>${escapeHtml(formatMinutos(r.minutos))}</strong></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}
