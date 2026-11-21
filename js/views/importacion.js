import { parseImportFiles, TEMPLATE_CSV, TEMPLATE_ESTUDIANTES_CSV } from '../logic/import-parser.js';
import { runImport, DEFAULT_IMPORT_OPTIONS } from '../services/import-service.js';
import { isAdmin } from '../auth.js';
import {
  loadingHtml, errorHtml, showConfirm, showToast,
  pageHeader, escapeHtml, renderIcons
} from '../ui.js';

let state = {
  step: 1,
  files: [],
  parsed: null,
  options: { ...DEFAULT_IMPORT_OPTIONS },
  importStats: null,
};

function isPadronImport(parsed) {
  const fmt = parsed?.summary?.formatos;
  if (!fmt) return false;
  return fmt.estudiantes > 0 && fmt.matricula === 0;
}

function importFormatLabel(parsed) {
  const fmt = parsed?.summary?.formatos || {};
  if (fmt.estudiantes && fmt.matricula) return 'Padrón + matrícula';
  if (fmt.estudiantes) return 'Padrón de estudiantes';
  if (fmt.matricula) return 'Matrícula por grupo/materia';
  return 'Mixto';
}

function emptyState() {
  return {
    step: 1,
    files: [],
    parsed: null,
    options: { ...DEFAULT_IMPORT_OPTIONS },
    importStats: null,
  };
}

export async function render(container) {
  if (!isAdmin()) {
    container.innerHTML = errorHtml('Solo el administrador puede importar datos.');
    return;
  }
  state = emptyState();
  renderStep(container);
}

function renderStep(container) {
  const steps = [
    { n: 1, label: 'Archivos' },
    { n: 2, label: 'Opciones' },
    { n: 3, label: 'Vista previa' },
    { n: 4, label: 'Resultado' },
  ];

  container.innerHTML = `
    ${pageHeader('Importación de datos', 'Carga Excel/CSV: padrón de estudiantes o listas por grupo/materia', `
      <button type="button" class="btn btn-outline" id="btn-download-template-padron">
        <i data-lucide="download"></i> Plantilla padrón
      </button>
      <button type="button" class="btn btn-outline" id="btn-download-template-matricula">
        <i data-lucide="download"></i> Plantilla matrícula
      </button>`)}

    <div class="import-steps">
      ${steps.map(s => `
        <div class="import-step ${state.step === s.n ? 'active' : ''} ${state.step > s.n ? 'done' : ''}">
          <span class="import-step-num">${s.n}</span>
          <span>${s.label}</span>
        </div>`).join('')}
    </div>

    <div id="import-panel">${renderStepContent()}</div>`;

  renderIcons();
  attachStepListeners(container);
}

function renderStepContent() {
  switch (state.step) {
    case 1: return renderUploadStep();
    case 2: return renderOptionsStep();
    case 3: return renderPreviewStep();
    case 4: return renderResultStep();
    default: return '';
  }
}

function renderUploadStep() {
  return `
    <div class="card">
      <div class="card-body">
        <div class="import-dropzone" id="import-dropzone">
          <i data-lucide="upload-cloud"></i>
          <p><strong>Arrastra uno o varios archivos aquí</strong> o haz clic para seleccionar</p>
          <p class="text-muted text-sm">Formatos: .xlsx, .xls, .csv · Puedes subir todos tus archivos a la vez</p>
          <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" multiple hidden>
        </div>

        ${state.files.length ? `
          <div class="import-file-list mt-4">
            <div class="import-file-list-head">
              <strong>${state.files.length} archivo(s) seleccionado(s)</strong>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-clear-files">Quitar todos</button>
            </div>
            <ul class="import-files-ul">
              ${state.files.map((f, i) => `
                <li class="import-file-item">
                  <i data-lucide="file-spreadsheet"></i>
                  <span class="import-file-name">${escapeHtml(f.name)}</span>
                  <button type="button" class="btn btn-ghost btn-sm btn-icon danger" data-remove-file="${i}" title="Quitar">
                    <i data-lucide="x"></i>
                  </button>
                </li>`).join('')}
            </ul>
          </div>` : ''}

        <div class="import-help mt-4">
          <p class="text-sm text-muted"><strong>Formato 1 — Padrón de estudiantes</strong> (como tu Excel actual):</p>
          <code class="import-columns-hint">Grupo · identificacion · apellidos · nombre · nombrecompleto · nombrefacturacion · Email · email2 · teldom · telcel · teltrab · Fecha Ingres · Fecha Nacimient · edad · Estado</code>
          <p class="text-sm text-muted mt-3"><strong>Formato 2 — Matrícula por grupo/materia</strong> (listas ATV):</p>
          <code class="import-columns-hint">Grupo · Fecha de inicio · Nombre del estudiante · Identificación · Teléfono · Correo · Materia (ATV-XXX) · Profesor · Horario · Nota Final · Estado</code>
          <p class="text-sm text-muted mt-3"><strong>Tip:</strong> Puedes subir el padrón y luego los archivos por materia en la misma importación, o por separado.</p>
        </div>
        <div class="import-actions mt-4">
          <button type="button" class="btn btn-outline" id="btn-add-more-files" ${state.files.length ? '' : 'disabled'}>
            Agregar más archivos
          </button>
          <button type="button" class="btn btn-primary" id="btn-parse-file" ${state.files.length ? '' : 'disabled'}>
            Analizar ${state.files.length} archivo(s)
          </button>
        </div>
      </div>
    </div>`;
}

