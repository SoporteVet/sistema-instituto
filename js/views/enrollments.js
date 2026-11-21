import { getAll, create, update, COLLECTIONS } from '../services/db.js';
import { canEnrollInCourse } from '../logic/progression.js';
import {
  loadingHtml, errorHtml, emptyHtml, statusBadge, showModal,
  showToast, pageHeader, escapeHtml, formatDate, formatCurrency, renderIcons, actionBtn
} from '../ui.js';
import { canManageEnrollmentRecords } from '../auth.js';

function studentGroupId(student) {
  return student?.grupoId || student?.groupId || '';
}
export async function render(container) {
  container.innerHTML = loadingHtml('Cargando inscripciones...');
  await loadEnrollments(container);
  return () => {
    if (container._onEnrollClick) {
      container.removeEventListener('click', container._onEnrollClick);
      container._onEnrollClick = null;
    }
  };
}

async function loadEnrollments(container) {
  try {
    const [students, courses, enrollments, groups] = await Promise.all([
      getAll(COLLECTIONS.STUDENTS, 'nombre'),
      getAll(COLLECTIONS.COURSES, 'orden'),
      getAll(COLLECTIONS.ENROLLMENTS),
      getAll(COLLECTIONS.GROUPS, 'numero'),
    ]);

    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
    const courseMap  = Object.fromEntries(courses.map(c => [c.id, c]));
    const groupMap   = Object.fromEntries(groups.map(g => [g.id, g]));
    const canManage  = canManageEnrollmentRecords();
    container.innerHTML = `
      ${pageHeader('Inscripciones & Pagos',
        `${enrollments.length} inscripción(es) registradas`,
        canManage ? `
          <button class="btn btn-primary" id="btn-enroll">
            <i data-lucide="file-plus"></i> Nueva Inscripción
          </button>` : '')}

      <div class="card">
        <div class="card-header">
          <div class="search-box">
            <i data-lucide="search"></i>
            <input type="text" id="enroll-search" class="search-input" placeholder="Buscar por estudiante o curso…">
          </div>
          <span class="text-muted text-sm">${enrollments.length} inscripción(es)</span>
        </div>
        <div class="card-body p-0">
          ${enrollments.length === 0
            ? emptyHtml('No hay inscripciones aún.', canManage ? 'Nueva inscripción' : null, 'empty-add')
            : `
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Grupo</th>
                    <th>Curso</th>                    <th>Inscripción</th>
                    <th>Nota</th>
                    <th>Pagos</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="enrollments-body">
                  ${enrollments.map(e => enrollmentRow(e, studentMap, courseMap, groupMap)).join('')}
                </tbody>
              </table>
            </div>`}
        </div>
      </div>`;

    renderIcons();
    attachListeners(container, students, courses, enrollments, groups, studentMap, courseMap, groupMap, canManage);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar las inscripciones.');
  }
}

function paymentProgress(enrollment, course) {
  const items = course?.paymentItems || [];
  if (items.length === 0) return '<span class="text-muted">Sin conceptos</span>';
  const pagos = enrollment.pagos || {};
  const paid = items.filter(i => pagos[i.id]?.pagado).length;
  const pct = Math.round((paid / items.length) * 100);
  return `
    <div class="payment-progress">
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <span class="text-sm ${paid === items.length ? 'text-success' : 'text-muted'}">${paid}/${items.length}</span>
    </div>`;
}

