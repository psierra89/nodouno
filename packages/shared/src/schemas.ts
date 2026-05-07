import { z } from 'zod';

/** Snapshot de resultados de cálculo persistidos en `projects.calculations`. */
export const calculationsSnapshotSchema = z.object({
  loads: z.unknown(),
  demands: z.unknown()
});

export type CalculationsSnapshot = z.infer<typeof calculationsSnapshotSchema>;