function renderOptionsStep() {
  const o = state.options;
  const s = state.parsed?.summary || {};
  const fileList = state.parsed?.files || state.files.map(f => ({ name: f.name }));
  const padronOnly = isPadronImport(state.parsed);
  const formatLabel = importFormatLabel(state.parsed);

  return `
    <div class="card mb-4">
      <div class="card-body">
        <p class="text-sm mb-2">
          <span class="badge badge-info">${escapeHtml(formatLabel)}</span>
        </p>
        <p class="text-sm text-muted mb-2">
          <strong>${fileList.length} archivo(s)</strong> ·
          ${s.filasValidas ?? 0} fila(s) válida(s) de ${s.totalFilas ?? 0} en total
          ${s.formatos?.estudiantes ? ` · ${s.formatos.estudiantes} estudiante(s)` : ''}
          ${s.formatos?.matricula ? ` · ${s.formatos.matricula} inscripción(es)` : ''}
        </p>
        <ul class="import-files-summary mb-4">
          ${fileList.map(f => `
            <li>${escapeHtml(f.name)}${f.format ? ` (${f.format})` : ''}${f.filasValidas != null ? ` — ${f.filasValidas}/${f.totalFilas} filas válidas` : ''}</li>`).join('')}
        </ul>
        <div class="checkbox-group">
          ${padronOnly ? '' : `
          <label class="checkbox-label">
            <input type="checkbox" id="opt-seed-catalog" ${o.seedCatalog ? 'checked' : ''}>
            <span>Crear/actualizar catálogo ATV-001..013 (Plan de Estudios 2026)</span>
          </label>`}
          <label class="checkbox-label">
            <input type="checkbox" id="opt-create-groups" ${o.createGroups ? 'checked' : ''}>
            <span>Crear/actualizar grupos según la columna <strong>Grupo</strong></span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="opt-update-students" ${o.updateStudents ? 'checked' : ''}>
            <span>Actualizar estudiantes existentes (misma cédula)</span>
          </label>
          ${padronOnly ? '' : `
          <label class="checkbox-label">
            <input type="checkbox" id="opt-update-enrollments" ${o.updateEnrollments ? 'checked' : ''}>
            <span>Actualizar inscripciones existentes (misma cédula + materia)</span>
          </label>`}
        </div>
        <div class="import-actions mt-4">
          <button type="button" class="btn btn-ghost" id="btn-back-step">Atrás</button>
          <button type="button" class="btn btn-primary" id="btn-to-preview">Ver vista previa</button>
        </div>
      </div>
    </div>`;
}

