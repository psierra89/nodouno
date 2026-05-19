import { createClient } from '@supabase/supabase-js';

/** Limpia valores copiados desde Vercel/Windows con `\r\n` literales o reales. */
function sanitizePublicEnv(value: string | undefined): string | undefined {
  const normalized = value
    ?.replace(/\\r\\n/g, '')
    .replace(/\\n/g, '')
    .replace(/\\r/g, '')
    .trim();
  return normalized || undefined;
}

const supabaseUrl = sanitizePublicEnv(import.meta.env.PUBLIC_SUPABASE_URL as string | undefined);
const supabaseAnonKey = sanitizePublicEnv(
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined
);

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
