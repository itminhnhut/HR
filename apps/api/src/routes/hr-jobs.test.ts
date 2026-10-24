import {
  DEFAULT_JOB_TEMPLATE,
  DEPARTMENT_SUGGESTIONS,
  type HrJobDto,
  type HrJobsResponse,
  type JobPageResponse,
  type JobTemplate,
  type JobTemplateResponse,
} from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, jobs } from '../db/schema.js';
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

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const saveNew = async (overrides = {}) => json<HrJobDto>(await hr('POST', '/jobs', jobInput(overrides)));
const dbJob = async (id: string) => (await t.db.select().from(jobs).where(eq(jobs.id, id)))[0];

describe('HR job list', () => {
  it('orders by urgency and counts applications per job', async () => {
    const open = await insertJob(t, { title: 'Đang tuyển' });
    await insertJob(t, { title: 'Sắp hết', deadline: '2026-10-22' });
    await insertJob(t, { title: 'Nháp', state: 'draft', publishedOn: null });
    await insertJob(t, { title: 'Đã đóng', state: 'closed', closedOn: '2026-10-19' });
    await insertJob(t, { title: 'Hết hạn', deadline: '2026-10-19' });
    const base = { fullName: 'A', consentAt: t.clock.now, policyVersion: 'v', jobId: open.id };
    await t.db.insert(applications).values([
      { ...base, phone: '0912000001' },
      { ...base, phone: '0912000002', status: 'seen' },
    ]);

    const body = await json<HrJobsResponse>(await hr('GET', '/jobs'));

    expect(body.jobs.map((j) => j.title)).toEqual(['Sắp hết', 'Đang tuyển', 'Nháp', 'Hết hạn', 'Đã đóng']);
    expect(body.jobs[1]).toMatchObject({ totalApplications: 2, newApplications: 1, status: 'open' });
    expect(body.newApplications).toBe(1);
  });

  it('counts applications of jobs that ended more than 30 days ago as due for deletion', async () => {
    const jobsWithApplications = await Promise.all([
      insertJob(t, { title: 'Đóng 31 ngày', state: 'closed', closedOn: '2026-09-19', deadline: '2026-09-30' }),
      insertJob(t, { title: 'Hết hạn 31 ngày', deadline: '2026-09-19', publishedOn: '2026-09-01' }),
      insertJob(t, { title: 'Đóng đúng 30 ngày', state: 'closed', closedOn: '2026-09-20', deadline: '2026-09-30' }),
      insertJob(t, { title: 'Đang tuyển' }),
    ]);
    await t.db.insert(applications).values(
      jobsWithApplications.flatMap((job, i) =>
        [1, 2].map((k) => ({
          jobId: job.id,
          fullName: 'A',
          phone: `09120000${i}${k}`,
          consentAt: t.clock.now,
          policyVersion: 'v',
        })),
      ),
    );

    const body = await json<HrJobsResponse>(await hr('GET', '/jobs'));

    expect(body.dueForDeletion).toBe(4);
  });
});

