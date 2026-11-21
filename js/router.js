import { render as renderDashboard }   from './views/dashboard.js';
import { render as renderStudents }    from './views/students.js';
import { render as renderCourses }     from './views/courses.js';
import { render as renderEnrollments } from './views/enrollments.js';
import { render as renderGrades }      from './views/grades.js';
import { render as renderUsers }       from './views/users.js';
import { render as renderGroups }      from './views/groups.js';
import { render as renderCronograma }  from './views/cronograma.js';
import { render as renderImportacion } from './views/importacion.js';
import { render as renderAgendamiento } from './views/agendamiento.js';
import { render as renderPracticas } from './views/practicas.js';
import { getCurrentRole, isAuthenticated } from './auth.js';
import { canAccess }                  from './logic/permissions.js';
export { navigateTo }                  from './nav.js';

const ROUTES = {
  dashboard:     { render: renderDashboard,   label: 'Dashboard' },
  grupos:        { render: renderGroups,      label: 'Grupos' },
  cronograma:    { render: renderCronograma,  label: 'Cronograma' },
  estudiantes:   { render: renderStudents,    label: 'Estudiantes' },
  cursos:        { render: renderCourses,     label: 'Cursos' },
  inscripciones: { render: renderEnrollments, label: 'Inscripciones & Pagos' },
  notas:         { render: renderGrades,      label: 'Notas' },
  agendamiento:  { render: renderAgendamiento, label: 'Agendamiento' },
  practicas:     { render: renderPracticas,    label: 'Horas de práctica' },
  usuarios:      { render: renderUsers,       label: 'Usuarios' },
  importacion:   { render: renderImportacion, label: 'Importación' },
};

let currentCleanup = null;

function parseHash(hash) {
  const raw = hash.replace(/^#\/?/, '') || 'dashboard';
  const [key, ...params] = raw.split('/');
  return { key, params };
}

async function navigate(hash) {
  if (!isAuthenticated()) return;

  const { key, params } = parseHash(hash);
  const route = ROUTES[key];
  const main = document.getElementById('main-content');
  if (!main) return;

  // Cleanup previous view
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === key);
  });

  // Update topbar title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = route?.label || '';

  if (!route) {
    main.innerHTML = `
      <div class="empty-state mt-8">
        <div class="empty-icon">🔍</div>
        <p>Página no encontrada.</p>
        <button class="btn btn-primary mt-4" onclick="window.location.hash='#/dashboard'">Ir al Dashboard</button>
      </div>`;
    return;
  }

  if (!canAccess(key, getCurrentRole())) {
    main.innerHTML = `
      <div class="empty-state mt-8">
        <div class="empty-icon">🔒</div>
        <p>No tienes permisos para ver esta sección.</p>
      </div>`;
    return;
  }

  try {
    const cleanup = await route.render(main, params);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  } catch (err) {
    console.error('Router render error:', err);
    main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error al cargar la página. Intenta de nuevo.</p></div>`;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', () => navigate(window.location.hash));
  navigate(window.location.hash);
}
