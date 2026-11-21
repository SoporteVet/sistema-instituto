import { getAll, create, update, remove, COLLECTIONS } from '../services/db.js';
import { seedPlanEstudios2026 } from '../services/catalog-seed-service.js';
import { CATALOG_CODES, PLAN_ESTUDIOS_2026 } from '../logic/catalog-seed.js';
import {
  loadingHtml, errorHtml, emptyHtml, showModal, showConfirm,
  showToast, pageHeader, escapeHtml, formatCurrency, renderIcons,
  actionBtn
} from '../ui.js';

export async function render(container) {
  container.innerHTML = loadingHtml('Cargando cursos...');
  await loadCourses(container);
}

async function loadCourses(container) {
  try {
    const courses = await getAll(COLLECTIONS.COURSES, 'orden');
    const catalogComplete = CATALOG_CODES.every(code => courses.some(c => c.codigo === code));

    container.innerHTML = `
      ${pageHeader(
        'Cursos',
        `${PLAN_ESTUDIOS_2026.programa} · ${PLAN_ESTUDIOS_2026.titulo}`,
        `
        <button type="button" class="btn btn-outline" id="btn-seed-plan">
          Cargar Plan 2026 (ATV-001..013)
        </button>
        <button type="button" class="btn btn-primary" id="btn-add-course">
          Agregar Curso
        </button>`
      )}

      ${!catalogComplete ? `
        <div class="alert alert-info mb-4">
          <strong>Plan de Estudios 2026:</strong> faltan materias del catálogo oficial ATV-001 a ATV-013.
          Usa <em>Cargar Plan 2026</em> para crearlas con prerequisitos encadenados (nota mínima 70, Proyecto Final 80).
        </div>` : ''}

      <div class="card mb-4">
        <div class="card-header">
          <h3 class="card-title">Catálogo oficial — ${PLAN_ESTUDIOS_2026.titulo}</h3>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-compact">
              <thead>
                <tr><th>Código</th><th>Asignatura</th><th>En sistema</th></tr>
              </thead>
              <tbody>
                ${PLAN_ESTUDIOS_2026.cursos.map(cat => {
                  const found = courses.find(c => c.codigo === cat.codigo);
                  return `
                    <tr>
                      <td><code class="code-tag">${escapeHtml(cat.codigo)}</code></td>
                      <td>${escapeHtml(cat.nombre)}</td>
                      <td>${found
                        ? '<span class="badge badge-success">Registrado</span>'
                        : '<span class="badge badge-neutral">Pendiente</span>'}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Cursos en el sistema (${courses.length})</h3>
        </div>
        <div class="card-body p-0">
          ${courses.length === 0
            ? emptyHtml('No hay cursos registrados.', 'Agregar primer curso', 'empty-add')
            : `
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Prerequisito</th>
                    <th>Nota Mín.</th>
                    <th>Conceptos de Pago</th>
                    <th>Requisitos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${courses.map(c => {
                    const prereq = courses.find(x => x.id === c.prerequisitoId);
                    const req = c.requisitos || {};
                    const tags = [];
                    if (req.cursoPrevio)    tags.push('<span class="tag tag-forest">Previo</span>');
                    if (req.notaMinima)     tags.push('<span class="tag tag-amber">Nota</span>');
                    if (req.pagosCompletos) tags.push('<span class="tag tag-sage">Pagos</span>');
                    return `
                      <tr>
                        <td><span class="order-badge">${c.orden || '—'}</span></td>
                        <td><code class="code-tag">${escapeHtml(c.codigo)}</code></td>
                        <td>
                          <div class="cell-primary">${escapeHtml(c.nombre)}</div>
                          ${c.descripcion ? `<div class="cell-secondary">${escapeHtml(c.descripcion.slice(0, 60))}${c.descripcion.length > 60 ? '…' : ''}</div>` : ''}
                        </td>
                        <td>${prereq ? `<code class="code-tag">${escapeHtml(prereq.codigo)}</code>` : '<span class="text-muted">—</span>'}</td>
                        <td>${req.notaMinima ? `<strong>${c.notaMinima}</strong>` : '<span class="text-muted">—</span>'}</td>
                        <td>
                          ${(c.paymentItems || []).length === 0
                            ? '<span class="text-muted">Sin conceptos</span>'
                            : `<span class="tag">${(c.paymentItems || []).length} concepto(s)</span>`}
                        </td>
                        <td><div class="tag-row">${tags.join('') || '<span class="text-muted">Ninguno</span>'}</div></td>
                        <td>
                          <div class="action-btns">
                            <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="edit" data-id="${c.id}" title="Editar curso">
                              ${actionBtn('Editar', 'edit-2')}
                            </button>
                            <button type="button" class="btn btn-ghost btn-sm btn-action danger" data-action="delete" data-id="${c.id}" title="Eliminar curso">
                              ${actionBtn('Eliminar', 'trash-2')}
                            </button>
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
    attachListeners(container, courses);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar los cursos.');
  }
}

function attachListeners(container, courses) {
  container.querySelector('#btn-seed-plan')?.addEventListener('click', () => seedPlanFromUI(container));
  container.querySelector('#btn-add-course')?.addEventListener('click', () => openCourseModal(null, courses, container));
  container.querySelector('#empty-add')?.addEventListener('click', () => openCourseModal(null, courses, container));

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const course = courses.find(c => c.id === id);
    if (!course) return;

    if (action === 'edit') openCourseModal(course, courses, container);
    if (action === 'delete') {
      const ok = await showConfirm(
        `¿Eliminar el curso "${course.nombre}"? Se perderá la configuración pero las inscripciones existentes no se eliminarán.`,
        'Eliminar Curso'
      );
      if (ok) {
        try {
          await remove(COLLECTIONS.COURSES, id);
          showToast('Curso eliminado', 'success');
          await loadCourses(container);
        } catch {
          showToast('Error al eliminar el curso', 'error');
        }
      }
    }
  }, { capture: false });
}

