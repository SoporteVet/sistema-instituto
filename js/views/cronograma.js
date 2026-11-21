import {
  getAll, create, update, remove,
  getCronogramaByGroup, COLLECTIONS
} from '../services/db.js';
import { seedOfficialCronograma } from '../services/cronograma-seed-service.js';
import {
  CRONOGRAMA_PROFESORES,
  buildProfesorGrid,
} from '../logic/cronograma-seed.js';
import { isAdmin } from '../auth.js';
import { renderProyectoFinalPanel } from './proyecto-final.js';
import {
  loadingHtml, errorHtml, emptyHtml, showModal, showConfirm,
  showToast, pageHeader, escapeHtml, renderIcons, actionBtn
} from '../ui.js';

let viewMode = 'profesores';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Formatea una fecha 'YYYY-MM-DD' sin desfase de zona horaria.
function fmtFecha(str) {
  if (!str) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return str;
  const [, , mes, dia] = m;
  return `${Number(dia)} ${MESES[Number(mes) - 1] || ''}`;
}

const CUATRIMESTRES = [
  { num: 1, label: 'I Cuatrimestre',   cls: 'cuatri-1' },
  { num: 2, label: 'II Cuatrimestre',  cls: 'cuatri-2' },
  { num: 3, label: 'III Cuatrimestre', cls: 'cuatri-3' },
  { num: 4, label: 'IV Cuatrimestre',  cls: 'cuatri-4' },
];

