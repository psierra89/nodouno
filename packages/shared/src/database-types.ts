import type { ProjectSpecs } from './specs';
import type { ProjectStatus } from './project-status';

/**
 * Fila `projects` alineada con Supabase.
 * Los JSONB se tipan de forma flexible hasta que el motor los normalice por completo.
 */
export type ProjectsRow = {
  id: string;
  user_id: string;
  name: string;
  status: ProjectStatus | string;
  drawing_data: unknown;
  simplified_model: unknown;
  calculations: unknown;
  dimensioning: unknown;
  specs: ProjectSpecs | null;
  created_at?: string;
  updated_at?: string;
};