function enrollmentRow(e, studentMap, courseMap, groupMap) {
  const student = studentMap[e.studentId];
  const course  = courseMap[e.courseId];
  if (!student || !course) return '';

  const groupId = e.groupId || studentGroupId(student);
  const group = groupMap[groupId];
  const groupLabel = group
    ? (group.nombre || `Grupo ${group.numero}`)
    : '—';
  const notaDisplay = e.nota !== null && e.nota !== undefined ? e.nota : '—';
  const reqNota = course.requisitos?.notaMinima;
  const notaClass = reqNota && e.nota !== null && e.nota !== undefined
    ? (e.nota >= course.notaMinima ? 'text-success' : 'text-danger')
    : '';

  return `
    <tr data-enrollment-id="${e.id}">
      <td>
        <div class="cell-primary">${escapeHtml(student.nombre)} ${escapeHtml(student.apellido || '')}</div>
        <div class="cell-secondary">${escapeHtml(student.documento || '')}</div>
      </td>
      <td>
        <div class="cell-primary">${escapeHtml(groupLabel)}</div>
        ${group?.anio ? `<div class="cell-secondary">${group.anio}</div>` : ''}
      </td>
      <td>
        <div class="cell-primary">${escapeHtml(course.nombre)}</div>        <div class="cell-secondary"><code class="code-tag">${escapeHtml(course.codigo)}</code></div>
      </td>
      <td><span class="text-muted">${formatDate(e.creadoEn)}</span></td>
      <td><span class="${notaClass} font-medium">${notaDisplay}</span></td>
      <td>${paymentProgress(e, course)}</td>
      <td></td>
      <td>
        <div class="action-btns">
          <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="payments" data-id="${e.id}" title="Gestionar pagos">
            ${actionBtn('Pagos', 'credit-card')}
          </button>
        </div>
      </td>
    </tr>`;
}

function attachListeners(container, students, courses, enrollments, groups, studentMap, courseMap, groupMap, canManage) {
  if (canManage) {
    container.querySelector('#btn-enroll')?.addEventListener('click', () =>
      openEnrollModal(students, courses, enrollments, groups, container));
    container.querySelector('#empty-add')?.addEventListener('click', () =>
      openEnrollModal(students, courses, enrollments, groups, container));
  }
  let searchTimeout;
  container.querySelector('#enroll-search')?.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const term = e.target.value.toLowerCase();
      container.querySelectorAll('#enrollments-body tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    }, 200);
  });

  if (container._onEnrollClick) {
    container.removeEventListener('click', container._onEnrollClick);
  }
  container._onEnrollClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !container.contains(btn)) return;
    const { action, id } = btn.dataset;
    const enrollment = enrollments.find(en => en.id === id);
    if (!enrollment) return;
    if (action === 'payments') {
      openPaymentsModal(enrollment, courseMap[enrollment.courseId], studentMap[enrollment.studentId], container);
    }
  };
  container.addEventListener('click', container._onEnrollClick);
}

// ─── Nueva Inscripción — modal con buscador ───────────────────────────────────

