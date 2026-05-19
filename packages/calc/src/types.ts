export interface MaterialProps {
  fckMpa: number;
  fyMpa: number;
  phiFlexion: number;
  phiShear: number;
}

export interface SlabInput {
  id: string;
  spanXm: number;
  spanYm: number;
  areaM2: number;
  thicknessM: number;
  deadLoadKnm2: number;
  liveLoadKnm2: number;
  loadTypologyCode: string;
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
}

export interface ColumnInput {
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
  id: string;
  D: number;
  L: number;
  qu: number;
}

export interface LoadResult {
  slabs: SlabLoadBreakdown[];
  beamLineLoadsKnm: number[];
  columnAxialLoadsKn: number[];
}

export interface SlabDemandBreakdown {
  id: string;
  MuKnmPerM: number;
}

export interface DemandResult {
  slabs: SlabDemandBreakdown[];
  beams: Array<{
    MuKnm: number;
    VuKn: number;
  }>;
  columns: Array<{
    PuKn: number;
    MuKnm: number;
  }>;
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

export interface DesignResult {
  slabs: FlexureDesignResult[];
  beams: Array<{
    flexion: FlexureDesignResult;
    shear: ShearDesignResult;
  }>;
  columns: ColumnDesignResult[];
}
