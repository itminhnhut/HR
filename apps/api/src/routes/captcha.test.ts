import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications } from '../db/schema.js';
import { insertJob } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let seen: { token: string; ip: string }[];
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  seen = [];
  // Cloudflare is external: a fake that accepts only "ok".
  t.deps.verifyCaptcha = async (token, ip) => {
    seen.push({ token, ip });
    return token === 'ok';
  };
});

function apply(jobId: string, captchaToken?: string) {
  const form = new FormData();
  const fields: Record<string, string> = {
    jobId,
    fullName: 'Nguyễn Văn An',
    phone: '0912000111',
    cvLink: 'https://drive.google.com/cv',
    consent: 'true',
    formOpenedAt: String(t.clock.now.getTime()),
    ...(captchaToken ? { captchaToken } : {}),
  };
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return t.request('/api/applications', {
    method: 'POST',
    body: form,
    headers: { 'x-requested-with': 'careers-web', 'x-forwarded-for': '203.0.113.7' },
  });
}

describe('CAPTCHA on the public forms', () => {
  it('refuses an application without a passing token and stores nothing', async () => {
    const job = await insertJob(t);
    expect((await apply(job.id)).status).toBe(422);
    expect((await apply(job.id, 'bot')).status).toBe(422);
    expect(await t.db.select().from(applications)).toEqual([]);
  });

  it('accepts an application with a passing token, checked with the sender address', async () => {
    const job = await insertJob(t);
    expect((await apply(job.id, 'ok')).status).toBe(200);
    expect(seen.at(-1)).toEqual({ token: 'ok', ip: '203.0.113.7' });
  });

  it('protects the phone lookup the same way', async () => {
    const lookup = (captchaToken?: string) =>
      t.send('POST', '/api/applications/lookup', { phone: '0912000111', captchaToken });
    expect((await lookup()).status).toBe(422);
    expect((await lookup('ok')).status).toBe(200);
  });

  it('is skipped when no keys are configured', async () => {
    t.deps.verifyCaptcha = null;
    const job = await insertJob(t);
    expect((await apply(job.id)).status).toBe(200);
  });
});
