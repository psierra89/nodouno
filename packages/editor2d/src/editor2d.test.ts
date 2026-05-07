import { describe, expect, it } from 'vitest';
import { panByPixels, screenToWorld, worldToScreen, zoomAtCursor } from './camera';
import { computeSnap, snapToGrid } from './snap';
import { History } from './history';
import { migrateDrawingData, toLegacyFreeDrawing } from './migration';
import { deriveSimplifiedModel } from './derivedModel';
import { entityBoundingBox, hitTest, polygonArea, translateEntity } from './geometry';
import type { CameraState, DrawingState } from './types';

const baseCamera: CameraState = { x: 0, y: 0, zoom: 100 };

describe('camera', () => {
  it('worldToScreen y screenToWorld son inversos', () => {
    const screen = worldToScreen(baseCamera, 800, 600, 1.5, 2);
    const world = screenToWorld(baseCamera, 800, 600, screen.sx, screen.sy);
    expect(world.x).toBeCloseTo(1.5, 5);
    expect(world.y).toBeCloseTo(2, 5);
  });

  it('zoomAtCursor mantiene el punto bajo el cursor en mismo lugar mundial', () => {
    const sx = 200;
    const sy = 100;
    const before = screenToWorld(baseCamera, 800, 600, sx, sy);
    const next = zoomAtCursor(baseCamera, 800, 600, sx, sy, 2);
    const after = screenToWorld(next, 800, 600, sx, sy);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(next.zoom).toBeCloseTo(200, 5);
  });

  it('panByPixels desplaza la camara correctamente', () => {
    const next = panByPixels(baseCamera, 100, -50);
    expect(next.x).toBeCloseTo(-1, 5);
    expect(next.y).toBeCloseTo(0.5, 5);
  });
});

describe('snap', () => {
  it('snapToGrid alinea a multiplos de la grilla', () => {
    expect(snapToGrid({ x: 0.123, y: 0.456 }, 0.1)).toEqual({ x: 0.1, y: 0.5 });
    expect(snapToGrid({ x: -0.04, y: 0.06 }, 0.1)).toEqual({ x: -0, y: 0.1 });
  });

  it('computeSnap prioriza endpoints sobre la grilla', () => {
    const state: DrawingState = {
      version: 4,
      createdAt: '',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: {
        columns: [],
        beams: [
          {
            id: 'b1',
            type: 'beam',
            x1: 1,
            y1: 1,
            x2: 3,
            y2: 1,
            widthM: 0.25,
            depthM: 0.5,
            props: {}
          }
        ],
        slabs: []
      }
    };
    const result = computeSnap({ x: 0.97, y: 1.02 }, baseCamera, state);
    expect(result.kind).toBe('endpoint');
    expect(result.point.x).toBeCloseTo(1, 5);
    expect(result.point.y).toBeCloseTo(1, 5);

    const mid = computeSnap({ x: 2.0, y: 1.05 }, baseCamera, state);
    expect(mid.kind).toBe('midpoint');
    expect(mid.point.x).toBeCloseTo(2, 5);
  });

  it('computeSnap aplica grilla cuando no hay entidades cercanas', () => {
    const state: DrawingState = {
      version: 4,
      createdAt: '',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: { columns: [], beams: [], slabs: [] }
    };
    const result = computeSnap({ x: 0.345, y: -1.207 }, baseCamera, state);
    expect(result.kind).toBe('grid');
    expect(result.point.x).toBeCloseTo(0.3, 5);
    expect(result.point.y).toBeCloseTo(-1.2, 5);
  });
});

describe('history', () => {
  it('push, undo y redo se comportan como pila lineal', () => {
    const stateA: DrawingState = {
      version: 4,
      createdAt: '',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: { columns: [], beams: [], slabs: [] }
    };
    const stateB = { ...stateA, entities: { ...stateA.entities, columns: [
      { id: 'c1', type: 'column' as const, cx: 0, cy: 0, widthM: 0.35, depthM: 0.35, rotation: 0, props: {} }
    ] } };
    const h = new History(10);
    h.reset(stateA);
    h.push(stateB);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
    const undone = h.undo();
    expect(undone?.entities.columns.length).toBe(0);
    expect(h.canRedo()).toBe(true);
    const redone = h.redo();
    expect(redone?.entities.columns.length).toBe(1);
  });
});