export async function render(container, params = []) {
  container.innerHTML = loadingHtml('Cargando cronograma...');

  try {
    const [groups, courses] = await Promise.all([
      getAll(COLLECTIONS.GROUPS, 'numero'),
      getAll(COLLECTIONS.COURSES, 'orden'),
    ]);

    const preselectedId = params[0] || '';
    if (preselectedId) viewMode = 'grupo';

    const courseNames = Object.fromEntries(courses.map(c => [c.codigo, c.nombre]));

    container.innerHTML = `
      ${pageHeader(
        'Cronograma Académico',
        'Programación por profesor y por grupo (Grupos 8–13)',
        isAdmin() ? `
        <button type="button" class="btn btn-outline" id="btn-seed-cronograma">
          Cargar cronograma oficial
        </button>` : ''
      )}

      <div class="cronograma-tabs mb-4">
        <button type="button" class="cronograma-tab ${viewMode === 'profesores' ? 'active' : ''}" data-view="profesores">
          Por profesor
        </button>
        <button type="button" class="cronograma-tab ${viewMode === 'grupo' ? 'active' : ''}" data-view="grupo">
          Por grupo
        </button>
      </div>

      <div id="cronograma-main">
        ${viewMode === 'profesores'
          ? renderProfesoresView(courseNames)
          : renderGrupoSelector(groups, preselectedId)}
      </div>

      <div id="cronograma-panel"></div>`;

    renderIcons();
    attachMainListeners(container, { groups, courses, preselectedId, courseNames });

    if (viewMode === 'grupo' && preselectedId) {
      await loadCronograma(preselectedId, groups, courses, container);
    } else if (viewMode === 'grupo') {
      document.getElementById('cronograma-panel').innerHTML = `
        <div class="empty-state mt-4">
          <div class="empty-icon">🗓️</div>
          <p>Selecciona un grupo para ver y editar su cronograma.</p>
        </div>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar el módulo de cronograma.');
  }
}

function renderGrupoSelector(groups, preselectedId) {
  return `
    <div class="card mb-4">
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Seleccionar Grupo</label>
          <select id="cronograma-group-sel" class="form-control form-control-lg">
            <option value="">— Seleccionar grupo —</option>
            ${groups.map(g => `
              <option value="${g.id}" ${g.id === preselectedId ? 'selected' : ''}>
                ${escapeHtml(g.nombre || `Grupo ${g.numero}`)}${g.anio ? ` · ${g.anio}` : ''}
              </option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
}

function renderProfesoresView(courseNames) {
  return `
    <div class="cronograma-prof-grid">
      ${CRONOGRAMA_PROFESORES.map(prof => renderProfesorTable(prof, courseNames)).join('')}
    </div>`;
}

function renderProfesorTable(prof, courseNames) {
  const rows = buildProfesorGrid(prof.nombre, courseNames);

  return `
    <div class="card cronograma-prof-card ${prof.color}">
      <div class="card-header cronograma-prof-head">
        <h3 class="card-title">${escapeHtml(prof.nombre)}</h3>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-compact cronograma-prof-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Curso</th>
                <th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td class="cronograma-mes">${escapeHtml(row.label)}</td>
                  <td>${row.celdas.length
                    ? row.celdas.map(c => `<div><code class="code-tag">${escapeHtml(c.codigo)}</code> ${escapeHtml(c.curso)}</div>`).join('')
                    : '<span class="text-muted">—</span>'}</td>
                  <td>${row.celdas.length
                    ? row.celdas.map(c => `<div>Grupo ${escapeHtml(c.gruposLabel)}</div>`).join('')
                    : '<span class="text-muted">—</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function attachMainListeners(container, ctx) {
  container.querySelector('#btn-seed-cronograma')?.addEventListener('click', () =>
    seedCronogramaFromUI(container, ctx));

  container.querySelectorAll('.cronograma-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      viewMode = tab.dataset.view;
      container.querySelectorAll('.cronograma-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.view === viewMode));

      const main = container.querySelector('#cronograma-main');
      const panel = container.querySelector('#cronograma-panel');

      if (viewMode === 'profesores') {
        main.innerHTML = renderProfesoresView(ctx.courseNames);
        panel.innerHTML = '';
      } else {
        main.innerHTML = renderGrupoSelector(ctx.groups, '');
        panel.innerHTML = `
          <div class="empty-state mt-4">
            <div class="empty-icon">🗓️</div>
            <p>Selecciona un grupo para ver y editar su cronograma.</p>
          </div>`;
        container.querySelector('#cronograma-group-sel')?.addEventListener('change', e =>
          loadCronograma(e.target.value, ctx.groups, ctx.courses, container));
      }
    });
  });

  if (viewMode === 'grupo') {
    container.querySelector('#cronograma-group-sel')?.addEventListener('change', e =>
      loadCronograma(e.target.value, ctx.groups, ctx.courses, container));
  }
}

async function seedCronogramaFromUI(container, ctx) {
  const ok = await showConfirm(
    'Se cargará el cronograma oficial con Javier, Randall, Abel y Paul para los grupos 8–13. ' +
    'Reemplaza el cronograma existente de esos grupos. Requiere el Plan de Estudios ATV cargado en Cursos. ¿Continuar?',
    'Cargar cronograma oficial'
  );
  if (!ok) return;

  const btn = container.querySelector('#btn-seed-cronograma');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Cargando…';
  }

  try {
    const result = await seedOfficialCronograma({ replaceExisting: true, createGroups: true });
    let msg = `${result.entriesCreated} materia(s) programadas`;
    if (result.groupsCreated) msg += ` · ${result.groupsCreated} grupo(s) creados`;
    if (result.skipped?.length) {
      showToast(`${msg}. Advertencias: ${result.skipped.slice(0, 2).join('; ')}`, 'warning');
    } else {
      showToast(msg, 'success');
    }

    const [groups, courses] = await Promise.all([
      getAll(COLLECTIONS.GROUPS, 'numero'),
      getAll(COLLECTIONS.COURSES, 'orden'),
    ]);
    ctx.groups = groups;
    ctx.courses = courses;
    ctx.courseNames = Object.fromEntries(courses.map(c => [c.codigo, c.nombre]));

    if (viewMode === 'profesores') {
      container.querySelector('#cronograma-main').innerHTML = renderProfesoresView(ctx.courseNames);
    }
  } catch (err) {
    console.error(err);
    showToast(err?.message || 'Error al cargar el cronograma', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Cargar cronograma oficial';
    }
  }
}

async function loadCronograma(groupId, groups, courses, container) {
  const panel = document.getElementById('cronograma-panel');
  if (!groupId) { panel.innerHTML = ''; return; }

  panel.innerHTML = loadingHtml('Cargando cronograma del grupo...');

  try {
    const group = groups.find(g => g.id === groupId);
    const entries = await getCronogramaByGroup(groupId);
    entries.sort((a, b) => (a.orden || 0) - (b.orden || 0));

    const hasCourses = courses.length > 0;
    const canGenerate = isAdmin() && entries.length === 0 && hasCourses;

    panel.innerHTML = `
      <div class="card mb-4">
        <div class="card-body cronograma-toolbar">
          <div class="cronograma-group-info">
            <h2 class="student-name">${escapeHtml(group?.nombre || `Grupo ${group?.numero || ''}`)}</h2>
            <p class="text-muted text-sm">
              ${group?.horario ? escapeHtml(group.horario) : ''}
              ${group?.sede ? ` · ${escapeHtml(group.sede)}` : ''}
              ${group?.fechaInicio ? ` · Inicio: ${escapeHtml(group.fechaInicio)}` : ''}
            </p>
          </div>
          <div class="cronograma-actions">
            ${isAdmin() ? `
              ${canGenerate ? `
                <button class="btn btn-outline" id="btn-generate-base">
                  <i data-lucide="wand-2"></i> Generar cronograma base
                </button>` : ''}
              <button class="btn btn-primary" id="btn-add-materia">
                <i data-lucide="plus"></i> Agregar materia
              </button>` : ''}
          </div>
        </div>
      </div>

      ${entries.length === 0
        ? emptyHtml(
            isAdmin()
              ? (hasCourses
                  ? 'Este grupo no tiene cronograma. Genera el cronograma base o agrega materias.'
                  : 'No hay cursos registrados. Crea cursos antes de generar el cronograma.')
              : 'Este grupo aún no tiene cronograma.')
        : `<div class="cronograma-grid cronograma-grid-4">
            ${CUATRIMESTRES.map(c => renderCuatrimestre(c, entries)).join('')}
          </div>
          <div id="proyecto-final-panel"></div>`}`;

    renderIcons();
    attachListeners(panel, { groupId, group, groups, courses, entries, container });
    if (entries.length > 0) {
      await renderProyectoFinalPanel(groupId, group, container);
    }
  } catch (err) {
    console.error(err);
    panel.innerHTML = errorHtml('Error al cargar el cronograma del grupo.');
  }
}

function renderCuatrimestre(cuatri, entries) {
  const items = entries.filter(e => Number(e.cuatrimestre) === cuatri.num);
  const totT = items.reduce((s, e) => s + (Number(e.horasTeoricas) || 0), 0);
  const totP = items.reduce((s, e) => s + (Number(e.horasPracticas) || 0), 0);

  return `
    <div class="cronograma-col ${cuatri.cls}">
      <div class="cronograma-col-head">${cuatri.label}</div>
      <div class="cronograma-col-body">
        ${items.length === 0
          ? `<p class="text-muted text-sm cronograma-empty">Sin materias</p>`
          : items.map(renderMateriaCard).join('')}
      </div>
      <div class="cronograma-col-foot">
        <span>Horas teóricas: <strong>${totT}</strong></span>
        <span>Horas prácticas: <strong>${totP}</strong></span>
      </div>
    </div>`;
}

function renderMateriaCard(e) {
  const bloques = Array.isArray(e.bloques) ? e.bloques : [];
  return `
    <div class="materia-card" data-id="${e.id}">
      <div class="materia-card-head">
        <div>
          ${e.codigo ? `<code class="code-tag">${escapeHtml(e.codigo)}</code>` : ''}
          <div class="materia-name">${escapeHtml(e.materiaNombre || '')}</div>
          ${e.profesor ? `<div class="materia-prof"><i data-lucide="user"></i> ${escapeHtml(e.profesor)}</div>` : ''}
        </div>
        ${isAdmin() ? `
          <div class="action-btns">
            <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="edit-materia" data-id="${e.id}" title="Editar">
              ${actionBtn('Editar', 'edit-2')}
            </button>
            <button type="button" class="btn btn-ghost btn-sm btn-action danger" data-action="delete-materia" data-id="${e.id}" title="Eliminar">
              ${actionBtn('Eliminar', 'trash-2')}
            </button>
          </div>` : ''}
      </div>
      ${bloques.length > 0 ? `
        <ul class="materia-bloques">
          ${bloques.map(b => `
            <li class="${b.tipo === 'practica' ? 'bloque-practica' : 'bloque-teoria'}">
              <span class="bloque-fechas">${fmtFecha(b.fechaInicio)}${b.fechaFin ? ` – ${fmtFecha(b.fechaFin)}` : ''}</span>
              ${b.descripcion ? `<span class="bloque-desc">${escapeHtml(b.descripcion)}</span>` : ''}
              ${b.tipo ? `<span class="bloque-tag">${b.tipo === 'practica' ? 'Práctica' : 'Teoría'}</span>` : ''}
            </li>`).join('')}
        </ul>` : `<p class="text-muted text-sm materia-sin-fechas">Sin fechas asignadas</p>`}
      ${(Number(e.horasTeoricas) || Number(e.horasPracticas)) ? `
        <div class="materia-horas">
          ${Number(e.horasTeoricas) ? `<span>T: ${e.horasTeoricas}h</span>` : ''}
          ${Number(e.horasPracticas) ? `<span>P: ${e.horasPracticas}h</span>` : ''}
        </div>` : ''}
      ${e.seguimiento ? `<div class="materia-seguimiento"><i data-lucide="sticky-note"></i> ${escapeHtml(e.seguimiento)}</div>` : ''}
    </div>`;
}

function attachListeners(panel, ctx) {
  const { groupId, courses, entries, groups, container } = ctx;

  if (isAdmin()) {
    panel.querySelector('#btn-add-materia')?.addEventListener('click', () =>
      openMateriaModal(null, ctx));
    panel.querySelector('#btn-generate-base')?.addEventListener('click', () =>
      generateBase(ctx));
  }

  panel.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !isAdmin()) return;
    const { action, id } = btn.dataset;
    const entry = entries.find(x => x.id === id);
    if (!entry) return;

    if (action === 'edit-materia') openMateriaModal(entry, ctx);
    if (action === 'delete-materia') {
      const ok = await showConfirm(
        `¿Eliminar la materia "${entry.materiaNombre}" del cronograma?`,
        'Eliminar materia'
      );
      if (ok) {
        try {
          await remove(COLLECTIONS.CRONOGRAMA, id);
          showToast('Materia eliminada', 'success');
          await loadCronograma(groupId, groups, courses, container);
        } catch {
          showToast('Error al eliminar la materia', 'error');
        }
      }
    }
  }, { capture: false });
}

