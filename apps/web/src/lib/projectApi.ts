import { supabase } from './supabase';
import { createTrpcClient, getPublicApiUrl } from './trpc';
import {
  calculationsSnapshotSchema,
  DEFAULT_PROJECT_SPECS,
  dimensioningSnapshotSchema,
  normalizeProjectSpecs,
  normalizeProjectStatus,
  projectStatusForDb,
  type ProjectSpecs,
  type ProjectStatus
} from '@nodouno/shared';

type RevisionRow = {
  id: string;
  version: number;
  comment?: string | null;
  created_at?: string | null;
};

export type RevisionDetail = {
  id: string;
  version: number;
  drawing_data?: unknown;
  simplified_model?: unknown;
  calculations?: unknown;
  dimensioning?: unknown;
  status?: ProjectStatus;
};

type ProjectRow = {
  id: string;
  name?: string | null;
  status?: string | null;
  specs?: unknown;
  created_at?: string;
  drawing_data?: unknown;
  simplified_model?: unknown;
  calculations?: unknown;
  dimensioning?: unknown;
  current_revision_id?: string | null;
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  specs: ProjectSpecs;
  created_at?: string;
};

export type ProjectDetail = ProjectSummary & {
  drawing_data?: unknown;
  simplified_model?: unknown;
  calculations?: unknown;
  dimensioning?: unknown;
  current_revision_id?: string | null;
};

export type ProjectPatch = {
  name?: string;
  drawing_data?: unknown;
  simplified_model?: unknown;
  calculations?: unknown;
  dimensioning?: unknown;
  specs?: unknown;
  status?: ProjectStatus;
};

const apiUrl = getPublicApiUrl();
const preferApi = Boolean(apiUrl);

const getTrpcClient = () =>
  createTrpcClient(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  });

function normalizeProject(row: ProjectRow): ProjectDetail {
  const calculations =
    row.calculations == null ? undefined : calculationsSnapshotSchema.safeParse(row.calculations).data;
  const dimensioning =
    row.dimensioning == null ? undefined : dimensioningSnapshotSchema.safeParse(row.dimensioning).data;

  return {
    id: row.id,
    name: row.name?.trim() || 'Proyecto sin titulo',
    status: normalizeProjectStatus(row.status),
    specs: normalizeProjectSpecs(row.specs),
    created_at: row.created_at,
    drawing_data: row.drawing_data,
    simplified_model: row.simplified_model,
    calculations,
    dimensioning,
    current_revision_id: row.current_revision_id ?? null
  };
}

function normalizePatch(patch: ProjectPatch): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (typeof patch.name === 'string') next.name = patch.name.trim();
  if (patch.drawing_data !== undefined) next.drawing_data = patch.drawing_data;
  if (patch.simplified_model !== undefined) next.simplified_model = patch.simplified_model;
  if (patch.calculations !== undefined) {
    next.calculations = calculationsSnapshotSchema.parse(patch.calculations);
  }
  if (patch.dimensioning !== undefined) {
    next.dimensioning = dimensioningSnapshotSchema.parse(patch.dimensioning);
  }
  if (patch.specs !== undefined) next.specs = normalizeProjectSpecs(patch.specs);
  if (patch.status !== undefined) next.status = projectStatusForDb(patch.status);
  return next;
}

export function apiIsEnabled(): boolean {
  return preferApi;
}

export async function requireSession() {
  if (!supabase) throw new Error('Cliente Supabase no inicializado.');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sesion requerida.');
  return data.session;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (preferApi) {
    const client = getTrpcClient();
    if (!client) throw new Error('API configurada pero cliente no inicializado.');
    const projects = await client.projects.list.query();
    return projects.map((project) => normalizeProject(project as ProjectRow));
  }

  const session = await requireSession();
  const { data, error } = await supabase!
    .from('projects')
    .select('id, name, status, created_at, specs')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((project) => normalizeProject(project as ProjectRow));
}

export async function getProject(id: string): Promise<ProjectDetail> {
  if (preferApi) {
    const client = getTrpcClient();
    if (!client) throw new Error('API configurada pero cliente no inicializado.');
    const project = await client.projects.get.query({ id });
    return normalizeProject(project as ProjectRow);
  }

  const session = await requireSession();
  const { data, error } = await supabase!
    .from('projects')
    .select('id, name, status, created_at, specs, drawing_data, simplified_model, calculations, dimensioning')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? 'Proyecto no encontrado.');
  return normalizeProject(data as ProjectRow);
}

