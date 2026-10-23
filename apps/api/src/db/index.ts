import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

let instance: NeonHttpDatabase<typeof schema> | undefined;

/** Lazily connect so modules can be imported without DATABASE_URL (tests, build). */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}

export { schema };
