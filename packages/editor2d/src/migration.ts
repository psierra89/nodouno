import {
  DEFAULT_BEAM_SECTION,
  DEFAULT_COLUMN_SECTION,
  DEFAULT_DRAWING_STATE,
  DEFAULT_SLAB_THICKNESS,
  type BeamEntity,
  type ColumnEntity,
  type DrawingState,
  type SlabEntity
} from './types';
import { nextId } from './ids';

/**
 * Conversion legacy: en versiones <=3 las coordenadas estaban en pixeles del canvas
 * con una grilla por defecto de 20 px. Asumimos `1 m = 20 px` para migrar a metros.
 */
const LEGACY_PX_PER_M = 20;

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pxToM(px: unknown, scalePxPerM: number): number {
  const n = toNumber(px, 0);
  return n / scalePxPerM;
}

interface LegacyEntities {
  columns?: unknown[];
  beams?: unknown[];
  slabs?: unknown[];
}

function isPoint(p: unknown): p is { x: number; y: number } {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  return typeof r.x === 'number' && typeof r.y === 'number' && Number.isFinite(r.x) && Number.isFinite(r.y);
}

function pickProps(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

/**
 * Lee `entities` (forma `shape`) o `freeDrawing` (forma `type`), tolerando ambos.
 */
function migrateLegacyEntities(legacy: LegacyEntities | undefined, scalePxPerM: number): DrawingState['entities'] {
  const columns: ColumnEntity[] = [];
  const beams: BeamEntity[] = [];
  const slabs: SlabEntity[] = [];

  for (const c of legacy?.columns ?? []) {
    if (!c || typeof c !== 'object') continue;
    const lc = c as Record<string, unknown>;
    const props = pickProps(lc.props);
    const xPx = toNumber(lc.startX ?? lc.x, 0);
    const yPx = toNumber(lc.startY ?? lc.y, 0);
    const wPx = toNumber(lc.widthPx ?? lc.width, scalePxPerM);
    const hPx = toNumber(lc.heightPx ?? lc.height, scalePxPerM);
    columns.push({
      id: nextId('col'),
      type: 'column',
      cx: pxToM(xPx + wPx / 2, scalePxPerM),
      cy: pxToM(yPx + hPx / 2, scalePxPerM),
      widthM: toNumber(lc.widthM ?? props.widthM, DEFAULT_COLUMN_SECTION.widthM),
      depthM: toNumber(lc.depthM ?? props.depthM, DEFAULT_COLUMN_SECTION.depthM),
      rotation: 0,
      props: {}
    });
  }

  for (const b of legacy?.beams ?? []) {
    if (!b || typeof b !== 'object') continue;
    const lb = b as Record<string, unknown>;
    const props = pickProps(lb.props);
    const x1 = toNumber(lb.startX ?? lb.x1, 0);
    const y1 = toNumber(lb.startY ?? lb.y1, 0);
    const x2 = toNumber(lb.endX ?? lb.x2, 0);
    const y2 = toNumber(lb.endY ?? lb.y2, 0);
    beams.push({
      id: nextId('beam'),
      type: 'beam',
      x1: pxToM(x1, scalePxPerM),
      y1: pxToM(y1, scalePxPerM),
      x2: pxToM(x2, scalePxPerM),
      y2: pxToM(y2, scalePxPerM),
      widthM: toNumber(lb.widthM ?? props.widthM, DEFAULT_BEAM_SECTION.widthM),
      depthM: toNumber(lb.depthM ?? props.depthM, DEFAULT_BEAM_SECTION.depthM),
      props: {}
    });
  }

  for (const s of legacy?.slabs ?? []) {
    if (!s || typeof s !== 'object') continue;
    const ls = s as Record<string, unknown>;
    const props = pickProps(ls.props);
    const isPoly = ls.type === 'polygon' || ls.shape === 'polygon';
    const isRect = ls.type === 'rect' || ls.shape === 'rect';
    const thicknessM = toNumber(ls.thicknessM ?? props.thicknessM, DEFAULT_SLAB_THICKNESS);
    if (isPoly) {
      const rawPoints = Array.isArray(ls.points) ? (ls.points as unknown[]) : [];
      const pts = rawPoints
        .filter(isPoint)
        .map((p) => ({ x: pxToM(p.x, scalePxPerM), y: pxToM(p.y, scalePxPerM) }));
      if (pts.length >= 3) {
        slabs.push({ id: nextId('slab'), type: 'slab', points: pts, thicknessM, props: {} });
      }
    } else if (isRect) {
      const x = toNumber(ls.startX ?? ls.x, 0);
      const y = toNumber(ls.startY ?? ls.y, 0);
      const endX = ls.endX !== undefined ? toNumber(ls.endX, 0) : x + toNumber(ls.width, 0);
      const endY = ls.endY !== undefined ? toNumber(ls.endY, 0) : y + toNumber(ls.height, 0);
      const xa = pxToM(Math.min(x, endX), scalePxPerM);
      const xb = pxToM(Math.max(x, endX), scalePxPerM);
      const ya = pxToM(Math.min(y, endY), scalePxPerM);
      const yb = pxToM(Math.max(y, endY), scalePxPerM);
      slabs.push({
        id: nextId('slab'),
        type: 'slab',
        points: [
          { x: xa, y: ya },
          { x: xb, y: ya },
          { x: xb, y: yb },
          { x: xa, y: yb }
        ],
        thicknessM,
        props: {}
      });
    }
  }

  return { columns, beams, slabs };
}

interface V4Entities {
  columns?: unknown[];
  beams?: unknown[];
  slabs?: unknown[];
}

function normaliseV4Entities(input: V4Entities | undefined): DrawingState['entities'] {
  const columns: ColumnEntity[] = [];
  const beams: BeamEntity[] = [];
  const slabs: SlabEntity[] = [];
  for (const c of input?.columns ?? []) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    columns.push({
      id: typeof r.id === 'string' ? r.id : nextId('col'),
      type: 'column',
      cx: toNumber(r.cx, 0),
      cy: toNumber(r.cy, 0),
      widthM: toNumber(r.widthM, DEFAULT_COLUMN_SECTION.widthM),
      depthM: toNumber(r.depthM, DEFAULT_COLUMN_SECTION.depthM),
      rotation: toNumber(r.rotation, 0),
      props: (r.props as Record<string, unknown>) ?? {}
    });
  }
  for (const b of input?.beams ?? []) {
    if (!b || typeof b !== 'object') continue;
    const r = b as Record<string, unknown>;
    beams.push({
      id: typeof r.id === 'string' ? r.id : nextId('beam'),
      type: 'beam',
      x1: toNumber(r.x1, 0),
      y1: toNumber(r.y1, 0),
      x2: toNumber(r.x2, 0),
      y2: toNumber(r.y2, 0),
      widthM: toNumber(r.widthM, DEFAULT_BEAM_SECTION.widthM),
      depthM: toNumber(r.depthM, DEFAULT_BEAM_SECTION.depthM),
      props: (r.props as Record<string, unknown>) ?? {}
    });
  }
  for (const s of input?.slabs ?? []) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const rawPoints = Array.isArray(r.points) ? (r.points as unknown[]) : [];
    const pts = rawPoints.filter(isPoint).map((p) => ({ x: p.x, y: p.y }));
    if (pts.length < 3) continue;
    slabs.push({
      id: typeof r.id === 'string' ? r.id : nextId('slab'),
      type: 'slab',
      points: pts,
      thicknessM: toNumber(r.thicknessM, DEFAULT_SLAB_THICKNESS),
      props: (r.props as Record<string, unknown>) ?? {}
    });
  }
  return { columns, beams, slabs };
}

