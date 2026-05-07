import {
  DEFAULT_BEAM_SECTION,
  DEFAULT_COLUMN_SECTION,
  DEFAULT_DRAWING_STATE,
  DEFAULT_SLAB_THICKNESS,
  type BeamEntity,
  type CameraState,
  type ColumnEntity,
  type DrawingState,
  type Entity,
  type EntityRef,
  type PreviewShape,
  type SlabEntity,
  type SnapKind,
  type SnapResult,
  type ToolKind
} from './types';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  panByPixels,
  screenToWorld,
  zoomAtCursor
} from './camera';
import {
  entityBoundingBox,
  findEntity,
  hitTest,
  polygonArea,
  removeEntity,
  round,
  translateEntity
} from './geometry';
import { applyOrtho, computeSnap } from './snap';
import { History } from './history';
import { nextId } from './ids';
import { render, type RenderProps } from './render';

export type { DrawingState, ToolKind, Entity, EntityRef } from './types';

export interface HudInfo {
  cursor: { x: number; y: number } | null;
  zoom: number;
  tool: ToolKind;
  snap: { enabled: boolean; kind: SnapKind };
  ortho: boolean;
  selectionCount: number;
  measure: {
    lengthM?: number;
    areaM2?: number;
    widthM?: number;
    heightM?: number;
    sideCount?: number;
  } | null;
  canUndo: boolean;
  canRedo: boolean;
  status: string;
}

export interface Editor2DOptions {
  initialState?: DrawingState;
  initialTool?: ToolKind;
  /** Tipo por defecto que usa la herramienta de columna (en metros). */
  columnSection?: { widthM: number; depthM: number };
  /** Seccion por defecto de la herramienta de viga. */
  beamSection?: { widthM: number; depthM: number };
  /** Espesor por defecto de la herramienta de losa. */
  slabThicknessM?: number;
  onChange?: (state: DrawingState) => void;
  onHud?: (hud: HudInfo) => void;
}

export interface Editor2DHandle {
  getState(): DrawingState;
  setState(next: DrawingState, options?: { commit?: boolean }): void;
  setTool(tool: ToolKind): void;
  setSnapEnabled(enabled: boolean): void;
  setOrthoEnabled(enabled: boolean): void;
  setGridSizeM(size: number): void;
  setColumnSection(section: { widthM: number; depthM: number }): void;
  setBeamSection(section: { widthM: number; depthM: number }): void;
  setSlabThicknessM(thickness: number): void;
  updateSelectionProps(updater: (entity: Entity) => Entity): void;
  deleteSelection(): void;
  clearSelection(): void;
  selectAll(): void;
  cancelDrawing(): void;
  undo(): void;
  redo(): void;
  fit(): void;
  resetView(): void;
  zoomIn(): void;
  zoomOut(): void;
  getSelection(): EntityRef[];
  getSelectionEntities(): Entity[];
  dispose(): void;
}

interface DragMoveState {
  startWorld: { x: number; y: number };
  originalEntities: Entity[];
  originalState: DrawingState;
  pointerId: number;
  moved: boolean;
}

interface PanState {
  pointerId: number;
  lastClientX: number;
  lastClientY: number;
}

interface BeamDraftState {
  start: { x: number; y: number };
}

interface ColumnDraftState {
  start: { x: number; y: number };
}

interface SlabDraftState {
  points: Array<{ x: number; y: number }>;
}

const STATUS_MESSAGES: Record<ToolKind, string> = {
  select: 'Selecciona elementos. Shift+click para anadir. Arrastra para mover.',
  pan: 'Arrastra para desplazar la vista.',
  beam: 'Click 1: punto inicial. Click 2: cierra la viga. ESC para cancelar.',
  column: 'Click para colocar columna con la seccion actual. ESC para salir.',
  slab: 'Click para anadir vertice. Doble click o Enter para cerrar la losa.'
};