// ─── Generar cronograma base desde los cursos ─────────────────────────────────

async function generateBase(ctx) {
  const { groupId, courses, groups, container } = ctx;
  const sorted = [...courses].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const total = sorted.length;
  const perCuatri = Math.ceil(total / 4);

  const ok = await showConfirm(
    `Se crearán ${total} materia(s) en el cronograma de este grupo (4 cuatrimestres). Podrás ajustar fechas y profesores después.`,
    'Generar cronograma base'
  );
  if (!ok) return;

  try {
    await Promise.all(sorted.map((course, index) => {
      const cuatrimestre = Math.min(4, Math.floor(index / perCuatri) + 1);
      return create(COLLECTIONS.CRONOGRAMA, {
        groupId,
        courseId: course.id,
        codigo: course.codigo || '',
        materiaNombre: course.nombre || '',
        profesor: '',
        cuatrimestre,
        orden: course.orden || index + 1,
        bloques: [],
        horasTeoricas: 0,
        horasPracticas: 0,
        seguimiento: '',
      });
    }));
    showToast('Cronograma base generado', 'success');
    await loadCronograma(groupId, groups, courses, container);
  } catch (err) {
    console.error(err);
    showToast('Error al generar el cronograma base', 'error');
  }
}

// ─── Editor de bloques de fecha (dentro del modal) ────────────────────────────

