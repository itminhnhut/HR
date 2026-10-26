import type { HrJobDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertJob, jobInput, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const SITE = 'https://tuyendung.test';
const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });

describe('IndexNow for jobs', () => {
  it('should announce a job and the home page when HR publishes it', async () => {
    const job = await json<HrJobDto>(await hr('POST', '/jobs', jobInput({ title: 'Kế toán', intent: 'publish' })));

    expect(t.outbound.indexNowUrls()).toEqual([`${SITE}/viec-lam/${job.slug}`, `${SITE}/`]);
  });

  it('should announce edits, closing and a new deadline of a public job', async () => {
    const job = await insertJob(t, { slug: 'ke-toan' });

    await hr('PUT', `/jobs/${job.id}`, jobInput({ title: 'Kế toán trưởng' }));
    await hr('POST', `/jobs/${job.id}/close`);
    await hr('POST', `/jobs/${job.id}/deadline`, { deadline: '2026-11-30' });

    expect(t.outbound.calls).toHaveLength(3);
    expect(t.outbound.indexNowUrls().filter((u) => u.endsWith('/viec-lam/ke-toan'))).toHaveLength(3);
  });

  it('should announce a draft only once it is published', async () => {
    const created = await json<HrJobDto>(await hr('POST', '/jobs', jobInput({ intent: 'draft' })));
    const draft = await json<HrJobDto>(
      await hr('PUT', `/jobs/${created.id}`, jobInput({ intent: 'draft', title: 'Vẫn nháp' })),
    );
    expect(t.outbound.calls).toHaveLength(0);

    await hr('POST', `/jobs/${draft.id}/publish`);

    expect(t.outbound.indexNowUrls()).toEqual([`${SITE}/viec-lam/van-nhap`, `${SITE}/`]);
  });

  it('should save the job even when IndexNow fails', async () => {
    t.outbound.respond = async () => new Response(null, { status: 500 });

    const res = await hr('POST', '/jobs', jobInput({ intent: 'publish' }));

    expect(res.status).toBe(200);
    expect(t.outbound.calls).toHaveLength(1);
  });
});
