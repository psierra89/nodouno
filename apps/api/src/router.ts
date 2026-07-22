import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import {
  calculateDemands,
  calculateDesign,
  calculateLoads,
  normalizeBuildingInput
} from '@nodouno/calc';
import {
  calculationsSnapshotSchema,
  dimensioningSnapshotSchema,
  normalizeProjectSpecs,
  normalizeProjectStatus,
  projectSpecsSchema,
  projectStatusSchema,
  projectStatusForDb
} from '@nodouno/shared';
import type { TrpcContext } from './context';
import { buildTechnicalReportPdfBase64 } from './pdfReport';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  }
});

const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sesion requerida' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

const projectPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  drawing_data: z.unknown().optional(),
  simplified_model: z.unknown().optional(),
  calculations: z.unknown().optional(),
  dimensioning: z.unknown().optional(),
  specs: z.unknown().optional(),
  status: projectStatusSchema.optional()
});

export const appRouter = t.router({
  health: t.procedure.query(() => ({ ok: true as const, service: 'nodouno-api' })),

  catalogs: t.router({
    regulations: t.procedure.use(requireUser).query(async ({ ctx }) => {
      const { data, error } = await ctx.supabaseAdmin.from('regulations').select('*').order('code');
      if (error) {
        // Tabla ausente / no migrada: devolver catálogo mínimo en lugar de tumbar el editor.
        return [{ code: 'CIRSOC_201', name: 'CIRSOC 201', version: '2016', active: true }];
      }
      return data ?? [];
    }),
    concrete: t.procedure.use(requireUser).query(async ({ ctx }) => {
      const { data, error } = await ctx.supabaseAdmin.from('concrete_classes').select('*').order('code');
      if (error) {
        return [
          { code: 'H25', fck_mpa: 25, description: 'Hormigon H25' },
          { code: 'H30', fck_mpa: 30, description: 'Hormigon H30' },
          { code: 'H35', fck_mpa: 35, description: 'Hormigon H35' }
        ];
      }
      return data ?? [];
    }),
    steel: t.procedure.use(requireUser).query(async ({ ctx }) => {
      const { data, error } = await ctx.supabaseAdmin.from('steel_classes').select('*').order('code');
      if (error) {
        return [{ code: 'ADN_420', fy_mpa: 420, description: 'Acero ADN420' }];
      }
      return data ?? [];
    })
  }),

  projects: t.router({
    list: t.procedure.use(requireUser).query(async ({ ctx }) => {
      const { data, error } = await ctx.supabaseAdmin
        .from('projects')
        .select('id, name, status, created_at, specs')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return (data ?? []).map((row: { status?: string; specs?: unknown }) => ({
        ...row,
        status: normalizeProjectStatus(row.status),
        specs: normalizeProjectSpecs(row.specs)
      }));
    }),

    get: t.procedure.use(requireUser).input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', input.id)
        .eq('user_id', ctx.userId)
        .maybeSingle();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
      return {
        ...data,
        status: normalizeProjectStatus(data.status),
        specs: normalizeProjectSpecs(data.specs)
      };
    }),

    create: t.procedure
      .use(requireUser)
      .input(
        z.object({
          name: z.string().min(1).max(120),
          specs: projectSpecsSchema.optional()
        })
      )
      .mutation(async ({ ctx, input }) => {
        const specs = normalizeProjectSpecs(input.specs ?? {});
        const { data, error } = await ctx.supabaseAdmin
          .from('projects')
          .insert({
            name: input.name,
            user_id: ctx.userId,
            status: 'draft',
            specs
          })
          .select('id')
          .single();
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data!;
      }),

    update: t.procedure
      .use(requireUser)
      .input(
        z.object({
          id: z.string().uuid(),
          patch: projectPatchSchema
        })
      )
      .mutation(async ({ ctx, input }) => {
        const patch = sanitizeProjectPatch(input.patch);
        const { error } = await ctx.supabaseAdmin
          .from('projects')
          .update(patch)
          .eq('id', input.id)
          .eq('user_id', ctx.userId);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        await writeAuditLog(ctx, ctx.userId, input.id, 'project.updated', { keys: Object.keys(patch) });
        return { ok: true as const };
      }),

    delete: t.procedure
      .use(requireUser)
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await ctx.supabaseAdmin
          .from('projects')
          .delete()
          .eq('id', input.id)
          .eq('user_id', ctx.userId);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        await writeAuditLog(ctx, ctx.userId, input.id, 'project.deleted', {});
        return { ok: true as const };
      })
  }),

  revisions: t.router({
    list: t.procedure
      .use(requireUser)
      .input(z.object({ projectId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await assertProjectOwned(ctx, input.projectId);
        const { data, error } = await ctx.supabaseAdmin
          .from('project_revisions')
          .select('id, version, comment, created_at')
          .eq('project_id', input.projectId)
          .order('version', { ascending: false });
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        return data ?? [];
      }),

    createSnapshot: t.procedure
      .use(requireUser)
      .input(
        z.object({
          projectId: z.string().uuid(),
          comment: z.string().max(500).optional(),
          drawing_data: z.unknown().optional(),
          simplified_model: z.unknown().optional(),
          calculations: z.unknown().optional(),
          dimensioning: z.unknown().optional()
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertProjectOwned(ctx, input.projectId);
        const { data: maxRow } = await ctx.supabaseAdmin
          .from('project_revisions')
          .select('version')
          .eq('project_id', input.projectId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextVersion = (maxRow?.version ?? 0) + 1;
        const { data, error } = await ctx.supabaseAdmin
          .from('project_revisions')
          .insert({
            project_id: input.projectId,
            version: nextVersion,
            drawing_data: input.drawing_data ?? null,
            simplified_model: input.simplified_model ?? null,
            calculations: input.calculations ?? null,
            dimensioning: input.dimensioning ?? null,
            comment: input.comment ?? null,
            created_by: ctx.userId
          })
          .select('id, version')
          .single();
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        await ctx.supabaseAdmin
          .from('projects')
          .update({ current_revision_id: data!.id })
          .eq('id', input.projectId)
          .eq('user_id', ctx.userId);
        await writeAuditLog(ctx, ctx.userId, input.projectId, 'revision.created', { revisionId: data!.id, version: nextVersion });
        return data!;
      }),

    restore: t.procedure
      .use(requireUser)
      .input(
        z.object({
          projectId: z.string().uuid(),
          revisionId: z.string().uuid()
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertProjectOwned(ctx, input.projectId);
        const { data: revision, error: revisionError } = await ctx.supabaseAdmin
          .from('project_revisions')
          .select('id, version, drawing_data, simplified_model, calculations, dimensioning')
          .eq('id', input.revisionId)
          .eq('project_id', input.projectId)
          .maybeSingle();
        if (revisionError) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: revisionError.message });
        }
        if (!revision) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Revision no encontrada' });
        }

        const calculations =
          revision.calculations == null
            ? null
            : calculationsSnapshotSchema.parse(revision.calculations);
        const dimensioning =
          revision.dimensioning == null
            ? null
            : dimensioningSnapshotSchema.parse(revision.dimensioning);
        const simplifiedModel =
          revision.simplified_model == null
            ? null
            : normalizeBuildingInput(revision.simplified_model);

        let status: z.infer<typeof projectStatusSchema> = 'draft';
        if (revision.drawing_data) status = 'drawn';
        if (simplifiedModel) status = 'loaded';
        if (calculations) status = 'calculated';
        if (dimensioning) status = 'dimensioned';

        const { error: updateError } = await ctx.supabaseAdmin
          .from('projects')
          .update({
            drawing_data: revision.drawing_data,
            simplified_model: simplifiedModel,
            calculations,
            dimensioning,
            current_revision_id: revision.id,
            status: projectStatusForDb(status)
          })
          .eq('id', input.projectId)
          .eq('user_id', ctx.userId);
        if (updateError) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateError.message });
        }

        await writeAuditLog(ctx, ctx.userId, input.projectId, 'revision.restored', {
          revisionId: revision.id,
          version: revision.version
        });

        return {
          id: revision.id,
          version: revision.version,
          drawing_data: revision.drawing_data,
          simplified_model: simplifiedModel,
          calculations,
          dimensioning,
          status
        };
      })
  }),

  exports: t.router({
    requestJson: t.procedure
      .use(requireUser)
      .input(z.object({ projectId: z.string().uuid(), revisionId: z.string().uuid().optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectOwned(ctx, input.projectId);
        const { data: proj, error } = input.revisionId
          ? await ctx.supabaseAdmin
              .from('project_revisions')
              .select('drawing_data, simplified_model, calculations, dimensioning')
              .eq('id', input.revisionId)
              .eq('project_id', input.projectId)
              .maybeSingle()
          : await ctx.supabaseAdmin
              .from('projects')
              .select('drawing_data, simplified_model, calculations, dimensioning, specs')
              .eq('id', input.projectId)
              .single();
        if (error || !proj) throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
        const { data: projectMeta } = await ctx.supabaseAdmin
          .from('projects')
          .select('specs')
          .eq('id', input.projectId)
          .single();
        const snapshot = {
          exportedAt: new Date().toISOString(),
          specs: normalizeProjectSpecs(projectMeta?.specs),
          drawing_data: proj.drawing_data,
          simplified_model: proj.simplified_model,
          calculations: proj.calculations,
          dimensioning: proj.dimensioning
        };
        await writeAuditLog(ctx, ctx.userId, input.projectId, 'export.json', {
          revisionId: input.revisionId ?? null
        });
        return { kind: 'json' as const, snapshot };
      }),

    requestPdf: t.procedure
      .use(requireUser)
      .input(z.object({ projectId: z.string().uuid(), revisionId: z.string().uuid().optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectOwned(ctx, input.projectId);

        const { data: projectMeta, error: projectError } = await ctx.supabaseAdmin
          .from('projects')
          .select('name, specs')
          .eq('id', input.projectId)
          .eq('user_id', ctx.userId)
          .maybeSingle();
        if (projectError) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: projectError.message });
        }
        if (!projectMeta) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
        }

        const { data: snapshot, error: snapshotError } = input.revisionId
          ? await ctx.supabaseAdmin
              .from('project_revisions')
              .select('simplified_model, calculations, dimensioning')
              .eq('id', input.revisionId)
              .eq('project_id', input.projectId)
              .maybeSingle()
          : await ctx.supabaseAdmin
              .from('projects')
              .select('simplified_model, calculations, dimensioning')
              .eq('id', input.projectId)
              .eq('user_id', ctx.userId)
              .maybeSingle();
        if (snapshotError) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: snapshotError.message });
        }
        if (!snapshot) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: input.revisionId ? 'Revision no encontrada' : 'Proyecto no encontrado'
          });
        }

        const pdf = buildTechnicalReportPdfBase64({
          projectName: projectMeta.name?.trim() || 'Proyecto',
          specs: normalizeProjectSpecs(projectMeta.specs),
          simplifiedModel: snapshot.simplified_model,
          calculations: snapshot.calculations,
          dimensioning: snapshot.dimensioning
        });

        await writeAuditLog(ctx, ctx.userId, input.projectId, 'export.pdf', {
          revisionId: input.revisionId ?? null,
          filename: pdf.filename
        });

        return {
          kind: 'pdf' as const,
          filename: pdf.filename,
          contentBase64: pdf.contentBase64,
          mimeType: pdf.mimeType
        };
      })
  }),

  calc: t.router({
    /** Ejecuta pipeline loads → demands → design en servidor (auditable). */
    runPipeline: t.procedure
      .use(requireUser)
      .input(z.object({ simplifiedModel: z.unknown() }))
      .mutation(({ input }) => {
        const model = normalizeBuildingInput(input.simplifiedModel);
        const loads = calculateLoads(model);
        const demands = calculateDemands(model);
        const calculations = calculationsSnapshotSchema.parse({ loads, demands });
        const dimensioning = dimensioningSnapshotSchema.parse(calculateDesign(model));
        return {
          calculations,
          dimensioning
        };
      })
  })
});

