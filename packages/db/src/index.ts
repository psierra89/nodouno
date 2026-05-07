import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(connectionString: string, ssl: boolean | 'require' = 'require') {
  const client = postgres(connectionString, {
    prepare: false,
    ssl: ssl === false ? false : ssl
  });
  return drizzle(client, { schema });
}

export * from './schema';
