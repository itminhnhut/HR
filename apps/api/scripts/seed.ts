import { createNeonDb } from '../src/db/index.js';
import { seedDemoData } from '../src/db/seed.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
if (process.env.VERCEL_ENV === 'production') throw new Error('Refusing to seed demo data into production.');

const result = await seedDemoData(createNeonDb(url), new Date());
console.info(`Seeded ${result.jobs} jobs and ${result.applications} applications.`);
process.exit(0);