describe('migration', () => {
  it('migra dibujo legacy en pixeles a metros (v4)', () => {
    const legacy = {
      version: 3,
      createdAt: '2026-01-01',
      grid: { size: 20, snapEnabled: true },
      entities: {
        columns: [
          {
            id: 'col_old',
            type: 'column',
            x: 100,
            y: 200,
            width: 20,
            height: 20,
            props: { widthM: 0.4, depthM: 0.4 }
          }
        ],
        beams: [
          {
            id: 'beam_old',
            type: 'beam',
            x1: 100,
            y1: 100,
            x2: 200,
            y2: 100,
            props: { widthM: 0.25, depthM: 0.5 }
          }
        ],
        slabs: [
          {
            id: 'slab_old',
            type: 'slab',
            shape: 'rect',
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            points: [],
            props: { thicknessM: 0.2 }
          }
        ]
      },
      freeDrawing: {
        columns: [{ startX: 100, startY: 200, widthPx: 20, heightPx: 20, widthM: 0.4, depthM: 0.4 }],
        beams: [{ startX: 100, startY: 100, endX: 200, endY: 100, widthM: 0.25, depthM: 0.5 }],
        slabs: [{ type: 'rect', startX: 0, startY: 0, endX: 200, endY: 100, thicknessM: 0.2 }]
      }
    };
    const migrated = migrateDrawingData(legacy);
    expect(migrated.version).toBe(4);
    expect(migrated.grid.sizeM).toBeCloseTo(0.1);
    expect(migrated.entities.columns).toHaveLength(1);
    expect(migrated.entities.beams).toHaveLength(1);
    expect(migrated.entities.slabs).toHaveLength(1);
    const beam = migrated.entities.beams[0];
    expect(beam.x1).toBeCloseTo(5, 5);
    expect(beam.x2).toBeCloseTo(10, 5);
    const slab = migrated.entities.slabs[0];
    expect(slab.points.length).toBe(4);
  });

  it('respeta drawing v4 ya migrado', () => {
    const v4: DrawingState = {
      version: 4,
      createdAt: '2026-01-01',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: {
        columns: [
          { id: 'c', type: 'column', cx: 1, cy: 2, widthM: 0.35, depthM: 0.35, rotation: 0, props: {} }
        ],
        beams: [],
        slabs: []
      }
    };
    const migrated = migrateDrawingData(v4);
    expect(migrated.entities.columns[0].cx).toBe(1);
    expect(migrated.entities.columns[0].cy).toBe(2);
  });

  it('toLegacyFreeDrawing devuelve representacion en pixeles', () => {
    const state: DrawingState = {
      version: 4,
      createdAt: '',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: {
        columns: [
          { id: 'c', type: 'column', cx: 1, cy: 1, widthM: 0.4, depthM: 0.4, rotation: 0, props: {} }
        ],
        beams: [
          { id: 'b', type: 'beam', x1: 0, y1: 0, x2: 5, y2: 0, widthM: 0.25, depthM: 0.5, props: {} }
        ],
        slabs: []
      }
    };
    const legacy = toLegacyFreeDrawing(state);
    expect(legacy.columns[0].startX).toBeCloseTo((1 - 0.2) * 20, 5);
    expect(legacy.beams[0].endX).toBeCloseTo(100, 5);
  });
});

describe('derivedModel', () => {
  it('deriva luces desde la mayor losa dibujada', () => {
    const state: DrawingState = {
      version: 4,
      createdAt: '',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: {
        columns: [],
        beams: [],
        slabs: [
          {
            id: 's1',
            type: 'slab',
            points: [
              { x: 0, y: 0 },
              { x: 6, y: 0 },
              { x: 6, y: 4 },
              { x: 0, y: 4 }
            ],
            thicknessM: 0.18,
            props: {}
          }
        ]
      }
    };
    const out = deriveSimplifiedModel(state, {
      spanX: 1,
      spanY: 1,
      thicknessM: 0.2,
      deadLoadKnm2: 1.5,
      liveLoadKnm2: 2
    });
    expect(out.source).toBe('derived_from_drawing');
    expect(out.beams[0].spanM).toBeCloseTo(6, 5);
    expect(out.beams[2].spanM).toBeCloseTo(4, 5);
    expect(out.slab.spanM).toBeCloseTo(6, 5);
    expect(out.slab.thicknessM).toBeCloseTo(0.18, 5);
  });

  it('usa fallback cuando no hay losas', () => {
    const empty: DrawingState = {
      version: 4,
      createdAt: '',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: { columns: [], beams: [], slabs: [] }
    };
    const out = deriveSimplifiedModel(empty, {
      spanX: 5,
      spanY: 4,
      thicknessM: 0.2,
      deadLoadKnm2: 1.5,
      liveLoadKnm2: 2
    });
    expect(out.source).toBe('fixed_mvp_rectangular');
    expect(out.beams[0].spanM).toBe(5);
  });
});

describe('geometry', () => {
  it('polygonArea calcula area absoluta', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 }
    ];
    expect(polygonArea(sq)).toBe(4);
  });

  it('hitTest detecta columna por punto interno', () => {
    const state: DrawingState = {
      version: 4,
      createdAt: '',
      grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
      entities: {
        columns: [
          { id: 'c1', type: 'column', cx: 0, cy: 0, widthM: 0.4, depthM: 0.4, rotation: 0, props: {} }
        ],
        beams: [],
        slabs: []
      }
    };
    expect(hitTest({ x: 0.1, y: 0 }, state, 0.01)?.id).toBe('c1');
    expect(hitTest({ x: 5, y: 5 }, state, 0.01)).toBeNull();
  });

  it('translateEntity desplaza por delta', () => {
    const beam = translateEntity(
      {
        id: 'b1',
        type: 'beam',
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 0,
        widthM: 0.25,
        depthM: 0.5,
        props: {}
      },
      0.5,
      0.25
    );
    if (beam.type === 'beam') {
      expect(beam.x1).toBe(0.5);
      expect(beam.y2).toBe(0.25);
    } else {
      throw new Error('expected beam');
    }
  });

  it('entityBoundingBox respeta seccion de columna', () => {
    const bb = entityBoundingBox({
      id: 'c1',
      type: 'column',
      cx: 1,
      cy: 1,
      widthM: 0.4,
      depthM: 0.6,
      rotation: 0,
      props: {}
    });
    expect(bb.minX).toBeCloseTo(0.8);
    expect(bb.maxY).toBeCloseTo(1.3);
  });
});
