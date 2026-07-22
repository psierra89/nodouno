import type { CameraState, DrawingState, SnapResult } from './types';
import { segmentIntersection } from './geometry';

const SNAP_PIXELS = 12;

export function snapToGrid(
  point: { x: number; y: number },
  gridM: number
): { x: number; y: number } {
  const g = Math.max(1e-6, gridM);
  return { x: Math.round(point.x / g) * g, y: Math.round(point.y / g) * g };
}

/**
 * Devuelve el punto de snap activo. Prioriza endpoints/midpoints sobre la grilla.
 * Si nada cumple el radio, devuelve el punto sin snap.
 */
export function computeSnap(
  worldPoint: { x: number; y: number },
  cam: CameraState,
  state: DrawingState
): SnapResult {
  const radiusW = SNAP_PIXELS / cam.zoom;
  let bestPoint = worldPoint;
  let bestKind: SnapResult['kind'] = 'none';
  let bestDistSq = radiusW * radiusW;
  const priority: Record<SnapResult['kind'], number> = {
    none: 0,
    grid: 1,
    midpoint: 2,
    endpoint: 3,
    intersection: 4,
    ortho: 5
  };

  const consider = (px: number, py: number, kind: SnapResult['kind']) => {
    const dx = px - worldPoint.x;
    const dy = py - worldPoint.y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq || (Math.abs(dSq - bestDistSq) < 1e-9 && priority[kind] > priority[bestKind])) {
      bestDistSq = dSq;
      bestPoint = { x: px, y: py };
      bestKind = kind;
    }
  };

  for (let i = 0; i < state.entities.beams.length; i++) {
    const b = state.entities.beams[i];
    consider(b.x1, b.y1, 'endpoint');
    consider(b.x2, b.y2, 'endpoint');
    consider((b.x1 + b.x2) * 0.5, (b.y1 + b.y2) * 0.5, 'midpoint');
  }
  for (let i = 0; i < state.entities.slabs.length; i++) {
    const s = state.entities.slabs[i];
    const pts = s.points;
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j];
      const b = pts[(j + 1) % pts.length];
      consider(a.x, a.y, 'endpoint');
      consider((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, 'midpoint');
    }
  }
  for (let i = 0; i < state.entities.columns.length; i++) {
    const c = state.entities.columns[i];
    consider(c.cx, c.cy, 'endpoint');
  }

  for (let i = 0; i < state.entities.beams.length; i++) {
    const a = state.entities.beams[i];
    for (let j = i + 1; j < state.entities.beams.length; j++) {
      const b = state.entities.beams[j];
      const point = segmentIntersection(
        { x: a.x1, y: a.y1 },
        { x: a.x2, y: a.y2 },
        { x: b.x1, y: b.y1 },
        { x: b.x2, y: b.y2 }
      );
      if (point) consider(point.x, point.y, 'intersection');
    }
  }

  for (const slab of state.entities.slabs) {
    for (let i = 0; i < slab.points.length; i++) {
      const a = slab.points[i];
      const b = slab.points[(i + 1) % slab.points.length];
      for (const beam of state.entities.beams) {
        const point = segmentIntersection(
          a,
          b,
          { x: beam.x1, y: beam.y1 },
          { x: beam.x2, y: beam.y2 }
        );
        if (point) consider(point.x, point.y, 'intersection');
      }
    }
  }

  if (bestKind !== 'none') {
    return { point: bestPoint, kind: bestKind };
  }

  if (state.grid.snapEnabled) {
    return { point: snapToGrid(worldPoint, state.grid.sizeM), kind: 'grid' };
  }

  return { point: worldPoint, kind: 'none' };
}

/**
 * Aplica snap ortogonal respecto de un punto base (h o v segun cual sea mas corto).
 */
export function applyOrtho(
  base: { x: number; y: number },
  point: { x: number; y: number }
): { x: number; y: number } {
  const dx = Math.abs(point.x - base.x);
  const dy = Math.abs(point.y - base.y);
  if (dx > dy) {
    return { x: point.x, y: base.y };
  }
  return { x: base.x, y: point.y };
}
