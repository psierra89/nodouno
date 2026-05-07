export interface MaterialProps {
  fckMpa: number;
  fyMpa: number;
  phiFlexion: number;
  phiShear: number;
}

export interface SlabInput {
  spanM: number;
  thicknessM: number;
  deadLoadKnm2: number;
  liveLoadKnm2: number;
}

export interface BeamInput {
  spanM: number;
  widthM: number;
  depthM: number;
  tributaryWidthM: number;
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
  slab: SlabInput;
  beams: BeamInput[];
  columns: ColumnInput[];
  materials: MaterialProps;
}

export interface LoadResult {
  slabDkNm2: number;
  slabLkNm2: number;
  slabUltimateQkNm2: number;
  beamLineLoadsKnm: number[];
  columnAxialLoadsKn: number[];
}

export interface DemandResult {
  slabMuKnmPerM: number;
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
  slab: FlexureDesignResult;
  beams: Array<{
    flexion: FlexureDesignResult;
    shear: ShearDesignResult;
  }>;
  columns: ColumnDesignResult[];
}
