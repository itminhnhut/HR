import type { HrMe } from '@careers/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { Deps } from './deps.js';
import { HttpError } from './lib/http-error.js';
import { candidateRoutes } from './routes/candidate.js';
import { hrRoutes } from './routes/hr.js';
import { publicNewsRoutes } from './routes/public-news.js';
import { publicRoutes } from './routes/public.js';
import { shareNewsRoutes } from './routes/share-news.js';
import { shareRoutes } from './routes/share.js';

export interface Env {
  Variables: { deps: Deps; hr?: HrMe };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard: browsers cannot add custom headers to cross-site form posts,
 * and the FE always sends this one (apps/web/src/api/http.ts).
 */
const requireFetchHeader: MiddlewareHandler = async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method) && c.req.header('x-requested-with') !== 'careers-web') {
    throw new HttpError(403, 'Yêu cầu không hợp lệ.');
  }
  await next();
};

/** API routes live under /api; share pages, sitemap and robots sit at the root. */
export function createApp(deps: Deps) {
  const app = new Hono<Env>();

  app.use(secureHeaders());
  app.use(async (c, next) => {
    c.set('deps', deps);
    await next();
  });

  const api = new Hono<Env>();
  api.use(requireFetchHeader);
  api.get('/health', (c) => c.json({ ok: true }));
  api.route('/', publicRoutes);
  api.route('/', publicNewsRoutes);
  api.route('/candidate', candidateRoutes);
  api.route('/hr', hrRoutes);
  app.route('/api', api);
  app.route('/', shareRoutes);
  app.route('/', shareNewsRoutes);

  app.notFound((c) => c.json({ error: 'Không tìm thấy.' }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(err.toBody(), err.status);
    if (err instanceof HTTPException) return c.json({ error: err.message || 'Yêu cầu không hợp lệ.' }, err.status);
    console.error('Unhandled API error', err);
    return c.json({ error: 'Có lỗi xảy ra, thử lại sau.' }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
