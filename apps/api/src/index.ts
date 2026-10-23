import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { requireFetchHeader } from './lib/session.js';
import { authRoutes } from './routes/auth.js';
import { cronRoutes } from './routes/cron.js';
import { hrRoutes } from './routes/hr.js';
import { publicRoutes } from './routes/public.js';
import { shareRoutes } from './routes/share.js';

/**
 * The frontend proxies /api/* to this app through a Vercel rewrite, so the
 * browser only ever talks to one origin: no CORS, and the HR cookie stays first-party.
 */
const app = new Hono();

app.use(logger());
app.use(secureHeaders());

app.use('/api/hr/*', requireFetchHeader);
app.use('/api/auth/*', requireFetchHeader);

app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api', publicRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/hr', hrRoutes);
app.route('/api/cron', cronRoutes);
app.route('/share', shareRoutes);

app.notFound((c) => c.json({ error: 'Không tìm thấy.' }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error('[api] unhandled error', error);
  return c.json({ error: 'Có lỗi phía máy chủ. Thử lại sau ít phút.' }, 500);
});

export default app;
