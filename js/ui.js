// ─── HTML helpers ────────────────────────────────────────────────────────────

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(date) {
  if (!date) return '—';
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount));
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

const INLINE_ICONS = {
  'bar-chart-2': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  'edit-2': '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'calendar-days': '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  'file-plus': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
  'dollar-sign': '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
};

/** SVG inline (no depende del CDN de Lucide). */
export function iconSvg(name, size = 16) {
  const body = INLINE_ICONS[name];
  if (!body) return '';
  return `<svg class="icon-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Botón de acción con ícono + texto visible. */
export function actionBtn(label, iconName, extraClass = '') {
  return `${iconSvg(iconName, 14)}<span>${escapeHtml(label)}</span>`;
}

// ─── Status badges ────────────────────────────────────────────────────────────

const STATUS_MAP = {
  aprobado:   { cls: 'badge-success',   label: 'Aprobado' },
  en_curso:   { cls: 'badge-info',      label: 'En Curso' },
  disponible: { cls: 'badge-warning',   label: 'Disponible' },
  bloqueado:  { cls: 'badge-danger',    label: 'Bloqueado' },
  activo:     { cls: 'badge-success',   label: 'Activo' },
  inactivo:   { cls: 'badge-neutral',   label: 'Inactivo' },
  graduado:   { cls: 'badge-info',      label: 'Graduado' },
  congelado:  { cls: 'badge-info',      label: 'Congelado' },
  admin:            { cls: 'badge-forest',  label: 'Administrador' },
  vida_estudiantil: { cls: 'badge-forest',  label: 'Vida Estudiantil' },
  matriculas:       { cls: 'badge-info',    label: 'Matrículas' },
  coordinacion:     { cls: 'badge-warning', label: 'Coordinación' },
  director:         { cls: 'badge-forest',  label: 'Director Académico' },
  profesor:         { cls: 'badge-info',    label: 'Profesor' },
  estudiante:       { cls: 'badge-info',    label: 'Estudiante' },
  pagado:           { cls: 'badge-success', label: 'Pagado' },
  pendiente:        { cls: 'badge-warning', label: 'Pendiente' },
  parcial:          { cls: 'badge-info',    label: 'Parcial' },
  mora:             { cls: 'badge-danger',  label: 'Mora' },
  sin_conceptos:    { cls: 'badge-neutral', label: 'Sin conceptos' },
  abierto:          { cls: 'badge-warning', label: 'Adentro' },
  cerrado:          { cls: 'badge-success', label: 'Cerrado' },
};

export function statusBadge(status) {
  const s = STATUS_MAP[status] || { cls: 'badge-neutral', label: escapeHtml(status) };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

// ─── Loading / empty states ───────────────────────────────────────────────────

export function loadingHtml(msg = 'Cargando...') {
  return `<div class="loading-state"><div class="spinner"></div><p>${escapeHtml(msg)}</p></div>`;
}

export function emptyHtml(msg, btnLabel = null, btnId = null) {
  return `
    <div class="empty-state">
      <div class="empty-icon">🐾</div>
      <p>${escapeHtml(msg)}</p>
      ${btnLabel ? `<button class="btn btn-primary" id="${btnId || 'empty-action'}">${escapeHtml(btnLabel)}</button>` : ''}
    </div>`;
}

export function errorHtml(msg) {
  return `<div class="empty-state error-state"><div class="empty-icon">⚠️</div><p>${escapeHtml(msg)}</p></div>`;
}

// ─── Toast notifications ──────────────────────────────────────────────────────

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Cerrar">×</button>`;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => dismissToast(toast), 4500);
}

function dismissToast(toast) {
  toast.classList.remove('toast-show');
  setTimeout(() => toast.remove(), 300);
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function showModal({
  title,
  content,
  onConfirm = null,
  onCancel = null,
  confirmLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  size = 'md',
  hideFooter = false,
  dangerConfirm = false,
}) {
  const overlay = document.getElementById('modal-overlay');
  const modalEl = document.getElementById('modal');

  modalEl.className = `modal modal-${size}`;
  modalEl.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${escapeHtml(title)}</h3>
      <button class="modal-close" id="modal-close-btn" aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">${content}</div>
    ${!hideFooter ? `
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" id="modal-cancel-btn">${escapeHtml(cancelLabel)}</button>
      <button type="button" class="btn ${dangerConfirm ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${escapeHtml(confirmLabel)}</button>
    </div>` : ''}`;

  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('active'));

  const onOverlayClick = (e) => {
    if (e.target === overlay) cancelModal();
  };

  const closeModal = () => {
    overlay.classList.remove('active');
    overlay.classList.add('hidden');
    overlay.removeEventListener('click', onOverlayClick);
  };

  const cancelModal = () => {
    closeModal();
    if (onCancel) onCancel();
  };

  document.getElementById('modal-close-btn').addEventListener('click', cancelModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', cancelModal);

  const confirmBtn = document.getElementById('modal-confirm-btn');
  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', () => onConfirm(closeModal));
  }

  overlay.addEventListener('click', onOverlayClick);

  return closeModal;
}

export function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.classList.add('hidden'), 220);
}

export function showConfirm(message, title = 'Confirmar acción') {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    showModal({
      title,
      content: `<p class="confirm-msg">${escapeHtml(message)}</p>`,
      onConfirm: (closeModal) => {
        finish(true);
        closeModal();
      },
      onCancel: () => finish(false),
      confirmLabel: 'Sí, continuar',
      cancelLabel: 'Cancelar',
      dangerConfirm: true,
    });
  });
}

// ─── Page header helper ───────────────────────────────────────────────────────

export function pageHeader(title, subtitle = '', actions = '') {
  return `
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
}

// ─── Re-render Lucide icons ───────────────────────────────────────────────────

export function renderIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// ─── Stat card helper ─────────────────────────────────────────────────────────

export function statCard(label, value, icon, colorClass = '') {
  return `
    <div class="stat-card ${colorClass}">
      <div class="stat-icon">${iconSvg(icon, 22)}</div>
      <div class="stat-body">
        <div class="stat-value">${escapeHtml(String(value))}</div>
        <div class="stat-label">${escapeHtml(label)}</div>
      </div>
    </div>`;
}