async function seedPlanFromUI(container) {
  const ok = await showConfirm(
    'Se cargarán las 13 materias ATV-001 a ATV-013 del Plan de Estudios 2026 con prerequisitos encadenados. Los cursos existentes se actualizarán sin borrar conceptos de pago. ¿Continuar?',
    'Cargar Plan de Estudios 2026'
  );
  if (!ok) return;

  const btn = container.querySelector('#btn-seed-plan');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Cargando plan…';
  }

  try {
    const result = await seedPlanEstudios2026();
    showToast(
      `Plan cargado: ${result.coursesCreated} creado(s), ${result.coursesUpdated} actualizado(s)`,
      'success'
    );
    await loadCourses(container);
  } catch (err) {
    console.error(err);
    showToast(err?.message || 'Error al cargar el plan de estudios', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Cargar Plan 2026 (ATV-001..013)';
    }
  }
}

// ─── Payment items manager (within modal) ─────────────────────────────────────

function initPaymentItemsUI() {
  let items = [];

  const list    = document.getElementById('payment-items-list');
  const btnAdd  = document.getElementById('btn-add-payment-item');
  const hidden  = document.getElementById('payment-items-data');

  function render() {
    list.innerHTML = items.length === 0
      ? '<p class="text-muted text-sm">Sin conceptos de pago definidos.</p>'
      : items.map((item, i) => `
          <div class="payment-item-row" data-idx="${i}">
            <input type="text"   class="form-control" placeholder="Nombre del concepto" value="${escapeHtml(item.nombre)}" data-field="nombre">
            <input type="number" class="form-control" placeholder="Monto" value="${item.monto || ''}" data-field="monto" min="0" step="0.01">
            <button type="button" class="btn btn-ghost btn-icon danger btn-sm" data-remove="${i}" title="Quitar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>`).join('');

    hidden.value = JSON.stringify(items);

    // listeners
    list.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', e => {
        const row = e.target.closest('[data-idx]');
        const idx = Number(row.dataset.idx);
        const field = e.target.dataset.field;
        items[idx][field] = field === 'monto' ? Number(e.target.value) : e.target.value;
        hidden.value = JSON.stringify(items);
      });
    });

    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        items.splice(Number(btn.dataset.remove), 1);
        render();
      });
    });
  }

  btnAdd.addEventListener('click', () => {
    items.push({ id: `item_${Date.now()}`, nombre: '', monto: 0 });
    render();
  });

  return (initialItems) => {
    items = initialItems.map(i => ({ ...i }));
    render();
  };
}