describe('saving jobs', () => {
  it('publishes a new job with a slug from the title and today as publish date', async () => {
    const job = await saveNew({ title: 'Kỹ sư Đám mây (Senior)' });
    expect(job).toMatchObject({ slug: 'ky-su-dam-may-senior', state: 'published', status: 'open' });
    expect((await dbJob(job.id)).publishedOn).toBe('2026-10-20');
    expect((await t.request('/api/jobs/ky-su-dam-may-senior')).status).toBe(200);
  });

  it('gives a second job with the same title its own slug', async () => {
    await saveNew();
    expect((await saveNew()).slug).toBe('ky-su-phan-mem-2');
    expect((await saveNew()).slug).toBe('ky-su-phan-mem-3');
  });

  it('will not publish a job with a deadline over 60 days (BR-01)', async () => {
    const res = await hr('POST', '/jobs', jobInput({ deadline: '2026-12-20' }));
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.deadline).toBe(
      'Hạn nộp tối đa 60 ngày từ hôm nay.',
    );
    expect((await hr('POST', '/jobs', jobInput({ deadline: '2026-12-19' }))).status).toBe(200);
  });

  it('requires a deadline that is a real date not in the past to publish', async () => {
    for (const deadline of ['', '2026-10-19', '2026-02-30', '20/11/2026']) {
      const res = await hr('POST', '/jobs', jobInput({ deadline }));
      expect(res.status, deadline).toBe(422);
    }
  });

  it('saves a half-written draft with a default deadline', async () => {
    const job = await saveNew({ intent: 'draft', deadline: '', responsibilities: '' });
    expect(job).toMatchObject({ state: 'draft', status: 'draft', deadline: '2026-11-19' });
    expect((await t.request(`/api/jobs/${job.slug}`)).status).toBe(404);
  });

  it('refuses a malformed deadline even on a draft', async () => {
    expect((await hr('POST', '/jobs', jobInput({ intent: 'draft', deadline: '2026-13-01' }))).status).toBe(422);
  });

  it('requires the duties and the requirements to publish', async () => {
    const res = await hr('POST', '/jobs', jobInput({ responsibilities: '', requirements: '' }));
    expect(res.status).toBe(422);
    expect(Object.keys((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors).sort()).toEqual([
      'requirements',
      'responsibilities',
    ]);
  });

  it('keeps the public link when the title of a published job changes (BR-04)', async () => {
    const job = await saveNew();
    const updated = await json<HrJobDto>(await hr('PUT', `/jobs/${job.id}`, jobInput({ title: 'Tên mới hoàn toàn' })));
    expect(updated.slug).toBe(job.slug);
    expect(updated.title).toBe('Tên mới hoàn toàn');
  });

  it('lets a draft slug follow its title until first publish', async () => {
    const draft = await saveNew({ intent: 'draft' });
    const renamed = await json<HrJobDto>(
      await hr('PUT', `/jobs/${draft.id}`, jobInput({ intent: 'draft', title: 'Chuyên viên tuyển dụng' })),
    );
    expect(renamed.slug).toBe('chuyen-vien-tuyen-dung');
  });

  it('keeps a draft slug that does not need to change', async () => {
    const draft = await saveNew({ intent: 'draft' });
    const again = await json<HrJobDto>(await hr('PUT', `/jobs/${draft.id}`, jobInput({ intent: 'draft' })));
    expect(again.slug).toBe(draft.slug);
  });

  it('lets a live job move its deadline up to 60 days from today, not from its publish date', async () => {
    const job = await saveNew({ deadline: '2026-11-19' });
    t.clock.now = new Date('2026-11-10T03:00:00.000Z');
    cookie = await loginHr(t);

    const tooFar = await hr('PUT', `/jobs/${job.id}`, jobInput({ deadline: '2027-01-10', intent: 'draft' }));
    expect(tooFar.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(tooFar)).fieldErrors.deadline).toBe(
      'Hạn nộp tối đa 60 ngày từ hôm nay.',
    );

    const saved = await hr('PUT', `/jobs/${job.id}`, jobInput({ deadline: '2027-01-09', intent: 'draft' }));
    expect(saved.status).toBe(200);
    expect((await dbJob(job.id)).deadline).toBe('2027-01-09');
  });

  it('keeps the publish date when a live job is saved again', async () => {
    const job = await saveNew();
    t.clock.now = new Date('2026-10-25T03:00:00.000Z');
    await hr('PUT', `/jobs/${job.id}`, jobInput({ title: 'Đổi tên' }));
    expect((await dbJob(job.id)).publishedOn).toBe('2026-10-20');
  });

  it('does not let a draft-intent save turn a live job back into a draft', async () => {
    const job = await saveNew();
    const saved = await json<HrJobDto>(await hr('PUT', `/jobs/${job.id}`, jobInput({ intent: 'draft' })));
    expect(saved.state).toBe('published');
  });

  it('answers 404 for unknown or malformed ids', async () => {
    expect((await hr('GET', '/jobs/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await hr('GET', '/jobs/abc')).status).toBe(404);
    expect((await hr('PUT', '/jobs/abc', jobInput())).status).toBe(404);
  });

  it('returns field errors from the shared schema', async () => {
    const res = await hr('POST', '/jobs', jobInput({ title: 'A', salaryMin: 30_000_000, salaryMax: 10_000_000 }));
    const body = await json<{ fieldErrors: Record<string, string> }>(res);
    expect(res.status).toBe(422);
    expect(Object.keys(body.fieldErrors).sort()).toEqual(['salaryMax', 'title']);
  });
});

describe('job actions', () => {
  const act = (id: string, action: string) => hr('POST', `/jobs/${id}/${action}`);

  it('closes an open job before its deadline, recording today as the end day (BR-06)', async () => {
    const job = await insertJob(t);

    expect(await (await act(job.id, 'close')).json()).toEqual({ ok: true });

    expect(await dbJob(job.id)).toMatchObject({ state: 'closed', closedOn: '2026-10-20', slug: job.slug });
    const page = await json<JobPageResponse>(await t.request(`/api/jobs/${job.slug}`));
    expect(page.job.status).toBe('closed');
  });

  it('keeps the deadline as the end day when closing a job that already expired', async () => {
    const job = await insertJob(t, { deadline: '2026-10-10', publishedOn: '2026-09-15' });

    await act(job.id, 'close');

    expect(await dbJob(job.id)).toMatchObject({ state: 'closed', closedOn: '2026-10-10' });
  });

  it('refuses to close a draft or a job that is already closed', async () => {
    const draft = await insertJob(t, { state: 'draft', publishedOn: null });
    const closed = await insertJob(t, { state: 'closed', closedOn: '2026-10-01' });

    expect((await act(draft.id, 'close')).status).toBe(422);
    expect((await act(closed.id, 'close')).status).toBe(422);
    expect((await dbJob(closed.id)).closedOn).toBe('2026-10-01');
  });

  it('publishes a valid draft and sets its publish date once', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null, deadline: '2026-11-01' });
    await act(job.id, 'publish');
    expect(await dbJob(job.id)).toMatchObject({ state: 'published', publishedOn: '2026-10-20' });
  });

  it('refuses to publish a draft whose deadline is over 60 days away', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null, deadline: '2027-01-30' });
    expect((await act(job.id, 'publish')).status).toBe(422);
  });

  it('refuses to publish a draft without requirements', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null, requirements: '  ' });

    const res = await act(job.id, 'publish');

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/Yêu cầu/) });
    expect((await dbJob(job.id)).state).toBe('draft');
  });

  it('refuses to publish a job that is not a draft', async () => {
    const closed = await insertJob(t, { state: 'closed', closedOn: '2026-10-19' });
    expect((await act(closed.id, 'publish')).status).toBe(422);
    expect((await dbJob(closed.id)).state).toBe('closed');
  });

  it('answers 404 for removed or unknown actions', async () => {
    const job = await insertJob(t);
    for (const action of ['extend', 'pause', 'resume', 'fill', 'delete']) {
      expect((await act(job.id, action)).status, action).toBe(404);
    }
  });
});

