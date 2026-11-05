import { MAIL_COMPANY } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { applications } from '../db/schema.js';
import type { Env } from '../app.js';
import { isCvLinkValid, readCvLinkToken } from '../lib/cv-link.js';
import { cvResponse } from '../lib/cv-response.js';

/** A candidate opens this from an email, so a failure is a page to read, not an API answer. */
const failurePage = (title: string, text: string) => `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
    background: #f5f8fd; color: #0f172a; font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  main { max-width: 440px; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
  h1 { margin: 0 0 8px; font-size: 20px; line-height: 1.3; }
  p { margin: 0; color: #334155; }
  p + p { margin-top: 8px; }
  a { color: #1d4ed8; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${text}</p>
<p>Liên hệ HR: <a href="mailto:${MAIL_COMPANY.hrEmail}">${MAIL_COMPANY.hrEmail}</a> · ${MAIL_COMPANY.hotline}</p>
</main>
</body>
</html>`;

/** The same answer for every refused link: it must not tell who has an application. */
const UNUSABLE_PAGE = failurePage('Link CV không còn dùng được', 'Link có thể đã hết hạn hoặc CV đã được thay.');
const OUTAGE_PAGE = failurePage('Chưa mở được CV', 'Hệ thống đang bận, vui lòng thử lại sau ít phút.');
const PAGE_HEADERS = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };

const unusable = (c: Context<Env>) => c.html(UNUSABLE_PAGE, 404, PAGE_HEADERS);

export const cvLinkRoutes = new Hono<Env>();

/** The CV in an interview invitation: needs no sign-in, because the signed address is the permission. */
cvLinkRoutes.get('/:token', async (c) => {
  const { db, config, cvStore, now } = c.get('deps');
  const token = readCvLinkToken(c.req.param('token'));
  if (!token) return unusable(c);
  const row = await db.query.applications.findFirst({ where: eq(applications.id, token.id) });
  if (!row?.cvPathname || !isCvLinkValid(config.sessionSecret, token, row.cvPathname, now())) return unusable(c);
  const stream = await cvStore.get(row.cvPathname);
  if (!stream) return unusable(c);
  return cvResponse(stream, row.fullName);
});

/** The database or file store is down: the link may be fine, so the candidate is told to try again. */
cvLinkRoutes.onError((error, c) => {
  console.error('CV link could not be opened', error);
  return c.html(OUTAGE_PAGE, 503, PAGE_HEADERS);
});