function renderPreviewStep() {
  const { rows = [], errors = [], summary = {}, files = [] } = state.parsed || {};
  const validRows = rows.filter(r => r.valid);
  const invalidRows = rows.filter(r => !r.valid);
  const padronOnly = isPadronImport(state.parsed);
  const formatLabel = importFormatLabel(state.parsed);

  const previewTable = padronOnly
    ? `
            <thead>
              <tr>
                <th>Archivo</th><th>Grupo</th><th>Estudiante</th><th>Cédula</th><th>Correo</th><th>Teléfono</th><th>Ingreso</th><th>Nacimiento</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${validRows.slice(0, 150).map(r => `
                <tr>
                  <td class="text-sm text-muted">${escapeHtml(r.sourceFile || '—')}</td>
                  <td>${r.grupoNumero ?? '—'}</td>
                  <td>${escapeHtml(r.nombreCompleto)}</td>
                  <td>${escapeHtml(r.documento)}</td>
                  <td class="text-sm">${escapeHtml(r.email || '—')}</td>
                  <td>${escapeHtml(r.telefono || '—')}</td>
                  <td>${escapeHtml(r.fechaIngreso || '—')}</td>
                  <td>${escapeHtml(r.fechaNacimiento || '—')}</td>
                  <td>${escapeHtml(r.estado || '—')}</td>
                </tr>`).join('')}
              ${validRows.length > 150 ? `<tr><td colspan="9" class="text-muted text-sm">… ${validRows.length - 150} filas más no mostradas</td></tr>` : ''}
            </tbody>`
    : `
            <thead>
              <tr>
                <th>Archivo</th><th>Grupo</th><th>Estudiante</th><th>Cédula</th><th>Materia</th><th>Nota</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${validRows.slice(0, 150).map(r => `
                <tr>
                  <td class="text-sm text-muted">${escapeHtml(r.sourceFile || '—')}</td>
                  <td>${r.grupoNumero ?? '—'}</td>
                  <td>${escapeHtml(r.nombreCompleto)}</td>
                  <td>${escapeHtml(r.documento)}</td>
                  <td><code class="code-tag">${escapeHtml(r.codigoCurso || '—')}</code></td>
                  <td>${r.nota != null ? r.nota : '—'}</td>
                  <td>${escapeHtml(r.estadoImport || r.estado || '—')}</td>
                </tr>`).join('')}
              ${validRows.length > 150 ? `<tr><td colspan="7" class="text-muted text-sm">… ${validRows.length - 150} filas más no mostradas</td></tr>` : ''}
            </tbody>`;

  return `
    <p class="text-sm mb-3"><span class="badge badge-info">${escapeHtml(formatLabel)}</span></p>
    <div class="stats-grid mb-4">
      <div class="stat-card"><div class="stat-body"><div class="stat-value">${files.length || state.files.length}</div><div class="stat-label">Archivos</div></div></div>
      <div class="stat-card"><div class="stat-body"><div class="stat-value">${summary.grupos ?? 0}</div><div class="stat-label">Grupos</div></div></div>
      <div class="stat-card"><div class="stat-body"><div class="stat-value">${summary.estudiantes ?? 0}</div><div class="stat-label">Estudiantes</div></div></div>
      ${padronOnly ? '' : `<div class="stat-card"><div class="stat-body"><div class="stat-value">${summary.inscripciones ?? 0}</div><div class="stat-label">Inscripciones</div></div></div>`}
      <div class="stat-card stat-warn"><div class="stat-body"><div class="stat-value">${summary.filasConError ?? 0}</div><div class="stat-label">Filas con error</div></div></div>
    </div>

    ${errors.length > 0 ? `
      <div class="alert alert-warning mb-4">
        <strong>${errors.length} advertencia(s):</strong>
        <ul class="import-error-list">${errors.slice(0, 10).map(e => `<li>${escapeHtml(e)}</li>`).join('')}
        ${errors.length > 10 ? `<li>… y ${errors.length - 10} más</li>` : ''}</ul>
      </div>` : ''}

    <div class="card mb-4">
      <div class="card-header">
        <h3 class="card-title">Vista previa combinada (${validRows.length} filas válidas)</h3>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive import-preview-table">
          <table class="table">
            ${previewTable}
          </table>
        </div>
        ${invalidRows.length ? `
          <div class="import-invalid-section">
            <p class="text-sm"><strong>Filas omitidas (${invalidRows.length}):</strong></p>
            <ul>${invalidRows.slice(0, 8).map(r => `<li>${escapeHtml(r.sourceFile)} fila ${r.lineNum}: ${escapeHtml(r.errors.join('; '))}</li>`).join('')}</ul>
          </div>` : ''}
      </div>
    </div>

    <div id="import-progress" class="import-progress hidden">
      <div class="progress-bar-wrap"><div class="progress-bar" id="import-progress-bar" style="width:0%"></div></div>
      <p id="import-progress-msg" class="text-sm text-muted mt-2">Preparando…</p>
    </div>

    <div class="import-actions">
      <button type="button" class="btn btn-ghost" id="btn-back-step">Atrás</button>
      <button type="button" class="btn btn-primary" id="btn-run-import" ${validRows.length ? '' : 'disabled'}>
        Confirmar e importar ${summary.estudiantes ?? validRows.length} estudiante(s)
        ${padronOnly ? '' : ` · ${summary.inscripciones ?? 0} inscripción(es)`}
      </button>
    </div>`;
}

