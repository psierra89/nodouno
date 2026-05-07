import type { ColumnEntity, DrawingState, Entity, EntityRef, SlabEntity } from './types';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function entityBoundingBox(entity: Entity): BoundingBox {
  if (entity.type === 'column') {
    const hw = entity.widthM / 2;
    const hd = entity.depthM / 2;
    return {
      minX: entity.cx - hw,
      maxX: entity.cx + hw,
      minY: entity.cy - hd,
      maxY: entity.cy + hd
    };
  }
  if (entity.type === 'beam') {
    const pad = Math.max(entity.widthM, 0.05) / 2;
    return {
      minX: Math.min(entity.x1, entity.x2) - pad,
      maxX: Math.max(entity.x1, entity.x2) + pad,
      minY: Math.min(entity.y1, entity.y2) - pad,
      maxY: Math.max(entity.y1, entity.y2) + pad
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of entity.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

export function distancePointToSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

export function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const denom = yj - yi;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (Math.abs(denom) < 1e-12 ? 1e-12 : denom) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area) / 2;
}

export function polygonCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j].x * points[i].y - points[i].x * points[j].y;
    a += cross;
    cx += (points[j].x + points[i].x) * cross;
    cy += (points[j].y + points[i].y) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function isPointInsideEntity(point: { x: number; y: number }, entity: Entity, toleranceM: number): boolean {
  if (entity.type === 'column') {
    const hw = entity.widthM / 2;
    const hd = entity.depthM / 2;
    return (
      point.x >= entity.cx - hw - toleranceM &&
      point.x <= entity.cx + hw + toleranceM &&
      point.y >= entity.cy - hd - toleranceM &&
      point.y <= entity.cy + hd + toleranceM
    );
  }
  if (entity.type === 'beam') {
    const d = distancePointToSegment(point, { x: entity.x1, y: entity.y1 }, { x: entity.x2, y: entity.y2 });
    return d <= toleranceM + entity.widthM / 2;
  }
  return pointInPolygon(point, entity.points);
}

/** Encuentra la entidad mas cercana al punto (en orden columnas > vigas > losas). */
export function hitTest(
  point: { x: number; y: number },
  state: DrawingState,
  toleranceM: number
): EntityRef | null {
  for (let i = state.entities.columns.length - 1; i >= 0; i--) {
    const c = state.entities.columns[i];
    if (isPointInsideEntity(point, c, toleranceM)) return { type: 'column', id: c.id };
  }
  for (let i = state.entities.beams.length - 1; i >= 0; i--) {
    const b = state.entities.beams[i];
    if (isPointInsideEntity(point, b, toleranceM)) return { type: 'beam', id: b.id };
  }
  for (let i = state.entities.slabs.length - 1; i >= 0; i--) {
    const s = state.entities.slabs[i];
    if (pointInPolygon(point, s.points)) return { type: 'slab', id: s.id };
  }
  return null;
}

export function getColumnCorners(c: ColumnEntity): Array<{ x: number; y: number }> {
  const hw = c.widthM / 2;
  const hd = c.depthM / 2;
  const cos = Math.cos(c.rotation);
  const sin = Math.sin(c.rotation);
  const local: Array<[number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd]
  ];
  return local.map(([lx, ly]) => ({
    x: c.cx + lx * cos - ly * sin,
    y: c.cy + lx * sin + ly * cos
  }));
}

export function findEntity(state: DrawingState, ref: EntityRef): Entity | null {
  if (ref.type === 'column') return state.entities.columns.find((c) => c.id === ref.id) ?? null;
  if (ref.type === 'beam') return state.entities.beams.find((b) => b.id === ref.id) ?? null;
  return state.entities.slabs.find((s) => s.id === ref.id) ?? null;
}

export function removeEntity(state: DrawingState, ref: EntityRef): DrawingState {
  if (ref.type === 'column') {
    return { ...state, entities: { ...state.entities, columns: state.entities.columns.filter((c) => c.id !== ref.id) } };
  }
  if (ref.type === 'beam') {
    return { ...state, entities: { ...state.entities, beams: state.entities.beams.filter((b) => b.id !== ref.id) } };
  }
  return { ...state, entities: { ...state.entities, slabs: state.entities.slabs.filter((s) => s.id !== ref.id) } };
}

export function translateEntity(entity: Entity, dx: number, dy: number): Entity {
  if (entity.type === 'column') return { ...entity, cx: entity.cx + dx, cy: entity.cy + dy };
  if (entity.type === 'beam') {
    return { ...entity, x1: entity.x1 + dx, y1: entity.y1 + dy, x2: entity.x2 + dx, y2: entity.y2 + dy };
  }
  return { ...entity, points: entity.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } as SlabEntity;
}

export function entityRefList(state: DrawingState): EntityRef[] {
  const refs: EntityRef[] = [];
  for (const c of state.entities.columns) refs.push({ type: 'column', id: c.id });
  for (const b of state.entities.beams) refs.push({ type: 'beam', id: b.id });
  for (const s of state.entities.slabs) refs.push({ type: 'slab', id: s.id });
  return refs;
}

/** Roundea un numero a una cantidad fija de digitos sin generar arrays innecesarios. */
export function round(value: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
