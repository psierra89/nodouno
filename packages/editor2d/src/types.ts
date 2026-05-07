export type EntityType = 'column' | 'beam' | 'slab';

export interface BaseEntity {
  id: string;
  type: EntityType;
  props: { material?: string; [key: string]: unknown };
}

export interface ColumnEntity extends BaseEntity {
  type: 'column';
  /** Centro en metros (x, y). */
  cx: number;
  cy: number;
  /** Ancho de seccion en metros (eje local X). */
  widthM: number;
  /** Profundidad de seccion en metros (eje local Y). */
  depthM: number;
  /** Rotacion en radianes alrededor del centro. */
  rotation: number;
}

export interface BeamEntity extends BaseEntity {
  type: 'beam';
  /** Extremo 1 en metros. */
  x1: number;
  y1: number;
  /** Extremo 2 en metros. */
  x2: number;
  y2: number;
  /** Ancho de seccion en metros. */
  widthM: number;
  /** Canto en metros. */
  depthM: number;
}

export interface SlabEntity extends BaseEntity {
  type: 'slab';
  /** Poligono cerrado en metros. Minimo 3 puntos. */
  points: Array<{ x: number; y: number }>;
  /** Espesor en metros. */
  thicknessM: number;
}

export type Entity = ColumnEntity | BeamEntity | SlabEntity;

export interface EntityRef {
  type: EntityType;
  id: string;
}

export interface DrawingState {
  version: 4;
  createdAt: string;
  grid: {
    /** Tamano de celda menor (m). Por defecto 0.1 m. */
    sizeM: number;
    /** Snap a grilla activo. */
    snapEnabled: boolean;
    /** Modo ortogonal activo. */
    orthoEnabled: boolean;
  };
  entities: {
    columns: ColumnEntity[];
    beams: BeamEntity[];
    slabs: SlabEntity[];
  };
}

export interface CameraState {
  /** Coordenada mundial (m) en el centro de la vista. */
  x: number;
  y: number;
  /** Pixeles por metro. */
  zoom: number;
}

/**
 * Resultado de snap. `point` esta en metros, `kind` indica el tipo de snap activo.
 */
export type SnapKind = 'none' | 'grid' | 'endpoint' | 'midpoint' | 'intersection' | 'ortho';
export interface SnapResult {
  point: { x: number; y: number };
  kind: SnapKind;
}

export type ToolKind = 'select' | 'pan' | 'beam' | 'column' | 'slab';

export interface PreviewShape {
  type: 'beam' | 'column' | 'slab';
  /** Punto inicial de la operacion en metros. */
  start?: { x: number; y: number };
  /** Punto actual del cursor (con snap aplicado) en metros. */
  current?: { x: number; y: number };
  /** Para slab: vertices ya colocados. */
  points?: Array<{ x: number; y: number }>;
}

export const DEFAULT_DRAWING_STATE: DrawingState = {
  version: 4,
  createdAt: '',
  grid: { sizeM: 0.1, snapEnabled: true, orthoEnabled: false },
  entities: { columns: [], beams: [], slabs: [] }
};

export const DEFAULT_COLUMN_SECTION = { widthM: 0.35, depthM: 0.35 };
export const DEFAULT_BEAM_SECTION = { widthM: 0.25, depthM: 0.5 };
export const DEFAULT_SLAB_THICKNESS = 0.2;
