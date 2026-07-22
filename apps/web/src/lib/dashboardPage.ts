import { iconButtonHtml } from './icons';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  requireSession,
  type ProjectSummary
} from './projectApi';
import { supabase } from './supabase';
import { DEFAULT_PROJECT_SPECS, normalizeProjectStatus } from '@nodouno/shared';

export async function initDashboardPage() {
  const sessionLabel = document.querySelector<HTMLElement>('#session-label');
  const logoutBtn = document.querySelector<HTMLElement>('#logout-btn');
  const newProjectForm = document.querySelector<HTMLFormElement>('#new-project-form');
  const projectNameInput = document.querySelector<HTMLInputElement>('#project-name-input');
  const projectConcreteSelect = document.querySelector<HTMLSelectElement>('#project-concrete-select');
  const resetProjectFormBtn = document.querySelector<HTMLButtonElement>('#reset-project-form-btn');
  const projectFormStatus = document.querySelector<HTMLElement>('#project-form-status');
  const projectsList = document.querySelector<HTMLElement>('#projects-list');

  let lastProjects: ProjectSummary[] = [];
  let pendingDeleteId: string | null = null;

  const projectCardClass =
    'panel p-21 text-left transition-colors hover:border-line-strong';

  const setProjectsMessage = (message: string) => {
    if (projectsList) {
      projectsList.innerHTML = `<p class="text-slate-mist">${message}</p>`;
    }
  };

  const setFormStatus = (message: string, isError = false) => {
    if (!projectFormStatus) return;
    projectFormStatus.textContent = message;
    projectFormStatus.classList.toggle('text-desert-sienna', isError);
    projectFormStatus.classList.toggle('text-slate-mist', !isError);
  };

  const storeActiveProject = (project: { id: string; name?: string; status?: string }) => {
    localStorage.setItem('active-project-id', project.id);
    localStorage.setItem('active-project-name', project.name || 'Proyecto sin titulo');
    localStorage.setItem('active-project-status', normalizeProjectStatus(project.status ?? 'draft'));
  };

  const renderProjects = (projects: ProjectSummary[]) => {
    if (!projectsList) return;
    if (projects.length === 0) {
      pendingDeleteId = null;
      setProjectsMessage('Aun no tienes proyectos creados.');
      return;
    }

    projectsList.innerHTML = '';
    for (const project of projects) {
      const card = document.createElement('article');
      card.className = projectCardClass;
      const title = project.name || 'Proyecto sin titulo';
      const statusLabel = normalizeProjectStatus(project.status ?? 'draft');
      if (pendingDeleteId === project.id) {
        card.innerHTML = `
          <div class="space-y-16">
            <p class="text-body-sm font-semibold text-desert-sienna">¿Eliminar este proyecto de forma permanente? Esta acción no se puede deshacer.</p>
            <div class="flex flex-wrap gap-11">
              ${iconButtonHtml('x', 'Cancelar eliminacion', 'text-obsidian hover:border-obsidian hover:bg-obsidian hover:text-canvas-white', { 'data-cancel-delete': '1' })}
              ${iconButtonHtml('check', 'Confirmar eliminacion', 'border-desert-sienna text-desert-sienna hover:bg-desert-sienna hover:text-canvas-white', { 'data-confirm-delete': project.id })}
            </div>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-13">
            <div class="min-w-0">
              <h3 class="font-display text-subheading leading-subheading font-semibold text-obsidian">${title}</h3>
              <p class="mt-4 flex items-center gap-8 text-slate-mist">
                <span class="microlabel">Estado</span>
                <span class="datum text-[12px] text-obsidian">${statusLabel}</span>
              </p>
            </div>
            <div class="flex flex-wrap gap-11">
              ${iconButtonHtml('folder-open', 'Abrir proyecto', 'border-blueprint bg-blueprint text-canvas-white hover:bg-blueprint-deep hover:border-blueprint-deep', { 'data-open-id': project.id })}
              ${iconButtonHtml('trash', 'Eliminar proyecto', 'text-obsidian hover:border-obsidian hover:bg-obsidian hover:text-canvas-white', { 'data-request-delete': project.id })}
            </div>
          </div>
        `;
      }
      projectsList.appendChild(card);
    }
  };

  const load = async () => {
    const projects = await listProjects();
    lastProjects = projects;
    renderProjects(projects);
  };

  if (!supabase) {
    window.location.href = '/login';
    return;
  }

  try {
    const session = await requireSession();
    if (sessionLabel) {
      sessionLabel.textContent = `Sesion activa como ${session.user.email ?? 'usuario'}.`;
    }
    await load();
  } catch {
    window.location.href = '/login';
    return;
  }

  resetProjectFormBtn?.addEventListener('click', () => {
    if (projectNameInput) projectNameInput.value = '';
    if (projectConcreteSelect) projectConcreteSelect.value = DEFAULT_PROJECT_SPECS.concrete;
    setFormStatus('Completa el nombre para crear un proyecto nuevo.');
    projectNameInput?.focus();
  });

  newProjectForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = projectNameInput?.value.trim() ?? '';
    if (!name) {
      setFormStatus('Ingresa un nombre valido para continuar.', true);
      projectNameInput?.focus();
      return;
    }

    setFormStatus('Creando proyecto...');
    try {
      await createProject({
        name,
        specs: {
          ...DEFAULT_PROJECT_SPECS,
          concrete: projectConcreteSelect?.value ?? DEFAULT_PROJECT_SPECS.concrete
        }
      });
      if (projectNameInput) projectNameInput.value = '';
      if (projectConcreteSelect) projectConcreteSelect.value = DEFAULT_PROJECT_SPECS.concrete;
      setFormStatus('Proyecto creado correctamente.');
      await load();
    } catch (error) {
      setFormStatus(`No se pudo crear el proyecto: ${(error as Error).message}`, true);
    }
  });

  projectsList?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const openId = target.dataset.openId;
    if (openId) {
      try {
        const project = await getProject(openId);
        storeActiveProject(project);
        window.location.href = `/editor?project=${openId}`;
      } catch (error) {
        setFormStatus(`No se pudo abrir el proyecto: ${(error as Error).message}`, true);
      }
      return;
    }

    if (target.dataset.requestDelete) {
      pendingDeleteId = target.dataset.requestDelete;
      renderProjects(lastProjects);
      setFormStatus('Confirma o cancela la eliminacion en la tarjeta del proyecto.');
      return;
    }

    if (target.dataset.cancelDelete != null) {
      pendingDeleteId = null;
      renderProjects(lastProjects);
      setFormStatus('Eliminacion cancelada.');
      return;
    }

    if (target.dataset.confirmDelete) {
      try {
        await deleteProject(target.dataset.confirmDelete);
        pendingDeleteId = null;
        setFormStatus('Proyecto eliminado.');
        await load();
      } catch (error) {
        setFormStatus(`No se pudo eliminar: ${(error as Error).message}`, true);
      }
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  });
}
