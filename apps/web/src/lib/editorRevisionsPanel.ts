import {
  createRevisionSnapshot,
  exportProjectJson,
  listRevisions,
  restoreRevision,
  type RevisionDetail
} from './projectApi';
import { iconButtonHtml } from './icons';

type RevisionListItem = {
  id: string;
  version: number;
  comment?: string | null;
  created_at?: string | null;
};

export type EditorRevisionSnapshot = {
  drawing_data?: unknown;
  simplified_model?: unknown;
  calculations?: unknown;
  dimensioning?: unknown;
};

type EditorRevisionsPanelElements = {
  list: HTMLElement | null;
  status: HTMLElement | null;
  commentInput: HTMLInputElement | null;
  createBtn: HTMLButtonElement | null;
};

export type EditorRevisionsPanelOptions = {
  projectId: string;
  projectName: string | null;
  elements: EditorRevisionsPanelElements;
  getSnapshotForCreate: () => EditorRevisionSnapshot;
  onSnapshotRestored: (restored: RevisionDetail) => void;
  setExportStatus: (message: string, isError?: boolean) => void;
  setEditorStatus: (message: string, isError?: boolean) => void;
};

export function renderRevisionListHtml(
  revisions: RevisionListItem[],
  currentRevisionId: string | null
): string {
  return revisions
    .map((revision) => {
      const isCurrent = currentRevisionId === revision.id;
      return `
        <article
          class="flex flex-wrap items-center justify-between gap-11 rounded-[6px] border px-15 py-13 text-left transition-colors ${
            isCurrent ? 'border-blueprint bg-blueprint/5' : 'border-line hover:border-line-strong'
          }"
          data-revision-id="${revision.id}"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-8">
              <strong class="datum text-obsidian">v${revision.version}</strong>
              ${
                isCurrent
                  ? '<span class="rounded-[4px] border border-blueprint px-8 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-blueprint">Actual</span>'
                  : ''
              }
            </div>
            <span class="mt-4 block text-slate-mist">${revision.comment?.trim() || 'Sin comentario'} · ${
              revision.created_at ? new Date(revision.created_at).toLocaleString() : 'fecha desconocida'
            }</span>
          </div>
          <div class="flex items-center gap-8">
            ${iconButtonHtml('undo', `Restaurar revision v${revision.version}`, 'shrink-0 text-obsidian hover:border-obsidian hover:bg-obsidian hover:text-canvas-white', {
              'data-restore-revision-id': revision.id
            })}
            ${iconButtonHtml('download', `Exportar revision v${revision.version}`, 'shrink-0 text-obsidian hover:border-obsidian hover:bg-obsidian hover:text-canvas-white', {
              'data-export-revision-id': revision.id
            })}
          </div>
        </article>
      `;
    })
    .join('');
}

export function initEditorRevisionsPanel(options: EditorRevisionsPanelOptions) {
  const { projectId, projectName, elements, getSnapshotForCreate, onSnapshotRestored } = options;
  let currentRevisionId: string | null = null;
  let lastRevisionId: string | undefined;

  const setRevisionsStatus = (message: string, isError = false) => {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.classList.toggle('text-desert-sienna', isError);
    elements.status.classList.toggle('text-slate-mist', !isError);
  };

  const downloadRevisionJson = (revisionId: string, snapshot: unknown) => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectName ?? 'proyecto'}-revision-${revisionId.slice(-6)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderItems = async () => {
    if (!elements.list) return;
    try {
      setRevisionsStatus('Cargando revisiones...');
      const revisions = await listRevisions(projectId);
      if (revisions.length === 0) {
        elements.list.innerHTML = '<p class="text-slate-mist">Aun no hay snapshots guardados.</p>';
        setRevisionsStatus('Sin revisiones todavía.');
        return;
      }
      elements.list.innerHTML = renderRevisionListHtml(revisions, currentRevisionId);
      setRevisionsStatus('Snapshots disponibles. Restaura o exporta una revision.');
    } catch (error) {
      elements.list.innerHTML = '<p class="text-slate-mist">Las revisiones requieren API disponible.</p>';
      setRevisionsStatus((error as Error).message, true);
    }
  };

  elements.createBtn?.addEventListener('click', async () => {
    try {
      setRevisionsStatus('Creando snapshot...');
      const result = await createRevisionSnapshot({
        projectId,
        comment: elements.commentInput?.value.trim() || undefined,
        ...getSnapshotForCreate()
      });
      lastRevisionId = result.id;
      currentRevisionId = result.id;
      if (elements.commentInput) elements.commentInput.value = '';
      setRevisionsStatus(`Snapshot v${result.version} creado.`);
      await renderItems();
    } catch (error) {
      setRevisionsStatus((error as Error).message, true);
    }
  });

  elements.list?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const restoreButton = target.closest<HTMLElement>('[data-restore-revision-id]');
    const restoreRevisionId = restoreButton?.dataset.restoreRevisionId;
    if (restoreRevisionId) {
      const confirmed = window.confirm(
        'Restaurar esta revision sobrescribira el estado actual del proyecto. ¿Continuar?'
      );
      if (!confirmed) return;

      try {
        setRevisionsStatus('Restaurando revision...');
        const restored = await restoreRevision(projectId, restoreRevisionId);
        currentRevisionId = restored.id;
        lastRevisionId = restored.id;
        onSnapshotRestored(restored);
        setRevisionsStatus(`Revision v${restored.version} restaurada.`);
        options.setEditorStatus(`Proyecto restaurado a revision v${restored.version}.`);
        await renderItems();
      } catch (error) {
        setRevisionsStatus((error as Error).message, true);
      }
      return;
    }

    const exportButton = target.closest<HTMLElement>('[data-export-revision-id]');
    const revisionId = exportButton?.dataset.exportRevisionId;
    if (!revisionId) return;

    try {
      options.setExportStatus('Exportando revisión...');
      const result = await exportProjectJson(projectId, revisionId);
      lastRevisionId = revisionId;
      downloadRevisionJson(revisionId, result.snapshot);
      options.setExportStatus('Revisión exportada.');
    } catch (error) {
      options.setExportStatus((error as Error).message, true);
    }
  });

  return {
    renderItems,
    setCurrentRevisionId: (revisionId: string | null) => {
      currentRevisionId = revisionId;
    },
    getLastRevisionId: () => lastRevisionId
  };
}
