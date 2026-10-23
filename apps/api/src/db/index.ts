import { Pool } from '@neondatabase/serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';

/**
 * Any Drizzle Postgres database with our schema: Neon in production,
 * PGlite in tests. Code must stick to the common Postgres API.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Neon over WebSockets, so transactions work (the HTTP driver has none). */
export function createNeonDb(url: string): Db {
  return drizzle({ client: new Pool({ connectionString: url }), schema });
}

export { schema };
