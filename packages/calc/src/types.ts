export interface MaterialProps {
  fckMpa: number;
  fyMpa: number;
  phiFlexion: number;
  phiShear: number;
}

export type ElementType = 'slab' | 'beam' | 'column';

export interface ElementRef<TType extends ElementType = ElementType> {
  elementId: string;
  elementType: TType;
}

export type StructuralElementType = 'beam' | 'column' | 'slab';

export interface SlabInput {
  id: string;
  spanXm: number;
  spanYm: number;
  areaM2: number;
  thicknessM: number;
  deadLoadKnm2: number;
  liveLoadKnm2: number;
  loadTypologyCode: string;
  /** Polígono en planta (m) para visualización 3D. */
  points?: Array<{ x: number; y: number }>;
}

export interface BeamSlabContribution {
  slabId: string;
  tributaryWidthM: number;
}

export interface BeamInput {
  id?: string;
  spanM: number;
  widthM: number;
  depthM: number;
  slabContributions: BeamSlabContribution[];
  selfWeightKnm?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface ColumnInput {
  id?: string;
  cx?: number;
  cy?: number;
  widthM: number;
  depthM: number;
  floors: number;
  selfWeightKnm?: number;
  /** Momento de primer orden (kN·m); flexión columnas (flexo-compresión simplificada). */
  momentKnm?: number;
}

export interface BuildingInput {
  slabs: SlabInput[];
  beams: BeamInput[];
  columns: ColumnInput[];
  materials: MaterialProps;
}

export interface SlabLoadBreakdown {
  /** Compat legacy: conservar `id` para consumidores antiguos. */
  id: string;
  elementId: string;
  elementType: 'slab';
  D: number;
  L: number;
  qu: number;
}

export interface BeamLoadBreakdown extends ElementRef<'beam'> {
  lineLoadKnm: number;
}

export interface ColumnLoadBreakdown extends ElementRef<'column'> {
  axialLoadKn: number;
}

export interface LoadResult {
  slabs: SlabLoadBreakdown[];
  beams: BeamLoadBreakdown[];
  columns: ColumnLoadBreakdown[];
  /** Compat legacy: array por índice (mismo orden de `beams`). */
  beamLineLoadsKnm: number[];
  /** Compat legacy: array por índice (mismo orden de `columns`). */
  columnAxialLoadsKn: number[];
}

export interface SlabDemandBreakdown {
  /** Compat legacy: conservar `id` para consumidores antiguos. */
  id: string;
  elementId: string;
  elementType: 'slab';
  MuKnmPerM: number;
}

export interface BeamDemandBreakdown extends ElementRef<'beam'> {
  MuKnm: number;
  VuKn: number;
}

export interface ColumnDemandBreakdown extends ElementRef<'column'> {
  PuKn: number;
  MuKnm: number;
}

export interface DemandResult {
  slabs: SlabDemandBreakdown[];
  beams: BeamDemandBreakdown[];
  columns: ColumnDemandBreakdown[];
}

export interface FlexureDesignResult {
  rhoRequired: number;
  rhoMin: number;
  rhoUsed: number;
  isDuctile: boolean;
}

export interface ShearDesignResult {
  needsStirrups: boolean;
  sMaxMm: number;
}

export interface ColumnDesignResult {
  rhoGeomMin: number;
  rhoGeomMax: number;
  minBars: number;
  /** Indica si se aplicó verificación de interacción P-M simplificada. */
  interactionChecked: boolean;
}

export interface SlabDesignBreakdown extends ElementRef<'slab'>, FlexureDesignResult {}

export interface BeamDesignBreakdown extends ElementRef<'beam'> {
  flexion: FlexureDesignResult;
  shear: ShearDesignResult;
}

export interface ColumnDesignBreakdown extends ElementRef<'column'>, ColumnDesignResult {}

export interface DesignResult {
  slabs: SlabDesignBreakdown[];
  beams: BeamDesignBreakdown[];
  columns: ColumnDesignBreakdown[];
}
