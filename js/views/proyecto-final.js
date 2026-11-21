import { getAll, getWhere, create, update, COLLECTIONS } from '../services/db.js';
import { canManageEnrollmentRecords } from '../auth.js';
import {
  loadingHtml, showModal, showToast, escapeHtml
} from '../ui.js';

function studentGroupId(s) {
  return s?.grupoId || s?.groupId || '';
}

/** Panel IV Cuatrimestre — Proyecto Final (horas + observaciones por estudiante). */
export async function renderProyectoFinalPanel(groupId, group, container) {
  const panel = document.getElementById('proyecto-final-panel');
  if (!panel) return;

  panel.innerHTML = loadingHtml('Cargando Proyecto Final...');

  try {
    const [students, enrollments, courses, registros] = await Promise.all([
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
      getAll(COLLECTIONS.ENROLLMENTS),
      getAll(COLLECTIONS.COURSES, 'orden'),
      getWhere(COLLECTIONS.PROYECTO_FINAL, 'groupId', '==', groupId),
    ]);

    const proyectoCourse = courses.find(c => c.codigo === 'ATV-013');
    const regMap = Object.fromEntries(registros.map(r => [r.studentId, r]));

    const groupStudents = students.filter(s => studentGroupId(s) === groupId);
    const enrolledIds = new Set(
      enrollments
        .filter(e =>
          e.groupId === groupId ||
          (proyectoCourse && e.courseId === proyectoCourse.id)
        )
        .map(e => e.studentId)
    );

    const list = groupStudents.length
      ? groupStudents
      : students.filter(s => enrolledIds.has(s.id));

    const canEdit = canManageEnrollmentRecords();

    panel.innerHTML = `
      <div class="card proyecto-final-card mt-4">
        <div class="card-header proyecto-final-head">
          <h3 class="card-title">IV Cuatrimestre — Proyecto Final (ATV-013)</h3>
          <span class="text-sm">${list.length} estudiante(s) · ${escapeHtml(group?.nombre || `Grupo ${group?.numero}`)}</span>
        </div>
        <div class="card-body p-0">
          ${list.length === 0
            ? `<p class="text-muted p-4">No hay estudiantes asignados a este grupo. Asigna grupo en Estudiantes o inscribe en ATV-013.</p>`
            : `
            <div class="table-responsive">
              <table class="table table-compact">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Cédula</th>
                    <th>Horas registradas</th>
                    <th>Último funcionario</th>
                    <th>Observaciones</th>
                    ${canEdit ? '<th></th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${list.map(s => {
                    const reg = regMap[s.id] || {};
                    const horas = (reg.registrosHoras || []).reduce((sum, h) => sum + (Number(h.horas) || 0), 0);
                    const ultimo = [...(reg.registrosHoras || [])].pop();
                    return `
                      <tr>
                        <td>${escapeHtml(s.nombre)} ${escapeHtml(s.apellido || '')}</td>
                        <td>${escapeHtml(s.documento || '—')}</td>
                        <td><strong>${horas}</strong> h</td>
                        <td class="text-sm">${escapeHtml(ultimo?.funcionario || '—')}</td>
                        <td class="text-sm">${escapeHtml((reg.observaciones || '').slice(0, 80))}${(reg.observaciones || '').length > 80 ? '…' : ''}</td>
                        ${canEdit ? `
                          <td>
                            <button type="button" class="btn btn-outline btn-sm" data-pf-student="${s.id}">
                              Gestionar
                            </button>
                          </td>` : ''}
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>`;

    if (canEdit) {
      panel.querySelectorAll('[data-pf-student]').forEach(btn => {
        btn.addEventListener('click', () => {
          const student = list.find(s => s.id === btn.dataset.pfStudent);
          openProyectoFinalModal(groupId, student, regMap[student.id], () =>
            renderProyectoFinalPanel(groupId, group, container));
        });
      });
    }
  } catch (err) {
    console.error(err);
    panel.innerHTML = `<p class="text-danger p-4">Error al cargar Proyecto Final.</p>`;
  }
}

function openProyectoFinalModal(groupId, student, reg, onSaved) {
  const registros = [...(reg?.registrosHoras || [])];

  showModal({
    title: 'Proyecto Final — seguimiento',
    content: `
      <div class="student-banner mb-3">
        <strong>${escapeHtml(student.nombre)} ${escapeHtml(student.apellido || '')}</strong>
        <span class="text-muted"> · ${escapeHtml(student.documento || '')}</span>
      </div>
      <form id="pf-form" class="form-grid">
        <div class="form-group">
          <label class="form-label">Observaciones generales</label>
          <textarea name="observaciones" class="form-control" rows="3">${escapeHtml(reg?.observaciones || '')}</textarea>
        </div>
      </form>
      <div class="form-divider"><span>Registro de horas</span></div>
      <div id="pf-horas-list"></div>
      <button type="button" class="btn btn-outline btn-sm mt-2" id="pf-add-hora">+ Agregar registro de horas</button>`,
    confirmLabel: 'Guardar',
    size: 'lg',
    onConfirm: async (close) => {
      const obs = document.querySelector('#pf-form textarea[name="observaciones"]')?.value?.trim() || '';
      const data = {
        groupId,
        studentId: student.id,
        observaciones: obs,
        registrosHoras: registros,
      };
      try {
        if (reg?.id) {
          await update(COLLECTIONS.PROYECTO_FINAL, reg.id, data);
        } else {
          await create(COLLECTIONS.PROYECTO_FINAL, data);
        }
        showToast('Registro guardado', 'success');
        close();
        onSaved?.();
      } catch (err) {
        console.error(err);
        showToast('Error al guardar', 'error');
      }
    },
  });

  requestAnimationFrame(() => {
    paintHoras();
    document.getElementById('pf-add-hora')?.addEventListener('click', () => {
      registros.push({ fechaInicio: '', fechaFin: '', horas: '', funcionario: '' });
      paintHoras();
    });
  });

  function paintHoras() {
    const list = document.getElementById('pf-horas-list');
    if (!list) return;
    list.innerHTML = registros.length === 0
      ? '<p class="text-muted text-sm">Sin horas registradas.</p>'
      : registros.map((h, i) => `
          <div class="pf-hora-row form-row" data-idx="${i}">
            <input type="date" class="form-control" data-field="fechaInicio" value="${escapeHtml(h.fechaInicio || '')}" title="Desde">
            <input type="date" class="form-control" data-field="fechaFin" value="${escapeHtml(h.fechaFin || '')}" title="Hasta">
            <input type="number" class="form-control" data-field="horas" value="${h.horas ?? ''}" min="0" step="0.5" placeholder="Horas">
            <input type="text" class="form-control" data-field="funcionario" value="${escapeHtml(h.funcionario || '')}" placeholder="Funcionario encargado">
            <button type="button" class="btn btn-ghost btn-sm danger" data-remove="${i}">×</button>
          </div>`).join('');

    list.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', e => {
        const row = e.target.closest('[data-idx]');
        const idx = Number(row.dataset.idx);
        registros[idx][e.target.dataset.field] = e.target.value;
      });
    });
    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        registros.splice(Number(btn.dataset.remove), 1);
        paintHoras();
      });
    });
  }
}