function openEnrollModal(students, courses, enrollments, groups, container) {
  const activeStudents = students.filter(s => s.estado !== 'inactivo');

  if (groups.length === 0) {
    showToast('No hay grupos registrados. Pide al administrador que cree los grupos primero.', 'warning');
    return;
  }

  // Estado interno del modal
  let selectedStudent = null;
  let selectedGroupId = '';
  let selectedCourse  = null;

  const groupOptions = groups.map(g => `
    <option value="${g.id}">
      ${escapeHtml(g.nombre || `Grupo ${g.numero}`)}${g.anio ? ` · ${g.anio}` : ''}
    </option>`).join('');

  const content = `
    <div class="enroll-wizard">

      <!-- PASO 1: Buscar estudiante -->
      <div class="enroll-step" id="step-student">
        <p class="enroll-step-label"><span class="step-num">1</span> Buscar y seleccionar estudiante</p>
        <div class="search-box enroll-searchbox">
          <i data-lucide="search"></i>
          <input type="text" id="student-search-input" class="search-input"
            placeholder="Nombre, apellido o documento…" autocomplete="off">
        </div>
        <div id="student-results" class="enroll-results">
          ${studentCards(activeStudents, null)}
        </div>
      </div>

      <!-- PASO 2: Grupo -->
      <div class="enroll-step" id="step-group" style="display:none">
        <div class="enroll-selected-student" id="selected-student-banner"></div>
        <p class="enroll-step-label"><span class="step-num">2</span> Seleccionar grupo</p>
        <select id="enroll-group-sel" class="form-control form-control-lg">
          <option value="">— Seleccionar grupo —</option>
          ${groupOptions}
        </select>
        <p class="form-hint mt-2">El grupo vincula al estudiante con la planilla de notas y el cronograma.</p>
      </div>

      <!-- PASO 3: Elegir curso -->
      <div class="enroll-step" id="step-course" style="display:none">
        <p class="enroll-step-label"><span class="step-num">3</span> Seleccionar materia</p>
        <div id="course-results" class="enroll-results"></div>
        <div id="enroll-course-info" class="course-info-panel mt-2" style="display:none"></div>
      </div>

    </div>`;

  showModal({
    title: 'Nueva Inscripción',
    content,
    confirmLabel: 'Inscribir',
    size: 'lg',
    onConfirm: async (closeModal) => {
      if (!selectedStudent) { showToast('Selecciona un estudiante', 'warning'); return; }
      if (!selectedGroupId) { showToast('Selecciona un grupo', 'warning'); return; }
      if (!selectedCourse)  { showToast('Selecciona una materia', 'warning'); return; }

      const studentEnrollments = enrollments.filter(e => e.studentId === selectedStudent.id);
      const { canEnroll, reason } = canEnrollInCourse(selectedCourse.id, studentEnrollments, courses);
      if (!canEnroll) { showToast(reason || 'No puede inscribirse en esta materia', 'warning'); return; }

      const initialPagos = {};
      (selectedCourse.paymentItems || []).forEach(item => {
        initialPagos[item.id] = { pagado: false, fecha: null };
      });

      const btn = document.getElementById('modal-confirm-btn');
      btn.disabled = true;
      btn.textContent = 'Inscribiendo…';

      try {
        await create(COLLECTIONS.ENROLLMENTS, {
          studentId: selectedStudent.id,
          courseId:  selectedCourse.id,
          groupId:   selectedGroupId,
          nota: null,
          pagos: initialPagos,
        });

        if (studentGroupId(selectedStudent) !== selectedGroupId) {
          await update(COLLECTIONS.STUDENTS, selectedStudent.id, { grupoId: selectedGroupId });
        }

        showToast('Estudiante inscrito exitosamente', 'success');
        closeModal();
        await loadEnrollments(container);
      } catch (err) {
        console.error(err);
        showToast('Error al inscribir al estudiante', 'error');
        btn.disabled = false;
        btn.textContent = 'Inscribir';
      }
    },
  });

  requestAnimationFrame(() => {
    renderIcons();

    const searchInput = document.getElementById('student-search-input');
    const resultsEl   = document.getElementById('student-results');
    const stepGroup   = document.getElementById('step-group');
    const stepCourse  = document.getElementById('step-course');
    const groupSel    = document.getElementById('enroll-group-sel');

    function renderCourses() {
      if (!selectedStudent || !selectedGroupId) return;
      const studentEnrollments = enrollments.filter(en => en.studentId === selectedStudent.id);
      document.getElementById('course-results').innerHTML = courseCards(courses, studentEnrollments, selectedCourse?.id);
      document.getElementById('enroll-course-info').style.display = 'none';
      selectedCourse = null;
      renderIcons();
    }

    searchInput?.addEventListener('input', () => {
      const term = searchInput.value.toLowerCase().trim();
      const filtered = term
        ? activeStudents.filter(s =>
            `${s.nombre} ${s.apellido || ''} ${s.documento || ''} ${s.email || ''}`
              .toLowerCase().includes(term))
        : activeStudents;
      resultsEl.innerHTML = studentCards(filtered, selectedStudent?.id);
      renderIcons();
    });

    groupSel?.addEventListener('change', () => {
      selectedGroupId = groupSel.value;
      selectedCourse = null;
      if (selectedGroupId) {
        stepCourse.style.display = '';
        renderCourses();
      } else {
        stepCourse.style.display = 'none';
      }
    });

    document.getElementById('course-results')?.addEventListener('click', e => {
      const courseCard = e.target.closest('[data-course-id]');
      if (!courseCard || courseCard.dataset.locked === 'true') return;

      selectedCourse = courses.find(c => c.id === courseCard.dataset.courseId);

      document.querySelectorAll('.course-pick-card').forEach(c => c.classList.remove('selected'));
      courseCard.classList.add('selected');

      const infoEl = document.getElementById('enroll-course-info');
      const items  = selectedCourse.paymentItems || [];
      if (items.length > 0) {
        infoEl.innerHTML = `
          <p class="info-label"><i data-lucide="credit-card"></i> Conceptos de pago de esta materia:</p>
          <ul class="payment-preview-list">
            ${items.map(i => `<li>${escapeHtml(i.nombre)} — ${formatCurrency(i.monto)}</li>`).join('')}
          </ul>`;
        infoEl.style.display = '';
        renderIcons();
      } else {
        infoEl.style.display = 'none';
      }
    });

    resultsEl.addEventListener('click', e => {
      const card = e.target.closest('[data-student-id]');
      if (!card) return;

      selectedStudent = activeStudents.find(s => s.id === card.dataset.studentId);
      selectedCourse  = null;
      selectedGroupId = studentGroupId(selectedStudent) || '';

      resultsEl.querySelectorAll('.student-pick-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      stepGroup.style.display = '';
      stepCourse.style.display = selectedGroupId ? '' : 'none';

      document.getElementById('selected-student-banner').innerHTML = `
        <div class="selected-badge">
          <i data-lucide="user-check"></i>
          <strong>${escapeHtml(selectedStudent.nombre)} ${escapeHtml(selectedStudent.apellido || '')}</strong>
          <span class="text-muted">${selectedStudent.documento ? '· ' + escapeHtml(selectedStudent.documento) : ''}</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-change-student">Cambiar</button>
        </div>`;

      if (groupSel) {
        groupSel.value = selectedGroupId;
      }

      if (selectedGroupId) renderCourses();

      renderIcons();

      document.getElementById('btn-change-student')?.addEventListener('click', () => {
        selectedStudent = null;
        selectedCourse  = null;
        selectedGroupId = '';
        stepGroup.style.display = 'none';
        stepCourse.style.display = 'none';
        if (groupSel) groupSel.value = '';
        resultsEl.querySelectorAll('.student-pick-card').forEach(c => c.classList.remove('selected'));
        searchInput.focus();
      });
    });
  });
}
// ── Tarjetas de estudiante ───────────────────────────────────────────────────

function studentCards(students, selectedId) {
  if (students.length === 0) {
    return `<div class="enroll-empty">No se encontraron estudiantes</div>`;
  }
  return students.map(s => `
    <div class="student-pick-card ${s.id === selectedId ? 'selected' : ''}" data-student-id="${s.id}">
      <div class="spc-avatar">${(s.nombre[0] || '').toUpperCase()}${(s.apellido?.[0] || '').toUpperCase()}</div>
      <div class="spc-info">
        <div class="spc-name">${escapeHtml(s.nombre)} ${escapeHtml(s.apellido || '')}</div>
        <div class="spc-meta">
          ${s.documento ? `<span><i data-lucide="id-card"></i>${escapeHtml(s.documento)}</span>` : ''}
          ${s.email    ? `<span><i data-lucide="mail"></i>${escapeHtml(s.email)}</span>` : ''}
        </div>
      </div>
      <i data-lucide="chevron-right" class="spc-arrow"></i>
    </div>`).join('');
}

// ── Tarjetas de curso ────────────────────────────────────────────────────────

function courseCards(courses, studentEnrollments, selectedId) {
  if (courses.length === 0) {
    return `<div class="enroll-empty">No hay cursos registrados</div>`;
  }
  return courses.map(course => {
    const { canEnroll, reason } = canEnrollInCourse(course.id, studentEnrollments, courses);
    const alreadyEnrolled = studentEnrollments.some(e => e.courseId === course.id);
    const locked = !canEnroll;
    const items  = course.paymentItems || [];

    return `
      <div class="course-pick-card ${selectedId === course.id ? 'selected' : ''} ${locked ? 'locked' : ''}"
        data-course-id="${course.id}" data-locked="${locked}">
        <div class="cpc-left">
          <code class="code-tag">${escapeHtml(course.codigo)}</code>
          <div class="cpc-name">${escapeHtml(course.nombre)}</div>
          ${items.length > 0 ? `<div class="cpc-meta">${items.length} concepto(s) de pago</div>` : ''}
        </div>
        <div class="cpc-right">
          ${alreadyEnrolled
            ? `<span class="badge badge-info">Ya inscrito</span>`
            : locked
              ? `<span class="badge badge-danger"><i data-lucide="lock"></i> ${escapeHtml(reason || 'Bloqueado')}</span>`
              : `<span class="badge badge-success">Disponible</span>`}
        </div>
      </div>`;
  }).join('');
}

// ─── Checklist de pagos ───────────────────────────────────────────────────────

function openPaymentsModal(enrollment, course, student, container) {
  const items = course?.paymentItems || [];
  const pagos = { ...(enrollment.pagos || {}) };

  function buildContent() {
    if (items.length === 0) {
      return `
        <div class="student-banner">
          <strong>${escapeHtml(student?.nombre)} ${escapeHtml(student?.apellido || '')}</strong>
          <span class="text-muted"> — ${escapeHtml(course?.codigo)}: ${escapeHtml(course?.nombre)}</span>
        </div>
        <p class="text-muted">Este curso no tiene conceptos de pago configurados.</p>`;
    }
    return `
      <div class="student-banner">
        <strong>${escapeHtml(student?.nombre)} ${escapeHtml(student?.apellido || '')}</strong>
        <span class="text-muted"> — ${escapeHtml(course?.codigo)}: ${escapeHtml(course?.nombre)}</span>
      </div>
      <div class="payment-checklist">
        ${items.map(item => {
          const p = pagos[item.id] || {};
          return `
            <div class="payment-check-row ${p.pagado ? 'paid' : ''}" data-item-id="${item.id}">
              <label class="payment-check-label">
                <input type="checkbox" class="pay-check" data-item-id="${item.id}" ${p.pagado ? 'checked' : ''}>
                <span class="pay-name">${escapeHtml(item.nombre)}</span>
              </label>
              <span class="pay-amount">${formatCurrency(item.monto)}</span>
              <input type="date" class="form-control pay-date" data-item-id="${item.id}"
                value="${p.fecha || ''}" ${p.pagado ? '' : 'disabled'} style="width:150px">
            </div>`;
        }).join('')}
      </div>
      <div class="payment-summary">${buildSummary()}</div>`;
  }

  function buildSummary() {
    const total  = items.reduce((s, i) => s + (i.monto || 0), 0);
    const paid   = items.filter(i => pagos[i.id]?.pagado).reduce((s, i) => s + (i.monto || 0), 0);
    return `
      <div class="summary-row">
        <span>Total: <strong>${formatCurrency(total)}</strong></span>
        <span>Pagado: <strong class="text-success">${formatCurrency(paid)}</strong></span>
        <span>Pendiente: <strong class="text-danger">${formatCurrency(total - paid)}</strong></span>
      </div>`;
  }

  showModal({
    title: 'Checklist de Pagos',
    content: buildContent(),
    confirmLabel: items.length ? 'Guardar pagos' : 'Cerrar',
    size: 'md',
    onConfirm: async (close) => {
      if (items.length === 0) { close(); return; }
      const btn = document.getElementById('modal-confirm-btn');
      btn.disabled = true;
      btn.textContent = 'Guardando…';
      try {
        await update(COLLECTIONS.ENROLLMENTS, enrollment.id, { pagos });
        showToast('Pagos actualizados', 'success');
        close();
        await loadEnrollments(container);
      } catch (err) {
        console.error(err);
        showToast('Error al guardar los pagos', 'error');
        btn.disabled = false;
        btn.textContent = 'Guardar pagos';
      }
    },
  });

  requestAnimationFrame(() => {
    const today = new Date().toISOString().split('T')[0];

    document.querySelectorAll('.pay-check').forEach(chk => {
      chk.addEventListener('change', e => {
        const itemId = e.target.dataset.itemId;
        const dateInput = document.querySelector(`.pay-date[data-item-id="${itemId}"]`);
        const row = e.target.closest('.payment-check-row');
        if (e.target.checked) {
          pagos[itemId] = { pagado: true, fecha: dateInput.value || today };
          dateInput.value = pagos[itemId].fecha;
          dateInput.disabled = false;
          row.classList.add('paid');
        } else {
          pagos[itemId] = { pagado: false, fecha: null };
          dateInput.disabled = true;
          dateInput.value = '';
          row.classList.remove('paid');
        }
        document.querySelector('.payment-summary').innerHTML = buildSummary();
      });
    });

    document.querySelectorAll('.pay-date').forEach(input => {
      input.addEventListener('change', e => {
        const itemId = e.target.dataset.itemId;
        if (pagos[itemId]) pagos[itemId].fecha = e.target.value;
      });
    });
  });
}