/**
 * Migra cualquier `drawing_data` previo a la forma v4 (geometria en metros).
 * Tolera versiones 1-3 (canvas en pixeles con `entities`/`freeDrawing`) y v4 directa.
 */
export function migrateDrawingData(raw: unknown): DrawingState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DRAWING_STATE, createdAt: new Date().toISOString() };
  }
  const r = raw as Record<string, unknown>;
  const version = toNumber(r.version, 1);

  if (version >= 4) {
    const grid = r.grid as Record<string, unknown> | undefined;
    return {
      version: 4,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
      grid: {
        sizeM: toNumber(grid?.sizeM, 0.1),
        snapEnabled: grid?.snapEnabled !== false,
        orthoEnabled: grid?.orthoEnabled === true
      },
      entities: normaliseV4Entities(r.entities as V4Entities | undefined)
    };
  }

  const grid = r.grid as Record<string, unknown> | undefined;
  const gridSizePx = toNumber(grid?.size, LEGACY_PX_PER_M);
  const scalePxPerM = gridSizePx > 0 ? gridSizePx : LEGACY_PX_PER_M;

  const legacyEntities = (r.entities as LegacyEntities | undefined) ?? (r.freeDrawing as LegacyEntities | undefined);

  let entities = migrateLegacyEntities(legacyEntities, scalePxPerM);
  if (
    entities.columns.length === 0 &&
    entities.beams.length === 0 &&
    entities.slabs.length === 0 &&
    r.entities &&
    typeof r.entities === 'object'
  ) {
    entities = normaliseV4Entities(r.entities as V4Entities);
  }

  return {
    version: 4,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    grid: {
      sizeM: 0.1,
      snapEnabled: grid?.snapEnabled !== false,
      orthoEnabled: false
    },
    entities
  };
}

/**
 * Genera la rep. legacy `freeDrawing` (pixeles) a partir del estado v4
 * para compatibilidad con lectores antiguos. Usa `1 m = 20 px`.
 */
export function toLegacyFreeDrawing(state: DrawingState): {
  columns: Array<{ startX: number; startY: number; widthPx: number; heightPx: number; widthM: number; depthM: number }>;
  beams: Array<{ startX: number; startY: number; endX: number; endY: number; widthM: number; depthM: number }>;
  slabs: Array<
    | { type: 'rect'; startX: number; startY: number; endX: number; endY: number; thicknessM: number }
    | { type: 'polygon'; points: Array<{ x: number; y: number }>; thicknessM: number }
  >;
} {
  const s = LEGACY_PX_PER_M;
  return {
    columns: state.entities.columns.map((c) => ({
      startX: (c.cx - c.widthM / 2) * s,
      startY: (c.cy - c.depthM / 2) * s,
      widthPx: c.widthM * s,
      heightPx: c.depthM * s,
      widthM: c.widthM,
      depthM: c.depthM
    })),
    beams: state.entities.beams.map((b) => ({
      startX: b.x1 * s,
      startY: b.y1 * s,
      endX: b.x2 * s,
      endY: b.y2 * s,
      widthM: b.widthM,
      depthM: b.depthM
    })),
    slabs: state.entities.slabs.map((sl) => ({
      type: 'polygon',
      points: sl.points.map((p) => ({ x: p.x * s, y: p.y * s })),
      thicknessM: sl.thicknessM
    }))
  };
}
