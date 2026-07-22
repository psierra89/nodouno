import type {
  BeamEntity,
  CameraState,
  ColumnEntity,
  DrawingState,
  Entity,
  EntityRef,
  PreviewShape,
  SlabEntity,
  SnapResult
} from './types';
import { drawGrid } from './grid';
import { bboxIntersects, entityBoundingBox, getColumnCorners, polygonCentroid } from './geometry';
import { getViewportBounds, worldToScreen } from './camera';

export const COLORS = {
  background: '#ffffff',
  obsidian: '#0d1b26',
  slateMist: '#5b6b78',
  sienna: '#b4552d',
  beam: '#0d1b26',
  beamSelected: '#1c4d8b',
  columnFill: '#b4552d',
  columnSelected: '#1c4d8b',
  slabFill: 'rgba(91, 107, 120, 0.14)',
  slabStroke: '#5b6b78',
  slabSelected: '#1c4d8b',
  preview: '#1c4d8b',
  selection: '#1c4d8b',
  hover: 'rgba(28, 77, 139, 0.5)',
  snapMarker: '#b4552d',
  snapText: '#0d1b26',
  cursorCross: 'rgba(13,27,38,0.45)'
};

export interface RenderProps {
  state: DrawingState;
  cam: CameraState;
  viewW: number;
  viewH: number;
  selectedIds: ReadonlySet<string>;
  hoverId: string | null;
  preview: PreviewShape | null;
  snap: SnapResult | null;
  cursorWorld: { x: number; y: number } | null;
  showCrosshair: boolean;
  selectionBox?: { start: { x: number; y: number }; current: { x: number; y: number } } | null;
}

function isSelected(ref: EntityRef, selected: ReadonlySet<string>): boolean {
  return selected.has(ref.id);
}