function renderResultStep() {
  const s = state.importStats || {};
  const padronOnly = isPadronImport(state.parsed);
  return `
    <div class="card">
      <div class="card-body import-result">
        <div class="import-result-icon">✓</div>
        <h2>Importación completada</h2>
        <p class="text-muted text-sm mb-4">${state.files.length} archivo(s) procesados · ${escapeHtml(importFormatLabel(state.parsed))}</p>
        <ul class="import-result-stats">
          ${padronOnly ? '' : `<li>Cursos creados: <strong>${s.coursesCreated ?? 0}</strong> · actualizados: <strong>${s.coursesUpdated ?? 0}</strong></li>`}
          <li>Grupos creados: <strong>${s.groupsCreated ?? 0}</strong> · actualizados: <strong>${s.groupsUpdated ?? 0}</strong></li>
          <li>Estudiantes creados: <strong>${s.studentsCreated ?? 0}</strong> · actualizados: <strong>${s.studentsUpdated ?? 0}</strong></li>
          ${padronOnly ? '' : `<li>Inscripciones creadas: <strong>${s.enrollmentsCreated ?? 0}</strong> · actualizadas: <strong>${s.enrollmentsUpdated ?? 0}</strong></li>`}
        </ul>
        <div class="import-actions mt-4">
          <button type="button" class="btn btn-primary" id="btn-new-import">Nueva importación</button>
          <button type="button" class="btn btn-outline" onclick="window.location.hash='#/estudiantes'">Ver estudiantes</button>
        </div>
      </div>
    </div>`;
}

function addFiles(newFiles) {
  const existing = new Set(state.files.map(f => `${f.name}|${f.size}|${f.lastModified}`));
  for (const f of newFiles) {
    const key = `${f.name}|${f.size}|${f.lastModified}`;
    if (!existing.has(key)) {
      state.files.push(f);
      existing.add(key);
    }
  }
}