describe('"Sửa hạn nộp"', () => {
  const setDeadline = (id: string, deadline: unknown) => hr('POST', `/jobs/${id}/deadline`, { deadline });

  it('reopens a closed job with the new deadline, keeping its link', async () => {
    const job = await insertJob(t, { state: 'closed', closedOn: '2026-10-15', deadline: '2026-10-30' });

    expect(await (await setDeadline(job.id, '2026-11-30')).json()).toEqual({ ok: true });

    expect(await dbJob(job.id)).toMatchObject({
      state: 'published',
      closedOn: null,
      deadline: '2026-11-30',
      slug: job.slug,
    });
    expect((await json<JobPageResponse>(await t.request(`/api/jobs/${job.slug}`))).job.status).toBe('open');
  });

  it('reopens an expired job', async () => {
    const job = await insertJob(t, { deadline: '2026-10-10', publishedOn: '2026-08-01' });

    await setDeadline(job.id, '2026-12-19');

    expect(await dbJob(job.id)).toMatchObject({ state: 'published', deadline: '2026-12-19' });
  });

  it('moves the deadline of a job that is still open, even to an earlier day', async () => {
    const job = await insertJob(t);
    await setDeadline(job.id, '2026-10-25');
    expect((await dbJob(job.id)).deadline).toBe('2026-10-25');
  });

  it('allows at most 60 days from today, whenever the job was first published', async () => {
    const job = await insertJob(t, { deadline: '2026-10-10', publishedOn: '2026-06-01' });

    const res = await setDeadline(job.id, '2026-12-20');

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { deadline: 'Hạn nộp tối đa 60 ngày từ hôm nay.' } });
    expect((await setDeadline(job.id, '2026-12-19')).status).toBe(200);
  });

  it('refuses a missing, past or impossible date and leaves the job as it was', async () => {
    const job = await insertJob(t, { state: 'closed', closedOn: '2026-10-15' });
    for (const deadline of [undefined, '', '2026-10-19', '2026-11-31', '30/11/2026', 20261130]) {
      expect((await setDeadline(job.id, deadline)).status, String(deadline)).toBe(422);
    }
    expect(await dbJob(job.id)).toMatchObject({ state: 'closed', closedOn: '2026-10-15' });
  });

  it('refuses a draft: it gets its deadline from the form when published', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null });

    expect((await setDeadline(job.id, '2026-11-30')).status).toBe(422);

    expect((await dbJob(job.id)).state).toBe('draft');
  });

  it('answers 404 for an unknown job', async () => {
    expect((await setDeadline('00000000-0000-0000-0000-000000000000', '2026-11-30')).status).toBe(404);
  });
});

