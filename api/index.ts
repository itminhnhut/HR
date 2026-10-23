// Vercel Function for the whole BE. vercel.json rewrites /api/*, /share/*, /sitemap.xml, /robots.txt
// and bot requests for /viec-lam/:slug here; Hono routes by the original request path.
import { createProductionApp } from '../apps/api/src/main.js';

const app = createProductionApp();

export default { fetch: app.fetch };
