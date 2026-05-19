import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import { calculateDemands, calculateDesign, calculateLoads } from '@nodouno/calc';
import {
  normalizeProjectSpecs,
  normalizeProjectStatus,
  projectStatusSchema
} from '@nodouno/shared';
import type { TrpcContext } from './context';

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

export const appRouter = t.router({
  health: t.procedure.query(() => ({ ok: true as const, service: 'nodouno-api' })),

  catalogs: t.router({
    regulations: t.procedure.use(requireUser).query(async ({ ctx }) => {
      const { data, error } = await ctx.supabaseAdmin.from('regulations').select('*').order('code');
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),
    concrete: t.procedure.use(requireUser).query(async ({ ctx }) => {
      const { data, error } = await ctx.supabaseAdmin.from('concrete_classes').select('*').order('code');
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),
    steel: t.procedure.use(requireUser).query(async ({ ctx }) => {
      const { data, error } = await ctx.supabaseAdmin.from('steel_classes').select('*').order('code');
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
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
          specs: z
            .object({
              regulation: z.literal('CIRSOC_201'),
              steel: z.literal('ADN_420'),
              concrete: z.enum(['H25', 'H30', 'H35'])
            })
            .optional()
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
          patch: z
            .object({
              name: z.string().min(1).max(120).optional(),
              drawing_data: z.unknown().optional(),
              simplified_model: z.unknown().optional(),
              calculations: z.unknown().optional(),
              dimensioning: z.unknown().optional(),
              specs: z.unknown().optional(),
              status: projectStatusSchema.optional()
            })
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { error } = await ctx.supabaseAdmin
          .from('projects')
          .update(input.patch as Record<string, unknown>)
          .eq('id', input.id)
          .eq('user_id', ctx.userId);
        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
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
        return data!;
      })
  }),

  exports: t.router({
    requestJson: t.procedure
      .use(requireUser)
      .input(z.object({ projectId: z.string().uuid(), revisionId: z.string().uuid().optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectOwned(ctx, input.projectId);
        const { data: proj, error } = await ctx.supabaseAdmin
          .from('projects')
          .select('drawing_data, simplified_model, calculations, dimensioning, specs')
          .eq('id', input.projectId)
          .single();
        if (error || !proj) throw new TRPCError({ code: 'NOT_FOUND', message: 'Proyecto no encontrado' });
        const snapshot = {
          exportedAt: new Date().toISOString(),
          specs: proj.specs,
          drawing_data: proj.drawing_data,
          simplified_model: proj.simplified_model,
          calculations: proj.calculations,
          dimensioning: proj.dimensioning
        };
        return { kind: 'json' as const, snapshot };
      }),

    requestPdf: t.procedure
      .use(requireUser)
      .input(z.object({ projectId: z.string().uuid() }))
      .mutation(() => {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'Export PDF pendiente de worker dedicado (ver plan Fase 5)'
        });
      })
  }),

  calc: t.router({
    /** Ejecuta pipeline loads → demands → design en servidor (auditable). */
    runPipeline: t.procedure
      .use(requireUser)
      .input(z.object({ simplifiedModel: z.unknown() }))
      .mutation(({ input }) => {
        const model = input.simplifiedModel as Parameters<typeof calculateLoads>[0];
        const loads = calculateLoads(model);
        const demands = calculateDemands(model);
        const dimensioning = calculateDesign(model);
        return {
          calculations: { loads, demands },
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

export type AppRouter = typeof appRouter;