describe('"Mẫu tin" job template', () => {
  const customTemplate = (overrides: Partial<JobTemplate> = {}): JobTemplate => ({
    workDays: 'Thứ 2 – Thứ 6',
    startTime: '09:00',
    endTime: '18:00',
    benefits: [
      { label: 'Lương tháng 13', standard: true },
      { label: 'Phụ cấp ăn trưa', standard: false },
    ],
    roadmap: ['a', 'b', 'c', 'd', 'e'],
    ...overrides,
  });

  it('starts from the default template, with departments and hand-typed benefits from earlier jobs', async () => {
    await insertJob(t, { department: 'Kho vận', benefits: ['Lương tháng 13', 'Xe đưa đón'] });
    await insertJob(t, { department: 'Kỹ thuật', benefits: ['Xe đưa đón', 'Gym miễn phí'] });

    const body = await json<JobTemplateResponse>(await hr('GET', '/jobs/template'));

    expect(body.template).toEqual(DEFAULT_JOB_TEMPLATE);
    expect(body.departments).toEqual([...DEPARTMENT_SUGGESTIONS, 'Kho vận']);
    expect(body.extraBenefits).toEqual(['Xe đưa đón', 'Gym miễn phí']);
  });

  it('saves a new template that later reads return', async () => {
    const res = await hr('PUT', '/jobs/template', customTemplate());

    expect(res.status).toBe(200);
    expect((await json<JobTemplateResponse>(res)).template).toEqual(customTemplate());
    expect((await json<JobTemplateResponse>(await hr('GET', '/jobs/template'))).template).toEqual(customTemplate());
  });

  it('stops suggesting a hand-typed benefit once the template has it', async () => {
    await insertJob(t, { benefits: ['Phụ cấp ăn trưa', 'Xe đưa đón'] });

    const body = await json<JobTemplateResponse>(await hr('PUT', '/jobs/template', customTemplate()));

    expect(body.extraBenefits).toEqual(['Xe đưa đón']);
  });

  it('refuses an invalid template and keeps the stored one', async () => {
    await hr('PUT', '/jobs/template', customTemplate());
    const invalidTemplates = [
      customTemplate({ startTime: '25:00' }),
      customTemplate({ workDays: ' ' }),
      customTemplate({ roadmap: ['chỉ một mốc'] }),
      customTemplate({ benefits: [{ label: 'x'.repeat(81), standard: true }] }),
      {},
    ];

    for (const body of invalidTemplates) {
      const res = await hr('PUT', '/jobs/template', body);
      expect(res.status).toBe(422);
      const { fieldErrors } = await json<{ fieldErrors: Record<string, string> }>(res);
      expect(Object.keys(fieldErrors).length).toBeGreaterThan(0);
    }
    expect((await json<JobTemplateResponse>(await hr('GET', '/jobs/template'))).template).toEqual(customTemplate());
  });
});

describe('deleting jobs', () => {
  it('deletes a draft', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null });
    expect((await hr('DELETE', `/jobs/${job.id}`)).status).toBe(200);
    expect(await dbJob(job.id)).toBeUndefined();
  });

  it('refuses to delete anything that was published', async () => {
    for (const overrides of [{ state: 'published' as const }, { state: 'closed' as const, closedOn: '2026-10-19' }]) {
      const job = await insertJob(t, overrides);
      expect((await hr('DELETE', `/jobs/${job.id}`)).status).toBe(422);
      expect(await dbJob(job.id)).toBeDefined();
    }
  });
});
