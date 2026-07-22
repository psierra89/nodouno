import { z } from 'zod';

const numberSchema = z.number().finite();

export const slabLoadBreakdownSchema = z.object({
  id: z.string().min(1),
  elementId: z.string().min(1),
  elementType: z.literal('slab'),
  D: numberSchema,
  L: numberSchema,
  qu: numberSchema
});

export const beamLoadBreakdownSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.literal('beam'),
  lineLoadKnm: numberSchema
});

export const columnLoadBreakdownSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.literal('column'),
  axialLoadKn: numberSchema
});

export const loadResultSchema = z.object({
  slabs: z.array(slabLoadBreakdownSchema),
  beams: z.array(beamLoadBreakdownSchema),
  columns: z.array(columnLoadBreakdownSchema),
  beamLineLoadsKnm: z.array(numberSchema),
  columnAxialLoadsKn: z.array(numberSchema)
});

export const slabDemandBreakdownSchema = z.object({
  id: z.string().min(1),
  elementId: z.string().min(1),
  elementType: z.literal('slab'),
  MuKnmPerM: numberSchema
});

export const beamDemandBreakdownSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.literal('beam'),
  MuKnm: numberSchema,
  VuKn: numberSchema
});

export const columnDemandBreakdownSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.literal('column'),
  PuKn: numberSchema,
  MuKnm: numberSchema
});

export const demandResultSchema = z.object({
  slabs: z.array(slabDemandBreakdownSchema),
  beams: z.array(beamDemandBreakdownSchema),
  columns: z.array(columnDemandBreakdownSchema)
});

export const flexureDesignResultSchema = z.object({
  rhoRequired: numberSchema,
  rhoMin: numberSchema,
  rhoUsed: numberSchema,
  isDuctile: z.boolean()
});

export const shearDesignResultSchema = z.object({
  needsStirrups: z.boolean(),
  sMaxMm: numberSchema
});

export const columnDesignResultSchema = z.object({
  rhoGeomMin: numberSchema,
  rhoGeomMax: numberSchema,
  minBars: z.number().int(),
  interactionChecked: z.boolean()
});

export const slabDesignBreakdownSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.literal('slab'),
  rhoRequired: numberSchema,
  rhoMin: numberSchema,
  rhoUsed: numberSchema,
  isDuctile: z.boolean()
});

export const beamDesignBreakdownSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.literal('beam'),
  flexion: flexureDesignResultSchema,
  shear: shearDesignResultSchema
});

export const columnDesignBreakdownSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.literal('column'),
  rhoGeomMin: numberSchema,
  rhoGeomMax: numberSchema,
  minBars: z.number().int(),
  interactionChecked: z.boolean()
});

/** Snapshot persistido en `projects.calculations`. */
export const calculationsSnapshotSchema = z.object({
  loads: loadResultSchema,
  demands: demandResultSchema
});

/** Snapshot persistido en `projects.dimensioning`. */
export const dimensioningSnapshotSchema = z.object({
  slabs: z.array(slabDesignBreakdownSchema),
  beams: z.array(beamDesignBreakdownSchema),
  columns: z.array(columnDesignBreakdownSchema)
});

export const runPipelineResultSchema = z.object({
  calculations: calculationsSnapshotSchema,
  dimensioning: dimensioningSnapshotSchema
});

export type ElementType = z.infer<typeof elementTypeSchema>;
export type CalculationsSnapshot = z.infer<typeof calculationsSnapshotSchema>;
export type DimensioningSnapshot = z.infer<typeof dimensioningSnapshotSchema>;
export type RunPipelineResult = z.infer<typeof runPipelineResultSchema>;