export function mountEditor2d(
  canvas: HTMLCanvasElement,
  options: Editor2DOptions = {}
): Editor2DHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('mountEditor2d: no se pudo obtener contexto 2D');
  }

  const cleanups: Array<() => void> = [];

  const initial = options.initialState ?? { ...DEFAULT_DRAWING_STATE, createdAt: new Date().toISOString() };
  let state: DrawingState = structuredClone(initial);
  let cam: CameraState = { x: 0, y: 0, zoom: 80 };
  let tool: ToolKind = options.initialTool ?? 'select';
  const selection: Set<string> = new Set();
  let hoverId: string | null = null;
  let preview: PreviewShape | null = null;
  let snapResult: SnapResult | null = null;
  let cursorWorld: { x: number; y: number } | null = null;
  let lastClientPoint: { x: number; y: number } | null = null;
  let showCrosshair = false;
  let statusMessage = STATUS_MESSAGES[tool];
  let dragMove: DragMoveState | null = null;
  let panActive: PanState | null = null;
  let spaceHeld = false;
  let beamDraft: BeamDraftState | null = null;
  let columnDraft: ColumnDraftState | null = null;
  let slabDraft: SlabDraftState | null = null;

  let columnSection = { ...DEFAULT_COLUMN_SECTION, ...(options.columnSection ?? {}) };
  let beamSection = { ...DEFAULT_BEAM_SECTION, ...(options.beamSection ?? {}) };
  let slabThicknessM = options.slabThicknessM ?? DEFAULT_SLAB_THICKNESS;

  const history = new History(60);
  history.reset(state);

  let viewW = 1;
  let viewH = 1;
  let dpr = 1;
  let rafScheduled = false;
  let needsRender = true;

  const updateSize = () => {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    viewW = cssW;
    viewH = cssH;
    invalidate();
  };

  const ro = new ResizeObserver(updateSize);
  ro.observe(canvas);
  cleanups.push(() => ro.disconnect());

  const invalidate = () => {
    needsRender = true;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(loop);
    }
  };

  const renderProps: RenderProps = {
    state,
    cam,
    viewW,
    viewH,
    selectedIds: selection,
    hoverId,
    preview,
    snap: snapResult,
    cursorWorld,
    showCrosshair
  };

  const loop = () => {
    rafScheduled = false;
    if (!needsRender) return;
    needsRender = false;
    if (canvas.width === 0 || canvas.height === 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderProps.state = state;
    renderProps.cam = cam;
    renderProps.viewW = viewW;
    renderProps.viewH = viewH;
    renderProps.selectedIds = selection;
    renderProps.hoverId = hoverId;
    renderProps.preview = preview;
    renderProps.snap = snapResult;
    renderProps.cursorWorld = cursorWorld;
    renderProps.showCrosshair = showCrosshair;
    render(ctx, renderProps);
    emitHud();
  };

  const computeMeasure = (): HudInfo['measure'] => {
    if (preview) {
      if (preview.type === 'beam' && preview.start && preview.current) {
        return { lengthM: Math.hypot(preview.current.x - preview.start.x, preview.current.y - preview.start.y) };
      }
      if (preview.type === 'column' && preview.start && preview.current) {
        return {
          widthM: Math.abs(preview.current.x - preview.start.x),
          heightM: Math.abs(preview.current.y - preview.start.y)
        };
      }
      if (preview.type === 'slab' && preview.points && preview.points.length > 0) {
        const closing = preview.points.concat(preview.current ? [preview.current] : []);
        return { areaM2: polygonArea(closing), sideCount: closing.length };
      }
    }
    if (selection.size === 1) {
      const id = selection.values().next().value as string;
      const entity = findEntityById(state, id);
      if (entity?.type === 'beam') {
        return { lengthM: Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1) };
      }
      if (entity?.type === 'column') {
        return { widthM: entity.widthM, heightM: entity.depthM };
      }
      if (entity?.type === 'slab') {
        return { areaM2: polygonArea(entity.points), sideCount: entity.points.length };
      }
    }
    return null;
  };

  const emitHud = () => {
    const hud: HudInfo = {
      cursor: cursorWorld ? { x: round(cursorWorld.x, 3), y: round(cursorWorld.y, 3) } : null,
      zoom: cam.zoom,
      tool,
      snap: { enabled: state.grid.snapEnabled, kind: snapResult?.kind ?? 'none' },
      ortho: state.grid.orthoEnabled,
      selectionCount: selection.size,
      measure: computeMeasure(),
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
      status: statusMessage
    };
    options.onHud?.(hud);
  };

  const commitChange = () => {
    state = { ...state, createdAt: new Date().toISOString() };
    history.push(state);
    options.onChange?.(state);
    invalidate();
  };

  const setStateInternal = (next: DrawingState) => {
    state = next;
    invalidate();
    emitHud();
  };

  const getCanvasPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const computeSnapForCursor = (sx: number, sy: number) => {
    const world = screenToWorld(cam, viewW, viewH, sx, sy);
    cursorWorld = world;
    let snap = computeSnap(world, cam, state);
    const orthoBase = beamDraft?.start ?? slabDraft?.points[slabDraft.points.length - 1];
    if (state.grid.orthoEnabled && orthoBase) {
      const constrained = applyOrtho(orthoBase, snap.point);
      snap = { point: constrained, kind: 'ortho' };
    }
    snapResult = snap;
    return snap;
  };

  const setTool = (next: ToolKind) => {
    if (next === tool) return;
    cancelDrawingInternal();
    tool = next;
    statusMessage = STATUS_MESSAGES[next];
    showCrosshair = next === 'beam' || next === 'column' || next === 'slab';
    invalidate();
    emitHud();
  };

  const cancelDrawingInternal = () => {
    beamDraft = null;
    columnDraft = null;
    slabDraft = null;
    preview = null;
    invalidate();
  };

  const setOrthoEnabled = (enabled: boolean) => {
    state = { ...state, grid: { ...state.grid, orthoEnabled: enabled } };
    statusMessage = enabled ? 'Modo ortogonal activo.' : STATUS_MESSAGES[tool];
    invalidate();
    emitHud();
  };

  const setSnapEnabled = (enabled: boolean) => {
    state = { ...state, grid: { ...state.grid, snapEnabled: enabled } };
    statusMessage = enabled ? 'Snap a grilla activo.' : 'Snap a grilla desactivado.';
    invalidate();
    emitHud();
  };

  const setGridSizeM = (size: number) => {
    if (!Number.isFinite(size) || size <= 0) return;
    state = { ...state, grid: { ...state.grid, sizeM: size } };
    invalidate();
  };

  const startPan = (e: PointerEvent) => {
    panActive = { pointerId: e.pointerId, lastClientX: e.clientX, lastClientY: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };

  const endPan = (e: PointerEvent) => {
    if (panActive && panActive.pointerId === e.pointerId) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      panActive = null;
      updateCursorStyle();
    }
  };

  const updateCursorStyle = () => {
    if (panActive || (spaceHeld && tool !== 'pan')) {
      canvas.style.cursor = 'grab';
      return;
    }
    if (tool === 'pan') {
      canvas.style.cursor = 'grab';
      return;
    }
    if (tool === 'select') {
      canvas.style.cursor = hoverId ? 'move' : 'default';
      return;
    }
    canvas.style.cursor = 'crosshair';
  };

  const onPointerDown = (e: PointerEvent) => {
    canvas.focus();
    if (e.button === 1 || (e.button === 0 && (spaceHeld || tool === 'pan'))) {
      startPan(e);
      return;
    }
    if (e.button === 2) return; // ignore right click
    const { sx, sy } = getCanvasPoint(e);
    const snap = computeSnapForCursor(sx, sy);
    const point = snap.point;

    if (tool === 'select') {
      const ref = hitTest(point, state, 8 / cam.zoom);
      if (ref) {
        if (e.shiftKey) {
          if (selection.has(ref.id)) selection.delete(ref.id);
          else selection.add(ref.id);
        } else if (!selection.has(ref.id)) {
          selection.clear();
          selection.add(ref.id);
        }
        startSelectionDrag(point, e.pointerId);
        statusMessage = `${selection.size} elemento(s) seleccionado(s).`;
      } else {
        if (!e.shiftKey) selection.clear();
        statusMessage = STATUS_MESSAGES[tool];
      }
      invalidate();
      emitHud();
      return;
    }

    if (tool === 'beam') {
      if (!beamDraft) {
        beamDraft = { start: { ...point } };
        preview = { type: 'beam', start: { ...point }, current: { ...point } };
        statusMessage = 'Click 2: cierra la viga. ESC para cancelar.';
      } else {
        commitBeam(beamDraft.start, point);
        beamDraft = { start: { ...point } };
        preview = { type: 'beam', start: { ...point }, current: { ...point } };
      }
      invalidate();
      emitHud();
      return;
    }

    if (tool === 'column') {
      if (e.shiftKey) {
        if (!columnDraft) {
          columnDraft = { start: { ...point } };
          preview = { type: 'column', start: { ...point }, current: { ...point } };
          statusMessage = 'Click 2: cierra la columna rectangular.';
        } else {
          commitColumnFromRect(columnDraft.start, point);
          columnDraft = null;
          preview = null;
        }
      } else {
        commitColumnAtPoint(point);
      }
      invalidate();
      emitHud();
      return;
    }

    if (tool === 'slab') {
      if (!slabDraft) slabDraft = { points: [] };
      slabDraft.points.push({ ...point });
      preview = { type: 'slab', points: slabDraft.points.map((p) => ({ ...p })), current: { ...point } };
      statusMessage = `Vertices: ${slabDraft.points.length}. Doble click o Enter para cerrar.`;
      invalidate();
      emitHud();
      return;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const { sx, sy } = getCanvasPoint(e);
    lastClientPoint = { x: sx, y: sy };
    if (panActive && panActive.pointerId === e.pointerId) {
      const dx = e.clientX - panActive.lastClientX;
      const dy = e.clientY - panActive.lastClientY;
      panActive.lastClientX = e.clientX;
      panActive.lastClientY = e.clientY;
      cam = panByPixels(cam, dx, dy);
      invalidate();
      return;
    }
    const snap = computeSnapForCursor(sx, sy);
    const point = snap.point;

    if (dragMove && dragMove.pointerId === e.pointerId) {
      const dx = round(point.x - dragMove.startWorld.x);
      const dy = round(point.y - dragMove.startWorld.y);
      if (dx !== 0 || dy !== 0) dragMove.moved = true;
      const newEntities = dragMove.originalEntities.map((entity) => translateEntity(entity, dx, dy));
      const cloned = structuredClone(dragMove.originalState);
      for (const updated of newEntities) replaceEntity(cloned, updated);
      state = cloned;
      invalidate();
      return;
    }

    if (tool === 'select') {
      const ref = hitTest(point, state, 8 / cam.zoom);
      const newHover = ref?.id ?? null;
      if (newHover !== hoverId) {
        hoverId = newHover;
        invalidate();
        updateCursorStyle();
      }
      emitHud();
      return;
    }

    if (tool === 'beam' && beamDraft) {
      preview = { type: 'beam', start: beamDraft.start, current: { ...point } };
      invalidate();
      emitHud();
      return;
    }
    if (tool === 'column') {
      if (columnDraft) {
        preview = { type: 'column', start: columnDraft.start, current: { ...point } };
      } else {
        preview = {
          type: 'column',
          start: { x: point.x - columnSection.widthM / 2, y: point.y - columnSection.depthM / 2 },
          current: { x: point.x + columnSection.widthM / 2, y: point.y + columnSection.depthM / 2 }
        };
      }
      invalidate();
      emitHud();
      return;
    }
    if (tool === 'slab' && slabDraft) {
      preview = { type: 'slab', points: slabDraft.points.map((p) => ({ ...p })), current: { ...point } };
      invalidate();
      emitHud();
      return;
    }
    invalidate();
    emitHud();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (panActive && panActive.pointerId === e.pointerId) {
      endPan(e);
      return;
    }
    if (dragMove && dragMove.pointerId === e.pointerId) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (dragMove.moved) {
        commitChange();
      }
      dragMove = null;
      updateCursorStyle();
    }
  };

  const onPointerLeave = () => {
    cursorWorld = null;
    snapResult = null;
    hoverId = null;
    invalidate();
    emitHud();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { sx, sy } = getCanvasPoint(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    cam = zoomAtCursor(cam, viewW, viewH, sx, sy, factor);
    if (lastClientPoint) computeSnapForCursor(lastClientPoint.x, lastClientPoint.y);
    invalidate();
    emitHud();
  };

  const onDblClick = (e: MouseEvent) => {
    if (tool === 'slab' && slabDraft && slabDraft.points.length >= 3) {
      e.preventDefault();
      finishSlab();
    }
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (tool === 'beam') {
      cancelDrawingInternal();
      statusMessage = STATUS_MESSAGES.beam;
      emitHud();
    } else if (tool === 'column' && columnDraft) {
      cancelDrawingInternal();
      statusMessage = STATUS_MESSAGES.column;
      emitHud();
    } else if (tool === 'slab') {
      finishSlab();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('contextmenu', onContextMenu);
  cleanups.push(() => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('dblclick', onDblClick);
    canvas.removeEventListener('contextmenu', onContextMenu);
  });

  const isInputFocused = () => {
    const t = document.activeElement;
    return (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement ||
      (t instanceof HTMLElement && t.isContentEditable)
    );
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isInputFocused()) return;
    const key = e.key;

    if (key === ' ' && !spaceHeld) {
      spaceHeld = true;
      updateCursorStyle();
      e.preventDefault();
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (key === 'z' || key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (ctrl && ((key === 'z' || key === 'Z') && e.shiftKey || key === 'y' || key === 'Y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (ctrl && (key === 'a' || key === 'A')) {
      e.preventDefault();
      selectAll();
      return;
    }

    switch (key) {
      case 'v':
      case 'V':
        setTool('select');
        break;
      case 'h':
      case 'H':
        setTool('pan');
        break;
      case 'l':
      case 'L':
        setTool('beam');
        break;
      case 'r':
      case 'R':
        setTool('column');
        break;
      case 'p':
      case 'P':
        setTool('slab');
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        deleteSelection();
        break;
      case 'Escape':
        e.preventDefault();
        cancelDrawing();
        clearSelection();
        break;
      case 'Enter':
        if (tool === 'slab' && slabDraft && slabDraft.points.length >= 3) {
          finishSlab();
        }
        break;
      case 'F8':
        e.preventDefault();
        setOrthoEnabled(!state.grid.orthoEnabled);
        break;
      case 'F9':
        e.preventDefault();
        setSnapEnabled(!state.grid.snapEnabled);
        break;
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
      case '_':
        zoomOut();
        break;
      case '0':
        if (e.shiftKey) fit();
        else resetView();
        break;
      default:
        return;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (isInputFocused()) return;
    if (e.key === ' ') {
      spaceHeld = false;
      updateCursorStyle();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  cleanups.push(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });

  const startSelectionDrag = (worldStart: { x: number; y: number }, pointerId: number) => {
    const originalEntities: Entity[] = [];
    for (const id of selection) {
      const entity = findEntityById(state, id);
      if (entity) originalEntities.push(structuredClone(entity));
    }
    if (originalEntities.length === 0) return;
    dragMove = {
      startWorld: worldStart,
      originalEntities,
      originalState: structuredClone(state),
      pointerId,
      moved: false
    };
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      /* noop */
    }
  };

  const commitBeam = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) return;
    const beam: BeamEntity = {
      id: nextId('beam'),
      type: 'beam',
      x1: round(a.x),
      y1: round(a.y),
      x2: round(b.x),
      y2: round(b.y),
      widthM: beamSection.widthM,
      depthM: beamSection.depthM,
      props: {}
    };
    state = {
      ...state,
      entities: { ...state.entities, beams: [...state.entities.beams, beam] }
    };
    selection.clear();
    selection.add(beam.id);
    commitChange();
    statusMessage = 'Viga creada.';
  };

  const commitColumnAtPoint = (point: { x: number; y: number }) => {
    const column: ColumnEntity = {
      id: nextId('col'),
      type: 'column',
      cx: round(point.x),
      cy: round(point.y),
      widthM: columnSection.widthM,
      depthM: columnSection.depthM,
      rotation: 0,
      props: {}
    };
    state = {
      ...state,
      entities: { ...state.entities, columns: [...state.entities.columns, column] }
    };
    selection.clear();
    selection.add(column.id);
    commitChange();
    statusMessage = 'Columna creada.';
  };

  const commitColumnFromRect = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    if (w < 0.05 || h < 0.05) return;
    const column: ColumnEntity = {
      id: nextId('col'),
      type: 'column',
      cx: round((a.x + b.x) / 2),
      cy: round((a.y + b.y) / 2),
      widthM: round(w),
      depthM: round(h),
      rotation: 0,
      props: {}
    };
    state = {
      ...state,
      entities: { ...state.entities, columns: [...state.entities.columns, column] }
    };
    selection.clear();
    selection.add(column.id);
    columnSection = { widthM: column.widthM, depthM: column.depthM };
    commitChange();
    statusMessage = 'Columna creada por rectangulo.';
  };

  const finishSlab = () => {
    if (!slabDraft || slabDraft.points.length < 3) {
      statusMessage = 'Una losa requiere al menos 3 vertices.';
      emitHud();
      return;
    }
    const slab: SlabEntity = {
      id: nextId('slab'),
      type: 'slab',
      points: slabDraft.points.map((p) => ({ x: round(p.x), y: round(p.y) })),
      thicknessM: slabThicknessM,
      props: {}
    };
    state = {
      ...state,
      entities: { ...state.entities, slabs: [...state.entities.slabs, slab] }
    };
    slabDraft = null;
    preview = null;
    selection.clear();
    selection.add(slab.id);
    commitChange();
    statusMessage = 'Losa creada.';
  };

  const cancelDrawing = () => {
    cancelDrawingInternal();
    statusMessage = STATUS_MESSAGES[tool];
    emitHud();
  };

  const deleteSelection = () => {
    if (selection.size === 0) return;
    let next = state;
    for (const id of selection) {
      const ref = findRef(next, id);
      if (ref) next = removeEntity(next, ref);
    }
    selection.clear();
    state = next;
    commitChange();
    statusMessage = 'Elementos eliminados.';
  };

  const clearSelection = () => {
    if (selection.size === 0) return;
    selection.clear();
    invalidate();
    emitHud();
  };

  const selectAll = () => {
    selection.clear();
    for (const c of state.entities.columns) selection.add(c.id);
    for (const b of state.entities.beams) selection.add(b.id);
    for (const s of state.entities.slabs) selection.add(s.id);
    invalidate();
    emitHud();
  };

  const undo = () => {
    const next = history.undo();
    if (!next) return;
    state = next;
    selection.clear();
    options.onChange?.(state);
    invalidate();
    emitHud();
  };

  const redo = () => {
    const next = history.redo();
    if (!next) return;
    state = next;
    selection.clear();
    options.onChange?.(state);
    invalidate();
    emitHud();
  };

  const fit = () => {
    const bounds = computeContentBounds(state);
    if (!bounds) {
      resetView();
      return;
    }
    const padding = 1.2;
    const w = (bounds.maxX - bounds.minX) || 1;
    const h = (bounds.maxY - bounds.minY) || 1;
    const zx = viewW / (w * padding);
    const zy = viewH / (h * padding);
    cam = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zx, zy)))
    };
    invalidate();
  };

  const resetView = () => {
    cam = { x: 0, y: 0, zoom: 80 };
    invalidate();
  };

  const zoomIn = () => {
    cam = zoomAtCursor(cam, viewW, viewH, viewW / 2, viewH / 2, 1.2);
    invalidate();
  };

  const zoomOut = () => {
    cam = zoomAtCursor(cam, viewW, viewH, viewW / 2, viewH / 2, 1 / 1.2);
    invalidate();
  };

  const updateSelectionProps = (updater: (entity: Entity) => Entity) => {
    if (selection.size === 0) return;
    const next = structuredClone(state);
    let touched = false;
    for (const id of selection) {
      const ref = findRef(next, id);
      if (!ref) continue;
      const entity = findEntity(next, ref);
      if (!entity) continue;
      const updated = updater(entity);
      if (updated && updated !== entity) {
        replaceEntity(next, updated);
        touched = true;
      } else if (updated) {
        replaceEntity(next, updated);
        touched = true;
      }
    }
    if (touched) {
      state = next;
      commitChange();
    }
  };

  const dispose = () => {
    for (const fn of cleanups) fn();
    cleanups.length = 0;
  };

  // Initial paint and HUD emission
  updateSize();
  invalidate();
  emitHud();

  return {
    getState: () => state,
    setState: (next, opts) => {
      setStateInternal(structuredClone(next));
      if (opts?.commit) {
        history.reset(state);
        options.onChange?.(state);
      }
    },
    setTool,
    setSnapEnabled,
    setOrthoEnabled,
    setGridSizeM,
    setColumnSection: (s) => {
      columnSection = { widthM: s.widthM, depthM: s.depthM };
    },
    setBeamSection: (s) => {
      beamSection = { widthM: s.widthM, depthM: s.depthM };
    },
    setSlabThicknessM: (t) => {
      if (Number.isFinite(t) && t > 0) slabThicknessM = t;
    },
    updateSelectionProps,
    deleteSelection,
    clearSelection,
    selectAll,
    cancelDrawing,
    undo,
    redo,
    fit,
    resetView,
    zoomIn,
    zoomOut,
    getSelection: () => {
      const refs: EntityRef[] = [];
      for (const id of selection) {
        const ref = findRef(state, id);
        if (ref) refs.push(ref);
      }
      return refs;
    },
    getSelectionEntities: () => {
      const out: Entity[] = [];
      for (const id of selection) {
        const e = findEntityById(state, id);
        if (e) out.push(e);
      }
      return out;
    },
    dispose
  };
}

