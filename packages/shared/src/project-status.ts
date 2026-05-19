import { z } from 'zod';

/** Estados persistidos en `projects.status` (Postgres enum o texto según migración). */
export const projectStatusSchema = z.enum([
  'draft',
  'drawn',
  'loaded',
  'calculated',
  'dimensioned'
]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/** Migra literales legacy desde DB o datos antiguos. */
export function normalizeProjectStatus(raw: unknown): ProjectStatus {
  if (raw === 'loads_defined') return 'loaded';
  if (
    raw === 'draft' ||
    raw === 'drawn' ||
    raw === 'loaded' ||
    raw === 'calculated' ||
    raw === 'dimensioned'
  ) {
    return raw;
  }
  return 'draft';
}

/**
 * Valor a escribir en Postgres cuando el enum `project_status` legacy
 * aún no incluye el literal `loaded` (usa `loads_defined`).
 */
export function projectStatusForDb(status: ProjectStatus): string {
  if (status === 'loaded') return 'loads_defined';
  return status;
}
