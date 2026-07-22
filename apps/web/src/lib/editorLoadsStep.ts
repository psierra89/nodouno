import { calculateUltimateSurfaceLoad } from '@nodouno/calc';
import { mountEditor2d } from '@nodouno/editor2d';
import type { Editor2DHandle, SlabEntity } from '@nodouno/editor2d';
import { polygonArea } from '@nodouno/editor2d/geometry';
import {
  CIRSOC_101_LOAD_TYPOLOGIES,
  liveLoadForTypology,
  type LoadTypologyCode
} from '@nodouno/shared';

const DEFAULT_SLAB_DEAD = 1.5;

type EditorLoadsStepElements = {
  canvas: HTMLCanvasElement | null;
  hudStatus: HTMLElement | null;
  validation: HTMLElement | null;
  noSlabs: HTMLElement | null;
  loadsPanel: HTMLElement | null;
  slabPicker: HTMLSelectElement | null;
  loadFields: HTMLElement | null;
  loadPreview: HTMLElement | null;
  fitBtn: HTMLButtonElement | null;
  zoomInBtn: HTMLButtonElement | null;
  zoomOutBtn: HTMLButtonElement | null;
};

export type EditorLoadsStepOptions = {
  getMainEditor: () => Editor2DHandle | null;
  onSlabPatched: () => void;
  elements: EditorLoadsStepElements;
};

const readSlabProps = (slab: SlabEntity) => ({
  loadTypologyCode: slab.props?.loadTypologyCode as LoadTypologyCode | undefined,
  deadLoadKnm2:
    typeof slab.props?.deadLoadKnm2 === 'number' ? slab.props.deadLoadKnm2 : DEFAULT_SLAB_DEAD,
  liveLoadOverrideKnm2:
    typeof slab.props?.liveLoadOverrideKnm2 === 'number'
      ? slab.props.liveLoadOverrideKnm2
      : undefined
});

const slabDisplayName = (slab: SlabEntity, index: number) => {
  const custom = slab.props?.name;
  if (typeof custom === 'string' && custom.trim()) return custom.trim();
  return `Losa ${index + 1}`;
};

const slabPreviewLoads = (slab: SlabEntity) => {
  const props = readSlabProps(slab);
  const L = liveLoadForTypology(props.loadTypologyCode, props.liveLoadOverrideKnm2);
  if (L === null) return null;
  const D = slab.thicknessM * 24 + props.deadLoadKnm2;
  const qu = calculateUltimateSurfaceLoad(slab.thicknessM, props.deadLoadKnm2, L);
  return { D, L, qu };
};

