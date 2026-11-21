import { getAll, update, COLLECTIONS } from '../services/db.js';
import {
  calcEstadoNota,
  calcNotaFinal,
  ASISTENCIA_OPCIONES,
  formatFechaClase,
  collectFechasClase,
  estadoNotaClass,
  resolveEstadoFila,
  enrollmentBelongsToGroup,
  studentGroupId,
  resolveEnrollmentGroupId,
  isConvocatoriaDirecta,
} from '../logic/grades.js';
import {
  loadingHtml, errorHtml, emptyHtml, showToast,
  pageHeader, escapeHtml
} from '../ui.js';

function getCoursesForGroup(groupId, enrollments, studentMap, courseMap, cronogramaEntries) {
  const courseIds = new Set();

  enrollments.forEach(e => {
    const student = studentMap[e.studentId];
    if (enrollmentBelongsToGroup(e, student, groupId) && e.courseId) {
      courseIds.add(e.courseId);
    }
  });

  cronogramaEntries
    .filter(entry => entry.groupId === groupId && entry.courseId)
    .forEach(entry => courseIds.add(entry.courseId));

  return [...courseIds]
    .map(id => courseMap[id])
    .filter(Boolean)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

export async function render(container, params = []) {
  container.innerHTML = loadingHtml('Cargando notas...');
  await loadGradesView(container, params[0] || '', params[1] || '');
}

async function loadGradesView(container, selectedGroupId, selectedCourseId) {
  try {
    const [groups, students, courses, enrollments, cronogramaEntries] = await Promise.all([
      getAll(COLLECTIONS.GROUPS, 'numero'),
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
      getAll(COLLECTIONS.COURSES, 'orden'),
      getAll(COLLECTIONS.ENROLLMENTS),
      getAll(COLLECTIONS.CRONOGRAMA),
    ]);

    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));

    const groupEnrollments = selectedGroupId
      ? enrollments.filter(e => enrollmentBelongsToGroup(e, studentMap[e.studentId], selectedGroupId))
      : [];

    const coursesInGroup = selectedGroupId
      ? getCoursesForGroup(selectedGroupId, enrollments, studentMap, courseMap, cronogramaEntries)
      : [];

    if (selectedGroupId && !selectedCourseId && coursesInGroup.length) {
      selectedCourseId = coursesInGroup[0].id;
    }

    const selectedGroup = groupMap[selectedGroupId];
    const selectedCourse = courseMap[selectedCourseId];

    container.innerHTML = `
      ${pageHeader('Registro de Notas', 'Planilla por grupo — asistencia, calificaciones y estado')}

      <div class="card mb-4">
        <div class="card-body grades-filters">
          <div class="form-group">
            <label class="form-label required">Grupo</label>
            <select id="grade-group-sel" class="form-control form-control-lg">
              <option value="">— Seleccionar grupo —</option>
              ${groups.map(g => `
                <option value="${g.id}" ${g.id === selectedGroupId ? 'selected' : ''}>
                  ${escapeHtml(g.nombre || `Grupo ${g.numero}`)}${g.anio ? ` · ${g.anio}` : ''}
                </option>`).join('')}
            </select>
          </div>
          <div class="form-group ${selectedGroupId ? '' : 'grades-filter-locked'}">
            <label class="form-label">Materia</label>
            <select id="grade-course-sel" class="form-control form-control-lg" ${selectedGroupId ? '' : 'disabled'}>
              <option value="">— Seleccionar materia —</option>
              ${coursesInGroup.map(c => `
                <option value="${c.id}" ${c.id === selectedCourseId ? 'selected' : ''}>
                  ${escapeHtml(c.codigo)} – ${escapeHtml(c.nombre)}
                </option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div id="grades-panel">
        ${!selectedGroupId
          ? `<div class="empty-state"><div class="empty-icon">📋</div><p>Selecciona un <strong>grupo</strong> para desbloquear la planilla de estudiantes.</p></div>`
          : !selectedCourseId
            ? emptyHtml('Este grupo no tiene materias ni inscripciones. Asigna el cronograma, importa matrícula o inscribe estudiantes con grupo.')
            : renderGradesSheet({
                group: selectedGroup,
                course: selectedCourse,
                students,
                studentMap,
                courseMap,
                groupMap,
                enrollments,
                groupId: selectedGroupId,
                courseId: selectedCourseId,
              })}
      </div>`;

    attachListeners(container, {
      selectedGroupId,
      selectedCourseId,
      groups,
      students,
      courses,
      enrollments,
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar el módulo de notas.');
  }
}

function renderGradesSheet(ctx) {
  const {
    group, course, studentMap, courseMap, groupMap,
    enrollments, groupId, courseId,
  } = ctx;

  const normales = enrollments.filter(e =>
    enrollmentBelongsToGroup(e, studentMap[e.studentId], groupId) &&
    e.courseId === courseId &&
    e.tipoMatricula !== 'suficiencia'
  );

  const suficiencia = enrollments.filter(e =>
    e.courseId === courseId &&
    e.tipoMatricula === 'suficiencia'
  );

  const allRows = [...normales, ...suficiencia];
  const fechasClase = collectFechasClase(allRows);
  const convocatoriaRows = normales.filter(e =>
    isConvocatoriaDirecta(e, course)
  );

  const sampleEnrollment = normales[0] || suficiencia[0];
  const profesor = sampleEnrollment?.profesor || '—';
  const horario = sampleEnrollment?.horario || group?.horario || '—';
  const notaMin = course?.notaMinima ?? 70;

  return `
    <div class="grades-sheet-toolbar">
      <div class="grades-sheet-meta">
        <span class="badge badge-info">${escapeHtml(course.codigo)}</span>
        <strong>${escapeHtml(course.nombre)}</strong>
        <span class="text-muted text-sm">· Prof. ${escapeHtml(profesor)} · ${escapeHtml(horario)}</span>
        <span class="text-muted text-sm">· Nota mínima: ${notaMin}</span>
      </div>
      <div class="grades-sheet-actions">
        <button type="button" class="btn btn-outline btn-sm" id="btn-add-fecha-clase">+ Fecha de clase</button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-save-all-grades">Guardar planilla</button>
      </div>
    </div>

    ${convocatoriaRows.length ? `
      <div class="alert alert-warning mb-4 grades-convocatoria-banner">
        <strong>Convocatoria (${convocatoriaRows.length}):</strong>
        ${convocatoriaRows.map(e => {
          const st = studentMap[e.studentId] || {};
          return escapeHtml(`${st.nombre || ''} ${st.apellido || ''}`.trim());
        }).join(' · ')}
        <span class="text-sm"> — Nota ordinaria entre 60 y ${notaMin - 1}; deben presentar convocatoria.</span>
      </div>` : ''}

    <div class="card grades-sheet-card mb-4">
      <div class="card-header grades-sheet-header">
        <h3 class="card-title">Grupo ${escapeHtml(String(group?.numero || ''))} · ${normales.length} estudiante(s)</h3>
      </div>
      <div class="card-body p-0">
        ${normales.length === 0
          ? emptyHtml('No hay estudiantes inscritos en esta materia para este grupo.')
          : renderSheetTable(normales, studentMap, groupMap, course, fechasClase, false)}
      </div>
    </div>

    ${suficiencia.length ? `
      <div class="card grades-sheet-card grades-suficiencia-card">
        <div class="card-header grades-sheet-header suficiencia-head">
          <h3 class="card-title">SUFICIENCIA · ${suficiencia.length} estudiante(s)</h3>
        </div>
        <div class="card-body p-0">
          ${renderSheetTable(suficiencia, studentMap, groupMap, course, fechasClase, true)}
        </div>
      </div>` : ''}`;
}

function renderSheetTable(enrollmentRows, studentMap, groupMap, course, fechasClase, isSuficiencia) {
  const notaMin = course?.notaMinima ?? 70;
  const asistCount = fechasClase.length || 1;

  return `
    <div class="grades-sheet-wrap">
      <table class="grades-sheet-table">
        <colgroup>
          <col class="col-grupo">
          <col class="col-fecha">
          <col class="col-nombre">
          <col class="col-cedula">
          <col class="col-tel">
          <col class="col-email">
          ${fechasClase.map(() => '<col class="col-asist">').join('')}
          <col class="col-nota">
          <col class="col-nota">
          <col class="col-nota">
          <col class="col-estado">
        </colgroup>
        <thead>
          <tr class="grades-head-sections">
            <th colspan="4" class="gs-section gs-section-student">Datos del estudiante</th>
            <th colspan="2" class="gs-section gs-section-contact">Contacto</th>
            <th colspan="${asistCount}" class="gs-section gs-section-asist">Asistencia</th>
            <th colspan="4" class="gs-section gs-section-result">Calificación</th>
          </tr>
          <tr class="grades-head-info">
            <th class="gs-sticky gs-c-grupo">Grupo</th>
            <th class="gs-sticky gs-c-fecha">Fecha inicio</th>
            <th class="gs-sticky gs-c-nombre">Nombre</th>
            <th class="gs-sticky gs-c-cedula">Identificación</th>
            <th class="gs-c-tel">Teléfono</th>
            <th class="gs-c-email">Correo</th>
            ${fechasClase.length ? fechasClase.map(f => `
              <th class="gs-c-asist gs-asist-head" data-fecha="${escapeHtml(f)}" title="${escapeHtml(f)}">
                ${escapeHtml(formatFechaClase(f))}
              </th>`).join('') : `
              <th class="gs-c-asist gs-asist-head gs-asist-empty">Sin fechas</th>`}
            <th class="gs-c-nota">Nota ord.</th>
            <th class="gs-c-nota">Nota extra.</th>
            <th class="gs-c-nota">Nota final</th>
            <th class="gs-c-estado">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${enrollmentRows.map(e => renderSheetRow(e, studentMap, groupMap, course, fechasClase, isSuficiencia, notaMin)).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderSheetRow(enrollment, studentMap, groupMap, course, fechasClase, isSuficiencia, notaMin) {
  const student = studentMap[enrollment.studentId] || {};
  const group = groupMap[resolveEnrollmentGroupId(enrollment, student, '')] || {};
  const asistencia = enrollment.asistencia || {};
  const notaVal = enrollment.nota !== null && enrollment.nota !== undefined ? enrollment.nota : '';
  const extraVal = enrollment.notaExtraordinaria !== null && enrollment.notaExtraordinaria !== undefined
    ? enrollment.notaExtraordinaria : '';
  const finalVal = calcNotaFinal(notaVal, extraVal);
  const finalDisplay = finalVal !== null ? finalVal : '';
  const estado = resolveEstadoFila(student, enrollment, course);
  const estadoCls = estadoNotaClass(estado);
  const notaCls = notaVal !== '' && Number(notaVal) < notaMin ? 'nota-baja' : '';
  const convocatoria = isConvocatoriaDirecta(enrollment, course);

  return `
    <tr class="${isSuficiencia ? 'row-suficiencia' : ''} ${convocatoria ? 'row-convocatoria' : ''}" data-enrollment-id="${enrollment.id}">
      <td class="gs-sticky gs-c-grupo">${escapeHtml(String(group.numero || '—'))}</td>
      <td class="gs-sticky gs-c-fecha text-sm">${escapeHtml(student.fechaIngreso || '—')}</td>
      <td class="gs-sticky gs-c-nombre">
        <div class="cell-primary">${escapeHtml(student.nombre || '')} ${escapeHtml(student.apellido || '')}</div>
      </td>
      <td class="gs-sticky gs-c-cedula">${escapeHtml(student.documento || '—')}</td>
      <td class="gs-c-tel text-sm">${escapeHtml(student.telefono || '—')}</td>
      <td class="gs-c-email text-sm">${escapeHtml(student.email || '—')}</td>
      ${fechasClase.length ? fechasClase.map(fecha => {
        const val = asistencia[fecha] || '';
        const cellCls = val === 'A' ? 'asist-a'
          : val === 'CONGELADO' ? 'asist-congelado'
          : val === 'J' ? 'asist-j'
          : val === 'P' ? 'asist-p'
          : isSuficiencia && !val ? 'asist-suficiencia' : '';
        return `
          <td class="gs-c-asist ${cellCls}">
            <select class="asist-select" data-enrollment-id="${enrollment.id}" data-fecha="${escapeHtml(fecha)}">
              ${ASISTENCIA_OPCIONES.map(o => `
                <option value="${o.value}" ${val === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
              ${isSuficiencia && !ASISTENCIA_OPCIONES.some(o => o.value === val) && val === 'SUFICIENCIA'
                ? `<option value="SUFICIENCIA" selected>SUF</option>` : ''}
            </select>
          </td>`;
      }).join('') : `<td class="gs-c-asist gs-asist-empty-cell text-muted text-sm">—</td>`}
      <td class="gs-c-nota">
        <input type="number" class="form-control grade-input ${notaCls}"
          data-enrollment-id="${enrollment.id}"
          data-field="nota"
          data-nota-min="${notaMin}"
          value="${notaVal}"
          min="0" max="100" step="0.5" placeholder="—">
      </td>
      <td class="gs-c-nota">
        <input type="number" class="form-control grade-input grade-input-extra"
          data-enrollment-id="${enrollment.id}"
          data-field="notaExtraordinaria"
          value="${extraVal}"
          min="0" max="100" step="0.5" placeholder="—">
      </td>
      <td class="gs-c-nota">
        <span class="grade-final-display ${finalDisplay !== '' && finalDisplay < notaMin ? 'nota-baja' : ''}" data-final-for="${enrollment.id}">
          ${finalDisplay !== '' ? finalDisplay : '—'}
        </span>
      </td>
      <td class="gs-c-estado">
        <select class="estado-select ${estadoCls}" data-enrollment-id="${enrollment.id}" data-original-estado="${escapeHtml(estado)}">
          <option value="" ${!estado ? 'selected' : ''}>—</option>
          <option value="APROBADO" ${estado === 'APROBADO' ? 'selected' : ''}>APROBADO</option>
          <option value="CONVOCATORIA" ${estado === 'CONVOCATORIA' ? 'selected' : ''}>CONVOCATORIA</option>
          <option value="REPROBADO" ${estado === 'REPROBADO' ? 'selected' : ''}>REPROBADO</option>
          <option value="CONGELADO" ${estado === 'CONGELADO' ? 'selected' : ''}>CONGELADO</option>
        </select>
      </td>
    </tr>`;
}

function attachListeners(container, ctx) {
  container.querySelector('#grade-group-sel')?.addEventListener('change', e => {
    loadGradesView(container, e.target.value, '');
  });

  container.querySelector('#grade-course-sel')?.addEventListener('change', e => {
    loadGradesView(container, ctx.selectedGroupId, e.target.value);
  });

  container.querySelector('#btn-add-fecha-clase')?.addEventListener('click', () => {
    const input = prompt('Fecha de clase (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!input) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
      showToast('Usa formato AAAA-MM-DD', 'warning');
      return;
    }
    addFechaClase(container, ctx, input.trim());
  });

  container.addEventListener('input', e => {
    if (!e.target.classList.contains('grade-input')) return;
    const row = e.target.closest('tr');
    const ordInput = row?.querySelector('[data-field="nota"]');
    const extraInput = row?.querySelector('[data-field="notaExtraordinaria"]');
    const min = Number(ordInput?.dataset.notaMin) || 70;
    const final = calcNotaFinal(ordInput?.value, extraInput?.value);
    const finalEl = row?.querySelector('[data-final-for]');
    if (finalEl) {
      finalEl.textContent = final !== null ? final : '—';
      finalEl.classList.toggle('nota-baja', final !== null && final < min);
    }
    const estadoSel = row?.querySelector('.estado-select');
    const estado = calcEstadoNota(final, min);
    if (estadoSel && !estadoSel.dataset.manual) {
      estadoSel.value = estado;
      estadoSel.className = `estado-select ${estadoNotaClass(estado)}`;
    }
    if (ordInput) {
      ordInput.classList.toggle('nota-baja', ordInput.value !== '' && Number(ordInput.value) < min);
    }
    row?.classList.toggle('row-convocatoria', isConvocatoriaDirecta({
      nota: ordInput?.value,
      notaExtraordinaria: extraInput?.value,
      estadoNota: estadoSel?.value,
    }, { notaMinima: min }));
  });

  container.addEventListener('change', e => {
    if (e.target.classList.contains('estado-select')) {
      e.target.dataset.manual = '1';
      e.target.className = `estado-select ${estadoNotaClass(e.target.value)}`;
    }
  });

  container.querySelector('#btn-save-all-grades')?.addEventListener('click', () =>
    saveGradesSheet(container, ctx));
}

async function addFechaClase(container, ctx, fecha) {
  const { selectedGroupId, selectedCourseId, enrollments, students } = ctx;
  if (!selectedGroupId || !selectedCourseId) return;

  const studentMap = Object.fromEntries((students || []).map(s => [s.id, s]));
  const targets = enrollments.filter(e =>
    e.courseId === selectedCourseId &&
    (enrollmentBelongsToGroup(e, studentMap[e.studentId], selectedGroupId) ||
      e.tipoMatricula === 'suficiencia')
  );

  try {
    await Promise.all(targets.map(e => {
      const asistencia = { ...(e.asistencia || {}), [fecha]: e.asistencia?.[fecha] || '' };
      return update(COLLECTIONS.ENROLLMENTS, e.id, { asistencia });
    }));
    showToast('Columna de fecha agregada', 'success');
    await loadGradesView(container, selectedGroupId, selectedCourseId);
  } catch (err) {
    console.error(err);
    showToast('Error al agregar fecha', 'error');
  }
}

async function saveGradesSheet(container, ctx) {
  const { selectedGroupId, selectedCourseId } = ctx;
  const rows = container.querySelectorAll('tr[data-enrollment-id]');
  const updates = [];

  rows.forEach(row => {
    const id = row.dataset.enrollmentId;
    const notaInput = row.querySelector('[data-field="nota"]');
    const extraInput = row.querySelector('[data-field="notaExtraordinaria"]');
    const estadoSel = row.querySelector('.estado-select');
    const asistSelects = row.querySelectorAll('.asist-select');

    const asistencia = {};
    asistSelects.forEach(sel => {
      if (sel.dataset.fecha) asistencia[sel.dataset.fecha] = sel.value;
    });

    const notaRaw = notaInput?.value.trim() ?? '';
    const extraRaw = extraInput?.value.trim() ?? '';
    const nota = notaRaw === '' ? null : Number(notaRaw);
    const notaExtraordinaria = extraRaw === '' ? null : Number(extraRaw);
    const estadoNota = estadoSel?.value || '';

    updates.push({
      id,
      nota,
      notaExtraordinaria,
      asistencia,
      estadoNota,
      groupId: selectedGroupId,
    });
  });

  const btn = container.querySelector('#btn-save-all-grades');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
  }

  try {
    await Promise.all(updates.map(u => update(COLLECTIONS.ENROLLMENTS, u.id, {
      nota: u.nota,
      notaExtraordinaria: u.notaExtraordinaria,
      asistencia: u.asistencia,
      estadoNota: u.estadoNota,
      groupId: u.groupId,
    })));
    showToast(`${updates.length} registro(s) guardados`, 'success');
    await loadGradesView(container, selectedGroupId, selectedCourseId);
  } catch (err) {
    console.error(err);
    showToast('Error al guardar la planilla', 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar planilla';
    }
  }
}