function findRef(state: DrawingState, id: string): EntityRef | null {
  if (state.entities.columns.some((c) => c.id === id)) return { type: 'column', id };
  if (state.entities.beams.some((b) => b.id === id)) return { type: 'beam', id };
  if (state.entities.slabs.some((s) => s.id === id)) return { type: 'slab', id };
  return null;
}

function findEntityById(state: DrawingState, id: string): Entity | null {
  return (
    state.entities.columns.find((c) => c.id === id) ??
    state.entities.beams.find((b) => b.id === id) ??
    state.entities.slabs.find((s) => s.id === id) ??
    null
  );
}

function replaceEntity(state: DrawingState, entity: Entity): void {
  if (entity.type === 'column') {
    const idx = state.entities.columns.findIndex((c) => c.id === entity.id);
    if (idx >= 0) state.entities.columns[idx] = entity as ColumnEntity;
  } else if (entity.type === 'beam') {
    const idx = state.entities.beams.findIndex((b) => b.id === entity.id);
    if (idx >= 0) state.entities.beams[idx] = entity as BeamEntity;
  } else if (entity.type === 'slab') {
    const idx = state.entities.slabs.findIndex((s) => s.id === entity.id);
    if (idx >= 0) state.entities.slabs[idx] = entity as SlabEntity;
  }
}

function computeContentBounds(state: DrawingState): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  const apply = (entity: Entity) => {
    const bb = entityBoundingBox(entity);
    if (bb.minX < minX) minX = bb.minX;
    if (bb.minY < minY) minY = bb.minY;
    if (bb.maxX > maxX) maxX = bb.maxX;
    if (bb.maxY > maxY) maxY = bb.maxY;
    any = true;
  };
  for (const c of state.entities.columns) apply(c);
  for (const b of state.entities.beams) apply(b);
  for (const s of state.entities.slabs) apply(s);
  return any ? { minX, minY, maxX, maxY } : null;
}