function attachStepListeners(container) {
  container.querySelector('#btn-download-template-padron')?.addEventListener('click', () => downloadTemplate('padron'));
  container.querySelector('#btn-download-template-matricula')?.addEventListener('click', () => downloadTemplate('matricula'));

  if (state.step === 1) {
    const dropzone = container.querySelector('#import-dropzone');
    const input = container.querySelector('#import-file-input');

    const openPicker = () => input?.click();

    dropzone?.addEventListener('click', openPicker);
    container.querySelector('#btn-add-more-files')?.addEventListener('click', openPicker);

    input?.addEventListener('change', e => {
      const picked = [...(e.target.files || [])];
      if (picked.length) {
        addFiles(picked);
        input.value = '';
        renderStep(container);
      }
    });

    dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const dropped = [...(e.dataTransfer.files || [])].filter(f =>
        /\.(xlsx|xls|csv)$/i.test(f.name));
      if (dropped.length) {
        addFiles(dropped);
        renderStep(container);
      } else {
        showToast('Solo se aceptan archivos .xlsx, .xls o .csv', 'warning');
      }
    });

    container.querySelector('#btn-clear-files')?.addEventListener('click', () => {
      state.files = [];
      renderStep(container);
    });

    container.querySelectorAll('[data-remove-file]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = Number(btn.dataset.removeFile);
        state.files.splice(idx, 1);
        renderStep(container);
      });
    });

    container.querySelector('#btn-parse-file')?.addEventListener('click', async () => {
      if (!state.files.length) return;
      const panel = container.querySelector('#import-panel');
      panel.innerHTML = loadingHtml(`Analizando ${state.files.length} archivo(s)…`);
      try {
        state.parsed = await parseImportFiles(state.files);
        if (!state.parsed.rows?.length && state.parsed.errors?.length) {
          showToast(state.parsed.errors[0], 'error');
          state.step = 1;
        } else if (!state.parsed.summary?.filasValidas) {
          showToast('Ninguna fila válida encontrada. Revisa columnas o nombres de archivo.', 'warning');
          state.step = 2;
        } else {
          state.step = 2;
        }
        renderStep(container);
      } catch (err) {
        console.error(err);
        showToast('Error al leer los archivos', 'error');
        renderStep(container);
      }
    });
  }

  if (state.step === 2) {
    container.querySelector('#btn-back-step')?.addEventListener('click', () => {
      state.step = 1;
      renderStep(container);
    });
    container.querySelector('#btn-to-preview')?.addEventListener('click', () => {
      const padronOnly = isPadronImport(state.parsed);
      state.options = {
        seedCatalog: padronOnly ? false : (container.querySelector('#opt-seed-catalog')?.checked ?? true),
        createGroups: container.querySelector('#opt-create-groups')?.checked ?? true,
        updateStudents: container.querySelector('#opt-update-students')?.checked ?? true,
        updateEnrollments: padronOnly ? false : (container.querySelector('#opt-update-enrollments')?.checked ?? true),
      };
      state.step = 3;
      renderStep(container);
    });
  }

  if (state.step === 3) {
    container.querySelector('#btn-back-step')?.addEventListener('click', () => {
      state.step = 2;
      renderStep(container);
    });
    container.querySelector('#btn-run-import')?.addEventListener('click', () => runImportFlow(container));
  }

  if (state.step === 4) {
    container.querySelector('#btn-new-import')?.addEventListener('click', () => {
      state = emptyState();
      renderStep(container);
    });
  }
}

async function runImportFlow(container) {
  const validRows = state.parsed?.rows?.filter(r => r.valid) || [];
  if (!validRows.length) return;

  const summary = state.parsed?.summary || {};
  const padronOnly = isPadronImport(state.parsed);
  const detail = padronOnly
    ? `Se importarán ${summary.estudiantes ?? validRows.length} estudiante(s) del padrón${summary.grupos ? ` en ${summary.grupos} grupo(s)` : ''}.`
    : `Se importarán ${summary.estudiantes ?? 0} estudiante(s) y ${summary.inscripciones ?? 0} inscripción(es) de ${state.files.length} archivo(s).${state.options.seedCatalog ? ' Incluye catálogo ATV-001..013.' : ''}`;

  const ok = await showConfirm(`${detail} ¿Continuar?`, 'Confirmar importación');
  if (!ok) return;

  const progressEl = container.querySelector('#import-progress');
  const barEl = container.querySelector('#import-progress-bar');
  const msgEl = container.querySelector('#import-progress-msg');
  const btn = container.querySelector('#btn-run-import');

  progressEl?.classList.remove('hidden');
  if (barEl) barEl.style.width = '3%';
  if (msgEl) msgEl.textContent = 'Iniciando importación…';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Importando…';
  }

  showToast('Importación en curso. Puede tardar unos segundos según la cantidad de registros.', 'info');

  try {
    state.importStats = await runImport(validRows, state.options, (msg, pct) => {
      if (barEl) barEl.style.width = `${Math.max(pct, 3)}%`;
      if (msgEl) msgEl.textContent = msg;
    });
    showToast('Importación completada', 'success');
    state.step = 4;
    renderStep(container);
  } catch (err) {
    console.error(err);
    const msg = err?.code === 'permission-denied'
      ? 'Sin permiso en Firestore. Verifica que tu usuario sea admin.'
      : (err?.message || 'Error durante la importación');
    showToast(msg, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = `Confirmar e importar ${summary.estudiantes ?? validRows.length} estudiante(s)`;
    }
    progressEl?.classList.add('hidden');
  }
}

function downloadTemplate(kind = 'matricula') {
  const isPadron = kind === 'padron';
  const content = isPadron ? TEMPLATE_ESTUDIANTES_CSV : TEMPLATE_CSV;
  const filename = isPadron ? 'plantilla-padron-estudiantes.csv' : 'plantilla-matricula-grupo.csv';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Plantilla descargada', 'success');
}