function courseForm(course, allCourses) {
  const c = course || {};
  const req = c.requisitos || {};
  const otherCourses = allCourses.filter(x => x.id !== c.id);

  return `
    <form id="course-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">Código</label>
          <input type="text" name="codigo" class="form-control" value="${escapeHtml(c.codigo || '')}" placeholder="ATV-001" required>
        </div>
        <div class="form-group">
          <label class="form-label required">Orden (secuencia)</label>
          <input type="number" name="orden" class="form-control" value="${c.orden ?? ''}" min="1" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label required">Nombre del Curso</label>
        <input type="text" name="nombre" class="form-control" value="${escapeHtml(c.nombre || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea name="descripcion" class="form-control" rows="2">${escapeHtml(c.descripcion || '')}</textarea>
      </div>

      <div class="form-divider"><span>Requisitos para avanzar</span></div>

      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" name="req_cursoPrevio" value="true" ${req.cursoPrevio ? 'checked' : ''} id="req-cursoPrevio">
          <span>Requiere curso anterior aprobado (prerequisito)</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="req_notaMinima" value="true" ${req.notaMinima ? 'checked' : ''} id="req-notaMinima">
          <span>Requiere nota mínima</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="req_pagosCompletos" value="true" ${req.pagosCompletos ? 'checked' : ''} id="req-pagosCompletos">
          <span>Requiere todos los pagos completados</span>
        </label>
      </div>

      <div class="form-row req-fields">
        <div class="form-group" id="field-notaMinima" style="${req.notaMinima ? '' : 'display:none'}">
          <label class="form-label">Nota Mínima (0–100)</label>
          <input type="number" name="notaMinima" class="form-control" value="${c.notaMinima ?? 60}" min="0" max="100">
        </div>
        <div class="form-group" id="field-prerequisito" style="${req.cursoPrevio ? '' : 'display:none'}">
          <label class="form-label">Curso Prerrequisito</label>
          <select name="prerequisitoId" class="form-control">
            <option value="">— seleccionar —</option>
            ${otherCourses.map(x =>
              `<option value="${x.id}" ${c.prerequisitoId === x.id ? 'selected' : ''}>${escapeHtml(x.codigo)} – ${escapeHtml(x.nombre)}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="form-divider"><span>Conceptos de Pago</span></div>
      <div id="payment-items-list" class="payment-items-list"></div>
      <input type="hidden" id="payment-items-data" name="paymentItemsJson" value="[]">
      <button type="button" id="btn-add-payment-item" class="btn btn-outline btn-sm">
        <i data-lucide="plus"></i> Agregar concepto de pago
      </button>
    </form>`;
}

function openCourseModal(course, allCourses, container) {
  const isEdit = !!course;
  showModal({
    title: isEdit ? 'Editar Curso' : 'Agregar Curso',
    content: courseForm(course, allCourses),
    confirmLabel: isEdit ? 'Guardar cambios' : 'Agregar curso',
    size: 'lg',
    onConfirm: async (closeModal) => {
      const form = document.getElementById('course-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const fd = new FormData(form);
      const data = {
        codigo:        fd.get('codigo').trim(),
        nombre:        fd.get('nombre').trim(),
        descripcion:   fd.get('descripcion').trim(),
        orden:         Number(fd.get('orden')),
        notaMinima:    Number(fd.get('notaMinima') || 0),
        prerequisitoId: fd.get('prerequisitoId') || null,
        paymentItems:  JSON.parse(fd.get('paymentItemsJson') || '[]'),
        requisitos: {
          cursoPrevio:    fd.get('req_cursoPrevio') === 'true',
          notaMinima:     fd.get('req_notaMinima') === 'true',
          pagosCompletos: fd.get('req_pagosCompletos') === 'true',
        }
      };

      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Guardando…';

      try {
        if (isEdit) {
          await update(COLLECTIONS.COURSES, course.id, data);
          showToast('Curso actualizado', 'success');
        } else {
          await create(COLLECTIONS.COURSES, data);
          showToast('Curso creado', 'success');
        }
        closeModal();
        await loadCourses(container);
      } catch (err) {
        console.error(err);
        showToast('Error al guardar el curso', 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = isEdit ? 'Guardar cambios' : 'Agregar curso';
      }
    },
  });

  // Init payment items after modal is rendered
  requestAnimationFrame(() => {
    renderIcons();
    const load = initPaymentItemsUI();
    load(course?.paymentItems || []);

    // Toggle req fields
    document.getElementById('req-notaMinima')?.addEventListener('change', e => {
      document.getElementById('field-notaMinima').style.display = e.target.checked ? '' : 'none';
    });
    document.getElementById('req-cursoPrevio')?.addEventListener('change', e => {
      document.getElementById('field-prerequisito').style.display = e.target.checked ? '' : 'none';
    });
  });
}