function initBloquesUI(initialBloques = []) {
  let bloques = initialBloques.map(b => ({ ...b }));

  const list   = document.getElementById('bloques-list');
  const btnAdd = document.getElementById('btn-add-bloque');
  const hidden = document.getElementById('bloques-data');

  function paint() {
    list.innerHTML = bloques.length === 0
      ? '<p class="text-muted text-sm">Sin bloques de fecha.</p>'
      : bloques.map((b, i) => `
          <div class="bloque-row" data-idx="${i}">
            <input type="date" class="form-control" value="${escapeHtml(b.fechaInicio || '')}" data-field="fechaInicio" title="Inicio">
            <input type="date" class="form-control" value="${escapeHtml(b.fechaFin || '')}" data-field="fechaFin" title="Fin">
            <select class="form-control" data-field="tipo" title="Tipo">
              <option value="teoria"   ${b.tipo !== 'practica' ? 'selected' : ''}>Teoría</option>
              <option value="practica" ${b.tipo === 'practica' ? 'selected' : ''}>Práctica</option>
            </select>
            <input type="text" class="form-control" value="${escapeHtml(b.descripcion || '')}" data-field="descripcion" placeholder="Descripción (opcional)">
            <button type="button" class="btn btn-ghost btn-icon danger btn-sm" data-remove="${i}" title="Quitar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>`).join('');

    hidden.value = JSON.stringify(bloques);

    list.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', e => {
        const row = e.target.closest('[data-idx]');
        const idx = Number(row.dataset.idx);
        bloques[idx][e.target.dataset.field] = e.target.value;
        hidden.value = JSON.stringify(bloques);
      });
    });

    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        bloques.splice(Number(btn.dataset.remove), 1);
        paint();
      });
    });
  }

  btnAdd.addEventListener('click', () => {
    bloques.push({ fechaInicio: '', fechaFin: '', tipo: 'teoria', descripcion: '' });
    paint();
  });

  paint();
}

// ─── Modal de materia ─────────────────────────────────────────────────────────

