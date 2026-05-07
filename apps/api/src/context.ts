import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './env';

export type TrpcContext = {
  env: Env;
  userId: string | null;
  supabaseAdmin: SupabaseClient;
};

export async function createContext(opts: CreateFastifyContextOptions, env: Env): Promise<TrpcContext> {
  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const authHeader = opts.req.headers.authorization;
  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  let userId: string | null = null;
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data.user) userId = data.user.id;
  }

  return { env, userId, supabaseAdmin };
}