async function assertProjectOwned(ctx: TrpcContext & { userId: string }, projectId: string) {
  const { data, error } = await ctx.supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  if (!data) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sin acceso al proyecto' });
}

function sanitizeProjectPatch(patch: z.infer<typeof projectPatchSchema>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (patch.name !== undefined) next.name = patch.name.trim();
  if (patch.drawing_data !== undefined) next.drawing_data = patch.drawing_data;
  if (patch.simplified_model !== undefined) next.simplified_model = normalizeBuildingInput(patch.simplified_model);
  if (patch.calculations !== undefined) next.calculations = calculationsSnapshotSchema.parse(patch.calculations);
  if (patch.dimensioning !== undefined) next.dimensioning = dimensioningSnapshotSchema.parse(patch.dimensioning);
  if (patch.specs !== undefined) next.specs = normalizeProjectSpecs(patch.specs);
  if (patch.status !== undefined) next.status = projectStatusForDb(patch.status);
  return next;
}

async function writeAuditLog(
  ctx: TrpcContext,
  userId: string,
  projectId: string,
  action: string,
  payload: Record<string, unknown>
) {
  await ctx.supabaseAdmin.from('audit_log').insert({
    user_id: userId,
    project_id: projectId,
    action,
    payload
  });
}

export type AppRouter = typeof appRouter;
