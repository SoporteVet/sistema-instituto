import {
  createSystemUser, updateSystemUser, deleteSystemUser, getUserApiError
} from '../services/users-api.js';
import { getAll, COLLECTIONS } from '../services/db.js';
import {
  loadingHtml, errorHtml, emptyHtml, statusBadge, showModal,
  showConfirm, showToast, pageHeader, escapeHtml, renderIcons, formatDate, actionBtn
} from '../ui.js';
import { getCurrentUser } from '../auth.js';
import { ROLE_LIST, ROLE_LABELS } from '../logic/permissions.js';

export async function render(container) {
  container.innerHTML = loadingHtml('Cargando usuarios...');
  await loadUsers(container);
}

async function loadUsers(container) {
  try {
    const users = await getAll(COLLECTIONS.USERS);

    container.innerHTML = `
      ${pageHeader('Gestión de Usuarios',
        'Crea cuentas con correo, contraseña y rol desde el sistema',
        `<button class="btn btn-primary" id="btn-add-user">
          <i data-lucide="user-plus"></i> Agregar Usuario
        </button>`)}

      <div class="card">
        <div class="card-body p-0">
          ${users.length === 0
            ? emptyHtml('No hay usuarios registrados.', 'Agregar primero', 'empty-add')
            : `
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Registrado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.map(u => {
                    const isMe = u.id === getCurrentUser()?.uid;
                    return `
                      <tr ${isMe ? 'class="row-highlight"' : ''}>
                        <td>
                          <div class="cell-primary">
                            ${escapeHtml(u.nombre || '—')}
                            ${isMe ? '<span class="tag tag-sage ml-2">Yo</span>' : ''}
                          </div>
                        </td>
                        <td>${escapeHtml(u.email || '—')}</td>
                        <td>${statusBadge(u.rol || 'desconocido')}</td>
                        <td>${statusBadge(u.activo !== false ? 'activo' : 'inactivo')}</td>
                        <td><span class="text-muted">${formatDate(u.creadoEn)}</span></td>
                        <td>
                          <div class="action-btns">
                            <button type="button" class="btn btn-ghost btn-sm btn-action" data-action="edit" data-id="${u.id}" title="Editar" ${isMe ? 'disabled' : ''}>
                              ${actionBtn('Editar', 'edit-2')}
                            </button>
                            <button type="button" class="btn btn-ghost btn-sm btn-action danger" data-action="delete" data-id="${u.id}" title="Eliminar" ${isMe ? 'disabled' : ''}>
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
    attachListeners(container, users);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorHtml('Error al cargar los usuarios.');
  }
}

function attachListeners(container, users) {
  container.querySelector('#btn-add-user')?.addEventListener('click', () => openUserModal(null, container));
  container.querySelector('#empty-add')?.addEventListener('click', () => openUserModal(null, container));

  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const { action, id } = btn.dataset;
    const user = users.find(u => u.id === id);
    if (!user) return;

    if (action === 'edit') openUserModal(user, container);
    if (action === 'delete') {
      const ok = await showConfirm(
        `¿Eliminar el acceso de ${user.nombre || user.email}? Se eliminará la cuenta y ya no podrá entrar al sistema.`,
        'Eliminar Usuario'
      );
      if (ok) {
        try {
          await deleteSystemUser(id);
          showToast('Usuario eliminado', 'success');
          await loadUsers(container);
        } catch (err) {
          console.error(err);
          showToast(getUserApiError(err), 'error');
        }
      }
    }
  }, { capture: false });
}

function userForm(user = null) {
  const u = user || {};
  const isEdit = !!user;
  return `
    <form id="user-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">Nombre completo</label>
          <input type="text" name="nombre" class="form-control" value="${escapeHtml(u.nombre || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label required">Email</label>
          <input type="email" name="email" class="form-control" value="${escapeHtml(u.email || '')}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label ${isEdit ? '' : 'required'}">${isEdit ? 'Nueva contraseña' : 'Contraseña'}</label>
          <input type="password" name="password" class="form-control" minlength="6"
            autocomplete="${isEdit ? 'new-password' : 'new-password'}"
            placeholder="${isEdit ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}"
            ${isEdit ? '' : 'required'}>
        </div>
        <div class="form-group">
          <label class="form-label required">Rol</label>
          <select name="rol" class="form-control" required>
            ${ROLE_LIST.map(r => `
              <option value="${r}" ${u.rol === r ? 'selected' : ''}>${escapeHtml(ROLE_LABELS[r])}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select name="activo" class="form-control">
          <option value="true"  ${u.activo !== false ? 'selected' : ''}>Activo</option>
          <option value="false" ${u.activo === false  ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>
    </form>`;
}

function openUserModal(user, container) {
  const isEdit = !!user;
  showModal({
    title: isEdit ? 'Editar Usuario' : 'Agregar Usuario',
    content: userForm(user),
    confirmLabel: isEdit ? 'Guardar cambios' : 'Crear usuario',
    size: 'md',
    onConfirm: async (close) => {
      const form = document.getElementById('user-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const fd = new FormData(form);
      const payload = {
        nombre: fd.get('nombre').trim(),
        email: fd.get('email').trim(),
        rol: fd.get('rol'),
        activo: fd.get('activo') === 'true',
      };
      const password = fd.get('password')?.trim();

      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Guardando…';

      try {
        if (isEdit) {
          await updateSystemUser({
            uid: user.id,
            ...payload,
            ...(password ? { password } : {}),
          });
          showToast('Usuario actualizado', 'success');
        } else {
          await createSystemUser({ ...payload, password });
          showToast('Usuario creado correctamente', 'success');
        }
        close();
        await loadUsers(container);
      } catch (err) {
        console.error(err);
        showToast(getUserApiError(err), 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear usuario';
      }
    },
  });
  requestAnimationFrame(() => renderIcons());
}