export async function createProject(input: { name: string; specs?: unknown }) {
  const name = input.name.trim();
  const specs = normalizeProjectSpecs(input.specs ?? DEFAULT_PROJECT_SPECS);
  if (preferApi) {
    const client = getTrpcClient();
    if (!client) throw new Error('API configurada pero cliente no inicializado.');
    return client.projects.create.mutate({ name, specs });
  }

  const session = await requireSession();
  const { data, error } = await supabase!
    .from('projects')
    .insert({
      name,
      user_id: session.user.id,
      status: projectStatusForDb('draft'),
      specs
    })
    .select('id')
    .single();

  if (error) {
    if (/column .*specs.*does not exist/i.test(error.message)) {
      const retry = await supabase!
        .from('projects')
        .insert({
          name,
          user_id: session.user.id,
          status: projectStatusForDb('draft')
        })
        .select('id')
        .single();
      if (retry.error) throw new Error(retry.error.message);
      return retry.data;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function updateProject(id: string, patch: ProjectPatch) {
  const normalizedPatch = normalizePatch(patch);
  if (preferApi) {
    const client = getTrpcClient();
    if (!client) throw new Error('API configurada pero cliente no inicializado.');
    return client.projects.update.mutate({ id, patch: normalizedPatch });
  }

  const session = await requireSession();
  const { error } = await supabase!
    .from('projects')
    .update(normalizedPatch)
    .eq('id', id)
    .eq('user_id', session.user.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteProject(id: string) {
  if (preferApi) {
    const client = getTrpcClient();
    if (!client) throw new Error('API configurada pero cliente no inicializado.');
    return client.projects.delete.mutate({ id });
  }

  const session = await requireSession();
  const { error } = await supabase!.from('projects').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function listRevisions(projectId: string): Promise<RevisionRow[]> {
  const client = getTrpcClient();
  if (!client) throw new Error('Las revisiones requieren API disponible.');
  return client.revisions.list.query({ projectId });
}

export async function restoreRevision(projectId: string, revisionId: string): Promise<RevisionDetail> {
  const client = getTrpcClient();
  if (!client) throw new Error('Las revisiones requieren API disponible.');
  return client.revisions.restore.mutate({ projectId, revisionId });
}

export async function createRevisionSnapshot(input: {
  projectId: string;
  comment?: string;
  drawing_data?: unknown;
  simplified_model?: unknown;
  calculations?: unknown;
  dimensioning?: unknown;
}) {
  const client = getTrpcClient();
  if (!client) throw new Error('Las revisiones requieren API disponible.');
  return client.revisions.createSnapshot.mutate({
    ...input,
    calculations:
      input.calculations == null ? undefined : calculationsSnapshotSchema.parse(input.calculations),
    dimensioning:
      input.dimensioning == null ? undefined : dimensioningSnapshotSchema.parse(input.dimensioning)
  });
}

export async function exportProjectJson(projectId: string, revisionId?: string) {
  const client = getTrpcClient();
  if (!client) throw new Error('La exportación JSON requiere API disponible.');
  return client.exports.requestJson.mutate({ projectId, revisionId });
}

export async function runServerCalc(simplifiedModel: unknown) {
  const client = getTrpcClient();
  if (!client) throw new Error('El cálculo remoto requiere API disponible.');
  return client.calc.runPipeline.mutate({ simplifiedModel });
}

export async function listCatalogs() {
  const client = getTrpcClient();
  if (!client) {
    return {
      regulations: [{ code: 'CIRSOC_201', name: 'CIRSOC 201', version: '2016' }],
      steel: [{ code: 'ADN_420', description: 'Acero ADN420', fyMpa: 420 }],
      concrete: [
        { code: 'H25', description: 'Hormigon H25', fckMpa: 25 },
        { code: 'H30', description: 'Hormigon H30', fckMpa: 30 },
        { code: 'H35', description: 'Hormigon H35', fckMpa: 35 }
      ]
    };
  }
  const [regulations, steel, concrete] = await Promise.all([
    client.catalogs.regulations.query(),
    client.catalogs.steel.query(),
    client.catalogs.concrete.query()
  ]);
  return { regulations, steel, concrete };
}