export function initEditorLoadsStep(options: EditorLoadsStepOptions) {
  const { getMainEditor, onSlabPatched, elements } = options;
  let loadsEditor: Editor2DHandle | null = null;
  let pickerSync = false;

  const getSelectedSlabId = (): string | null => {
    const sel = loadsEditor?.getSelection() ?? [];
    const slabRef = sel.find((r) => r.type === 'slab');
    return slabRef?.id ?? null;
  };

  const patchSlabInDrawing = (slabId: string, updater: (slab: SlabEntity) => SlabEntity) => {
    const editor = getMainEditor();
    if (!editor) return;
    const state = structuredClone(editor.getState());
    const idx = state.entities.slabs.findIndex((s) => s.id === slabId);
    if (idx < 0) return;
    state.entities.slabs[idx] = updater(state.entities.slabs[idx]!);
    editor.setState(state, { commit: true });
    onSlabPatched();
    syncFromMainEditor();
    renderPanel();
  };

  const syncFromMainEditor = () => {
    const editor = getMainEditor();
    if (!loadsEditor || !editor) return;
    loadsEditor.setState(structuredClone(editor.getState()), { commit: false });
  };

  const ensureLoadsEditor = () => {
    const editor = getMainEditor();
    if (loadsEditor || !elements.canvas || !editor) return;
    loadsEditor = mountEditor2d(elements.canvas, {
      interactionMode: 'slabLoads',
      initialState: structuredClone(editor.getState()),
      onSelectionChange: () => {
        if (pickerSync) return;
        renderPanel();
      },
      onHud: (hud) => {
        if (elements.hudStatus) elements.hudStatus.textContent = hud.status;
      }
    });
    loadsEditor.fit();
  };

  const renderLoadFields = (slab: SlabEntity) => {
    if (!elements.loadFields) return;
    elements.loadFields.innerHTML = '';
    const props = readSlabProps(slab);

    const typologyLabel = document.createElement('label');
    typologyLabel.className = 'grid gap-8';
    typologyLabel.innerHTML = '<span class="text-body-sm font-semibold">Tipología CIRSOC 101</span>';
    const typologySelect = document.createElement('select');
    typologySelect.className = 'cad-input';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— Seleccionar —';
    typologySelect.appendChild(emptyOpt);
    for (const t of CIRSOC_101_LOAD_TYPOLOGIES) {
      const opt = document.createElement('option');
      opt.value = t.code;
      opt.textContent = `${t.label} (L=${t.liveLoadKnm2 ?? 'manual'} kN/m²)`;
      typologySelect.appendChild(opt);
    }
    typologySelect.value = props.loadTypologyCode ?? '';
    typologySelect.addEventListener('change', () => {
      const code = typologySelect.value as LoadTypologyCode | '';
      patchSlabInDrawing(slab.id, (s) => ({
        ...s,
        props: { ...s.props, loadTypologyCode: code || undefined }
      }));
    });
    typologyLabel.appendChild(typologySelect);
    elements.loadFields.appendChild(typologyLabel);

    const deadLabel = document.createElement('label');
    deadLabel.className = 'grid gap-8';
    deadLabel.innerHTML = '<span class="text-body-sm font-semibold">Muerta adicional (kN/m²)</span>';
    const deadInput = document.createElement('input');
    deadInput.type = 'number';
    deadInput.min = '0';
    deadInput.step = '0.1';
    deadInput.className = 'cad-input';
    deadInput.value = String(props.deadLoadKnm2);
    deadInput.addEventListener('change', () => {
      patchSlabInDrawing(slab.id, (s) => ({
        ...s,
        props: { ...s.props, deadLoadKnm2: Number(deadInput.value) || DEFAULT_SLAB_DEAD }
      }));
    });
    deadLabel.appendChild(deadInput);
    elements.loadFields.appendChild(deadLabel);

    if (props.loadTypologyCode === 'CUSTOM') {
      const liveWrap = document.createElement('label');
      liveWrap.className = 'grid gap-8';
      liveWrap.innerHTML = '<span class="text-body-sm font-semibold">L viva manual (kN/m²)</span>';
      const liveInput = document.createElement('input');
      liveInput.type = 'number';
      liveInput.min = '0';
      liveInput.step = '0.1';
      liveInput.className = 'cad-input';
      liveInput.value = String(props.liveLoadOverrideKnm2 ?? 2);
      liveInput.addEventListener('change', () => {
        patchSlabInDrawing(slab.id, (s) => ({
          ...s,
          props: { ...s.props, liveLoadOverrideKnm2: Number(liveInput.value) }
        }));
      });
      liveWrap.appendChild(liveInput);
      elements.loadFields.appendChild(liveWrap);
    }

    const preview = slabPreviewLoads(slab);
    if (elements.loadPreview) {
      elements.loadPreview.textContent = preview
        ? `Vista previa: D=${preview.D.toFixed(2)} · L=${preview.L.toFixed(2)} · qu=${preview.qu.toFixed(2)} kN/m²`
        : 'Complete tipología para ver D, L y qu.';
    }
  };

  const validate = (): string[] => {
    const issues: string[] = [];
    const state = getMainEditor()?.getState();
    if (!state || state.entities.slabs.length === 0) {
      issues.push('Dibuje al menos una losa en el paso 2.');
      return issues;
    }
    for (const slab of state.entities.slabs) {
      const props = readSlabProps(slab);
      if (!props.loadTypologyCode) {
        issues.push(`Losa ${slab.id.slice(-4)}: seleccione tipología CIRSOC 101.`);
      } else if (liveLoadForTypology(props.loadTypologyCode, props.liveLoadOverrideKnm2) === null) {
        issues.push(`Losa ${slab.id.slice(-4)}: carga viva inválida (revise CUSTOM).`);
      }
    }
    return issues;
  };

  const showValidation = (messages: string[]) => {
    if (!elements.validation) return;
    if (messages.length === 0) {
      elements.validation.classList.add('hidden');
      elements.validation.textContent = '';
      return;
    }
    elements.validation.classList.remove('hidden');
    elements.validation.textContent = messages.join(' ');
  };

  const renderPanel = () => {
    const editor = getMainEditor();
    if (!editor) return;
    const slabs = editor.getState().entities.slabs;
    showValidation(validate());

    if (slabs.length === 0) {
      elements.noSlabs?.classList.remove('hidden');
      elements.loadsPanel?.classList.add('hidden');
      if (elements.slabPicker) elements.slabPicker.innerHTML = '';
      if (elements.loadPreview) elements.loadPreview.textContent = '';
      return;
    }

    elements.noSlabs?.classList.add('hidden');
    elements.loadsPanel?.classList.remove('hidden');

    let selectedId = getSelectedSlabId();
    if (!selectedId || !slabs.some((s) => s.id === selectedId)) {
      selectedId = slabs[0]!.id;
      loadsEditor?.setSelection([{ type: 'slab', id: selectedId }]);
    }

    if (elements.slabPicker) {
      pickerSync = true;
      elements.slabPicker.innerHTML = '';
      slabs.forEach((slab, i) => {
        const opt = document.createElement('option');
        opt.value = slab.id;
        opt.textContent = `${slabDisplayName(slab, i)} — ${polygonArea(slab.points).toFixed(1)} m²`;
        elements.slabPicker!.appendChild(opt);
      });
      elements.slabPicker.value = selectedId;
      if (!elements.slabPicker.dataset.bound) {
        elements.slabPicker.dataset.bound = '1';
        elements.slabPicker.addEventListener('change', () => {
          const id = elements.slabPicker!.value;
          if (!id) return;
          loadsEditor?.setSelection([{ type: 'slab', id }]);
          renderPanel();
        });
      }
      pickerSync = false;
    }

    const slab = slabs.find((s) => s.id === selectedId);
    if (slab) renderLoadFields(slab);
  };

  const enter = () => {
    ensureLoadsEditor();
    syncFromMainEditor();
    requestAnimationFrame(() => {
      loadsEditor?.fit();
      const slabs = getMainEditor()?.getState().entities.slabs ?? [];
      if (slabs[0]) {
        loadsEditor?.setSelection([{ type: 'slab', id: slabs[0].id }]);
      } else {
        loadsEditor?.clearSelection();
      }
      renderPanel();
    });
  };

  elements.fitBtn?.addEventListener('click', () => loadsEditor?.fit());
  elements.zoomInBtn?.addEventListener('click', () => loadsEditor?.zoomIn());
  elements.zoomOutBtn?.addEventListener('click', () => loadsEditor?.zoomOut());

  return {
    enter,
    validate,
    showValidation,
    syncFromMainEditor,
    renderPanel,
    dispose: () => {
      loadsEditor?.dispose();
      loadsEditor = null;
    }
  };
}