function drawSlab(
  ctx: CanvasRenderingContext2D,
  slab: SlabEntity,
  cam: CameraState,
  viewW: number,
  viewH: number,
  selected: boolean,
  hovered: boolean
) {
  if (slab.points.length < 3) return;
  ctx.beginPath();
  for (let i = 0; i < slab.points.length; i++) {
    const p = slab.points[i];
    const s = worldToScreen(cam, viewW, viewH, p.x, p.y);
    if (i === 0) ctx.moveTo(s.sx, s.sy);
    else ctx.lineTo(s.sx, s.sy);
  }
  ctx.closePath();
  ctx.fillStyle = selected ? 'rgba(188, 113, 85, 0.18)' : COLORS.slabFill;
  ctx.fill();
  ctx.strokeStyle = selected ? COLORS.slabSelected : COLORS.slabStroke;
  ctx.lineWidth = selected ? 2.5 : hovered ? 2 : 1.5;
  ctx.stroke();
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  beam: BeamEntity,
  cam: CameraState,
  viewW: number,
  viewH: number,
  selected: boolean,
  hovered: boolean
) {
  const a = worldToScreen(cam, viewW, viewH, beam.x1, beam.y1);
  const b = worldToScreen(cam, viewW, viewH, beam.x2, beam.y2);
  const widthPx = Math.max(2, beam.widthM * cam.zoom);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = selected ? COLORS.beamSelected : COLORS.beam;
  ctx.lineWidth = widthPx;
  ctx.globalAlpha = hovered && !selected ? 0.85 : 1;
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (selected) {
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawColumn(
  ctx: CanvasRenderingContext2D,
  column: ColumnEntity,
  cam: CameraState,
  viewW: number,
  viewH: number,
  selected: boolean,
  hovered: boolean
) {
  const corners = getColumnCorners(column);
  ctx.beginPath();
  for (let i = 0; i < corners.length; i++) {
    const s = worldToScreen(cam, viewW, viewH, corners[i].x, corners[i].y);
    if (i === 0) ctx.moveTo(s.sx, s.sy);
    else ctx.lineTo(s.sx, s.sy);
  }
  ctx.closePath();
  ctx.fillStyle = selected ? COLORS.columnSelected : COLORS.columnFill;
  ctx.fill();
  ctx.strokeStyle = COLORS.obsidian;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.stroke();
  if (hovered && !selected) {
    ctx.strokeStyle = COLORS.hover;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  cam: CameraState,
  viewW: number,
  viewH: number
) {
  const r = 4;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = COLORS.obsidian;
  ctx.lineWidth = 1.5;
  const drawDot = (x: number, y: number) => {
    const s = worldToScreen(cam, viewW, viewH, x, y);
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  if (entity.type === 'beam') {
    drawDot(entity.x1, entity.y1);
    drawDot(entity.x2, entity.y2);
  } else if (entity.type === 'column') {
    for (const c of getColumnCorners(entity)) drawDot(c.x, c.y);
  } else {
    for (const p of entity.points) drawDot(p.x, p.y);
  }
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  preview: PreviewShape,
  cam: CameraState,
  viewW: number,
  viewH: number
) {
  ctx.strokeStyle = COLORS.preview;
  ctx.fillStyle = 'rgba(188, 113, 85, 0.10)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  if (preview.type === 'beam' && preview.start && preview.current) {
    const a = worldToScreen(cam, viewW, viewH, preview.start.x, preview.start.y);
    const b = worldToScreen(cam, viewW, viewH, preview.current.x, preview.current.y);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  } else if (preview.type === 'column' && preview.start && preview.current) {
    const a = worldToScreen(cam, viewW, viewH, preview.start.x, preview.start.y);
    const b = worldToScreen(cam, viewW, viewH, preview.current.x, preview.current.y);
    const x = Math.min(a.sx, b.sx);
    const y = Math.min(a.sy, b.sy);
    const w = Math.abs(b.sx - a.sx);
    const h = Math.abs(b.sy - a.sy);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  } else if (preview.type === 'slab' && preview.points && preview.points.length > 0) {
    ctx.beginPath();
    for (let i = 0; i < preview.points.length; i++) {
      const s = worldToScreen(cam, viewW, viewH, preview.points[i].x, preview.points[i].y);
      if (i === 0) ctx.moveTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    if (preview.current) {
      const s = worldToScreen(cam, viewW, viewH, preview.current.x, preview.current.y);
      ctx.lineTo(s.sx, s.sy);
    }
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.preview;
    for (const pt of preview.points) {
      const s = worldToScreen(cam, viewW, viewH, pt.x, pt.y);
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.setLineDash([]);
}

function drawSnapMarker(ctx: CanvasRenderingContext2D, snap: SnapResult, cam: CameraState, viewW: number, viewH: number) {
  if (snap.kind === 'none') return;
  const s = worldToScreen(cam, viewW, viewH, snap.point.x, snap.point.y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.snapMarker;
  ctx.fillStyle = '#ffffff';
  if (snap.kind === 'grid') {
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (snap.kind === 'endpoint' || snap.kind === 'intersection') {
    const r = 6;
    ctx.beginPath();
    ctx.rect(s.sx - r, s.sy - r, r * 2, r * 2);
    ctx.fill();
    ctx.stroke();
  } else if (snap.kind === 'midpoint') {
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(s.sx, s.sy - r);
    ctx.lineTo(s.sx + r, s.sy);
    ctx.lineTo(s.sx, s.sy + r);
    ctx.lineTo(s.sx - r, s.sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (snap.kind === 'ortho') {
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, world: { x: number; y: number }, cam: CameraState, viewW: number, viewH: number) {
  const s = worldToScreen(cam, viewW, viewH, world.x, world.y);
  ctx.strokeStyle = COLORS.cursorCross;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, Math.round(s.sy) + 0.5);
  ctx.lineTo(viewW, Math.round(s.sy) + 0.5);
  ctx.moveTo(Math.round(s.sx) + 0.5, 0);
  ctx.lineTo(Math.round(s.sx) + 0.5, viewH);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawEntityLabel(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  cam: CameraState,
  viewW: number,
  viewH: number
) {
  let anchor: { x: number; y: number };
  let text = entity.id.slice(-4).toUpperCase();
  if (entity.type === 'beam') {
    anchor = { x: (entity.x1 + entity.x2) / 2, y: (entity.y1 + entity.y2) / 2 };
    text = entity.props?.name ? String(entity.props.name) : `V-${text}`;
  } else if (entity.type === 'column') {
    anchor = { x: entity.cx, y: entity.cy };
    text = entity.props?.name ? String(entity.props.name) : `C-${text}`;
  } else {
    anchor = polygonCentroid(entity.points);
    text = entity.props?.name ? String(entity.props.name) : `L-${text}`;
  }
  const screen = worldToScreen(cam, viewW, viewH, anchor.x, anchor.y);
  ctx.save();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(text).width + 12;
  const height = 20;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(0,13,16,0.22)';
  ctx.beginPath();
  ctx.roundRect(screen.sx - width / 2, screen.sy - height / 2, width, height, 999);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.obsidian;
  ctx.fillText(text, screen.sx, screen.sy + 0.5);
  ctx.restore();
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  box: { start: { x: number; y: number }; current: { x: number; y: number } },
  cam: CameraState,
  viewW: number,
  viewH: number
) {
  const a = worldToScreen(cam, viewW, viewH, box.start.x, box.start.y);
  const b = worldToScreen(cam, viewW, viewH, box.current.x, box.current.y);
  const x = Math.min(a.sx, b.sx);
  const y = Math.min(a.sy, b.sy);
  const w = Math.abs(b.sx - a.sx);
  const h = Math.abs(b.sy - a.sy);
  ctx.save();
  ctx.fillStyle = 'rgba(188, 113, 85, 0.12)';
  ctx.strokeStyle = COLORS.preview;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, props: RenderProps) {
  const { state, cam, viewW, viewH, selectedIds, hoverId, preview, snap, cursorWorld, showCrosshair, selectionBox } = props;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, viewW, viewH);

  drawGrid(ctx, cam, viewW, viewH, { gridSizeM: state.grid.sizeM });

  if (showCrosshair && cursorWorld) drawCrosshair(ctx, cursorWorld, cam, viewW, viewH);

  const view = getViewportBounds(cam, viewW, viewH);
  const viewBox = { minX: view.minX, maxX: view.maxX, minY: view.minY, maxY: view.maxY };

  for (const slab of state.entities.slabs) {
    const bbox = entityBoundingBox(slab);
    if (!bboxIntersects(bbox, viewBox)) continue;
    const sel = isSelected({ type: 'slab', id: slab.id }, selectedIds);
    drawSlab(ctx, slab, cam, viewW, viewH, sel, hoverId === slab.id);
  }

  for (const beam of state.entities.beams) {
    const bbox = entityBoundingBox(beam);
    if (!bboxIntersects(bbox, viewBox)) continue;
    const sel = isSelected({ type: 'beam', id: beam.id }, selectedIds);
    drawBeam(ctx, beam, cam, viewW, viewH, sel, hoverId === beam.id);
  }

  for (const column of state.entities.columns) {
    const bbox = entityBoundingBox(column);
    if (!bboxIntersects(bbox, viewBox)) continue;
    const sel = isSelected({ type: 'column', id: column.id }, selectedIds);
    drawColumn(ctx, column, cam, viewW, viewH, sel, hoverId === column.id);
  }

  for (const slab of state.entities.slabs) {
    const bbox = entityBoundingBox(slab);
    if (!bboxIntersects(bbox, viewBox)) continue;
    drawEntityLabel(ctx, slab, cam, viewW, viewH);
  }
  for (const beam of state.entities.beams) {
    const bbox = entityBoundingBox(beam);
    if (!bboxIntersects(bbox, viewBox)) continue;
    drawEntityLabel(ctx, beam, cam, viewW, viewH);
  }
  for (const column of state.entities.columns) {
    const bbox = entityBoundingBox(column);
    if (!bboxIntersects(bbox, viewBox)) continue;
    drawEntityLabel(ctx, column, cam, viewW, viewH);
  }

  for (const slab of state.entities.slabs) {
    if (selectedIds.has(slab.id)) drawSelectionHandles(ctx, slab, cam, viewW, viewH);
  }
  for (const beam of state.entities.beams) {
    if (selectedIds.has(beam.id)) drawSelectionHandles(ctx, beam, cam, viewW, viewH);
  }
  for (const column of state.entities.columns) {
    if (selectedIds.has(column.id)) drawSelectionHandles(ctx, column, cam, viewW, viewH);
  }

  if (preview) drawPreview(ctx, preview, cam, viewW, viewH);
  if (selectionBox) drawSelectionBox(ctx, selectionBox, cam, viewW, viewH);

  if (snap) drawSnapMarker(ctx, snap, cam, viewW, viewH);
}