function materiaForm(entry, courses) {
  const e = entry || {};
  return `
    <form id="materia-form" class="form-grid">
      <div class="form-group">
        <label class="form-label">Curso (opcional)</label>
        <select name="courseId" id="materia-course" class="form-control">
          <option value="">— Materia libre —</option>
          ${courses.map(c => `
            <option value="${c.id}" ${e.courseId === c.id ? 'selected' : ''}>
              ${escapeHtml(c.codigo)} – ${escapeHtml(c.nombre)}
            </option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Código</label>
          <input type="text" name="codigo" id="materia-codigo" class="form-control" value="${escapeHtml(e.codigo || '')}" placeholder="ATV-001">
        </div>
        <div class="form-group">
          <label class="form-label required">Nombre de la materia</label>
          <input type="text" name="materiaNombre" id="materia-nombre" class="form-control" value="${escapeHtml(e.materiaNombre || '')}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Profesor</label>
          <input type="text" name="profesor" class="form-control" value="${escapeHtml(e.profesor || '')}">
        </div>
        <div class="form-group">
          <label class="form-label required">Cuatrimestre</label>
          <select name="cuatrimestre" class="form-control" required>
            ${CUATRIMESTRES.map(c => `<option value="${c.num}" ${Number(e.cuatrimestre) === c.num ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Horas teóricas</label>
          <input type="number" name="horasTeoricas" class="form-control" value="${e.horasTeoricas ?? ''}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Horas prácticas</label>
          <input type="number" name="horasPracticas" class="form-control" value="${e.horasPracticas ?? ''}" min="0">
        </div>
      </div>

      <div class="form-divider"><span>Bloques de fecha</span></div>
      <div id="bloques-list" class="bloques-list"></div>
      <input type="hidden" id="bloques-data" name="bloquesJson" value="[]">
      <button type="button" id="btn-add-bloque" class="btn btn-outline btn-sm">
        <i data-lucide="calendar-plus"></i> Agregar bloque de fecha
      </button>

      <div class="form-group">
        <label class="form-label">Seguimiento administrativo</label>
        <textarea name="seguimiento" class="form-control" rows="2">${escapeHtml(e.seguimiento || '')}</textarea>
      </div>
    </form>`;
}

function openMateriaModal(entry, ctx) {
  const { groupId, courses, groups, container } = ctx;
  const isEdit = !!entry;

  showModal({
    title: isEdit ? 'Editar materia' : 'Agregar materia',
    content: materiaForm(entry, courses),
    confirmLabel: isEdit ? 'Guardar cambios' : 'Agregar materia',
    size: 'lg',
    onConfirm: async (closeModal) => {
      const form = document.getElementById('materia-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const fd = new FormData(form);
      const data = {
        groupId,
        courseId: fd.get('courseId') || null,
        codigo: fd.get('codigo').trim(),
        materiaNombre: fd.get('materiaNombre').trim(),
        profesor: fd.get('profesor').trim(),
        cuatrimestre: Number(fd.get('cuatrimestre')),
        horasTeoricas: Number(fd.get('horasTeoricas') || 0),
        horasPracticas: Number(fd.get('horasPracticas') || 0),
        bloques: JSON.parse(fd.get('bloquesJson') || '[]'),
        seguimiento: fd.get('seguimiento').trim(),
        orden: entry?.orden ?? (ctx.entries.length + 1),
      };

      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Guardando…';

      try {
        if (isEdit) {
          await update(COLLECTIONS.CRONOGRAMA, entry.id, data);
          showToast('Materia actualizada', 'success');
        } else {
          await create(COLLECTIONS.CRONOGRAMA, data);
          showToast('Materia agregada', 'success');
        }
        closeModal();
        await loadCronograma(groupId, groups, courses, container);
      } catch (err) {
        console.error(err);
        const msg = err?.code === 'permission-denied'
          ? 'No tienes permiso para guardar estos cambios.'
          : 'Error al guardar la materia';
        showToast(msg, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = isEdit ? 'Guardar cambios' : 'Agregar materia';
      }
    },
  });

  requestAnimationFrame(() => {
    renderIcons();
    initBloquesUI(entry?.bloques || []);

    // Autocompletar código/nombre al elegir un curso.
    const courseSel = document.getElementById('materia-course');
    courseSel?.addEventListener('change', () => {
      const course = courses.find(c => c.id === courseSel.value);
      if (course) {
        document.getElementById('materia-codigo').value = course.codigo || '';
        const nombreInput = document.getElementById('materia-nombre');
        if (!nombreInput.value.trim()) nombreInput.value = course.nombre || '';
      }
    });
  });
}
