import { readFileSync } from 'node:fs';
import type { ApplicationDetailDto, ApplicationsResponse, MatchItem } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, jobs, type Job, type NewJob } from '../db/schema.js';
import { SCORE_BATCH } from '../services/cv-score.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
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
const pdf = (name: string) => readFileSync(new URL(`../test/cv-pdfs/${name}`, import.meta.url));

/** Job asking what the sample CV of Nguyễn Thị Mai Anh (sales, 03/2021 – now, university, Excel, CRM) shows. */
const SALES_JOB: Partial<NewJob> = {
  experience: 'Từ 2 năm',
  education: 'Đại học',
  requirements: 'Thành thạo Excel\nCó kinh nghiệm sử dụng CRM\nChịu được áp lực công việc',
};

async function applyWith(job: Job, cv: { file?: string; link?: string }) {
  const pathname = cv.file ? `cv/test/${crypto.randomUUID()}.pdf` : null;
  if (pathname && cv.file) t.cvStore.files.set(pathname, new Uint8Array(pdf(cv.file)).buffer);
  const [app] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: 'Nguyễn Thị Mai Anh',
      phone: '0912345678',
      email: 'maianh@gmail.com',
      cvPathname: pathname,
      cvFileName: cv.file ?? null,
      cvLink: cv.link ?? null,
      consentAt: t.clock.now,
      policyVersion: 'v',
    })
    .returning();
  return app;
}

const score = async (id: string) => json<ApplicationDetailDto>(await hr('POST', `/applications/${id}/score`));
const verdictOf = (items: MatchItem[], requirement: string) =>
  items.find((i) => i.requirement === requirement)?.verdict;

describe('POST /api/hr/applications/:id/score', () => {
  it('should read a text PDF and mark measurable requirements met, with a quote from the CV', async () => {
    // Arrange
    const app = await applyWith(await insertJob(t, SALES_JOB), { file: 'cv-simple-vi.pdf' });

    // Act
    const { cvScore } = await score(app.id);

    // Assert
    expect(cvScore?.note).toBeNull();
    const items = cvScore?.items ?? [];
    expect(items.map((i) => i.requirement)).toEqual([
      'Kinh nghiệm: Từ 2 năm',
      'Học vấn: Đại học',
      'Thành thạo Excel',
      'Có kinh nghiệm sử dụng CRM',
      'Chịu được áp lực công việc',
    ]);
    expect(verdictOf(items, 'Kinh nghiệm: Từ 2 năm')).toBe('met');
    expect(verdictOf(items, 'Học vấn: Đại học')).toBe('met');
    expect(verdictOf(items, 'Thành thạo Excel')).toBe('met');
    expect(verdictOf(items, 'Có kinh nghiệm sử dụng CRM')).toBe('met');
    expect(verdictOf(items, 'Chịu được áp lực công việc')).toBe('unknown');
    expect(items.find((i) => i.requirement === 'Thành thạo Excel')?.evidence).toMatch(/Excel/);
    expect(cvScore?.percent).toBe(100);
  });

  it('should mark a requirement the CV falls short of as unmet and lower the percent', async () => {
    const app = await applyWith(await insertJob(t, { ...SALES_JOB, experience: 'Từ 10 năm' }), {
      file: 'cv-simple-vi.pdf',
    });

    const { cvScore } = await score(app.id);

    expect(verdictOf(cvScore?.items ?? [], 'Kinh nghiệm: Từ 10 năm')).toBe('unmet');
    expect(cvScore?.percent).toBe(75);
  });

  it('should read a two-column PDF', async () => {
    const job = await insertJob(t, { requirements: 'Sử dụng thành thạo phần mềm MISA\nTốt nghiệp Đại học' });
    const app = await applyWith(job, { file: 'cv-two-column.pdf' });

    const { cvScore } = await score(app.id);

    expect(cvScore?.items.map((i) => i.verdict)).toEqual(['met', 'met']);
    expect(cvScore?.percent).toBe(100);
  });

  it('should give no percent and tell HR to look themselves when the PDF is a scanned image', async () => {
    const app = await applyWith(await insertJob(t, SALES_JOB), { file: 'cv-scanned-image.pdf' });

    const { cvScore } = await score(app.id);

    expect(cvScore?.percent).toBeNull();
    expect(cvScore?.note).toMatch(/ảnh scan/);
    expect(cvScore?.items.every((i) => i.verdict === 'unknown')).toBe(true);
  });

  it('should give no percent when the CV is a link', async () => {
    const app = await applyWith(await insertJob(t, SALES_JOB), { link: 'https://drive.google.com/file/d/x/view' });

    const { cvScore } = await score(app.id);

    expect(cvScore?.percent).toBeNull();
    expect(cvScore?.note).toMatch(/link/);
  });

  it('should keep the stored result while nothing changed and re-score when the requirements change', async () => {
    const job = await insertJob(t, SALES_JOB);
    const app = await applyWith(job, { file: 'cv-simple-vi.pdf' });
    const first = (await score(app.id)).cvScore;
    t.clock.now = new Date(t.clock.now.getTime() + 60_000);

    const again = (await score(app.id)).cvScore;
    await t.db.update(jobs).set({ experience: 'Từ 10 năm' }).where(eq(jobs.id, job.id));
    const changed = (await score(app.id)).cvScore;

    expect(again?.scoredAt).toBe(first?.scoredAt);
    expect(changed?.scoredAt).not.toBe(first?.scoredAt);
    expect(changed?.percent).toBe(75);
  });

  it('should re-score when the candidate replaces the CV file', async () => {
    const job = await insertJob(t, SALES_JOB);
    const app = await applyWith(job, { file: 'cv-simple-vi.pdf' });
    expect((await score(app.id)).cvScore?.percent).toBe(100);
    const scanned = `cv/test/${crypto.randomUUID()}.pdf`;
    t.cvStore.files.set(scanned, new Uint8Array(pdf('cv-scanned-image.pdf')).buffer);

    await t.db.update(applications).set({ cvPathname: scanned }).where(eq(applications.id, app.id));
    const { cvScore } = await score(app.id);

    expect(cvScore?.percent).toBeNull();
  });

  it('should show the percent in the applicant list', async () => {
    const app = await applyWith(await insertJob(t, SALES_JOB), { file: 'cv-simple-vi.pdf' });
    await score(app.id);

    const list = await json<ApplicationsResponse>(await hr('GET', '/applications'));

    expect(list.applications.find((a) => a.id === app.id)?.matchPercent).toBe(100);
  });

  it('should refuse visitors who are not signed in as HR', async () => {
    const app = await applyWith(await insertJob(t, SALES_JOB), { file: 'cv-simple-vi.pdf' });

    const res = await t.send('POST', `/api/hr/applications/${app.id}/score`);

    expect(res.status).toBe(401);
  });

  it('should answer 404 for an unknown application', async () => {
    const res = await hr('POST', `/applications/${crypto.randomUUID()}/score`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/hr/applications/score-pending', () => {
  it('should score every CV file without a result, a batch at a time, and skip CV links', async () => {
    // Arrange
    const job = await insertJob(t, SALES_JOB);
    for (let i = 0; i < SCORE_BATCH + 2; i += 1) await applyWith(job, { file: 'cv-simple-vi.pdf' });
    await applyWith(job, { link: 'https://drive.google.com/file/d/x/view' });

    // Act
    const first = await json<{ scored: number; remaining: number }>(await hr('POST', '/applications/score-pending'));
    const second = await json<{ scored: number; remaining: number }>(await hr('POST', '/applications/score-pending'));
    const third = await json<{ scored: number; remaining: number }>(await hr('POST', '/applications/score-pending'));

    // Assert
    expect(first).toEqual({ scored: SCORE_BATCH, remaining: 2 });
    expect(second).toEqual({ scored: 2, remaining: 0 });
    expect(third).toEqual({ scored: 0, remaining: 0 });
    const list = await json<ApplicationsResponse>(await hr('GET', '/applications'));
    expect(list.applications.filter((a) => a.matchPercent === 100)).toHaveLength(SCORE_BATCH + 2);
  });

  it('should score again after the job requirements change', async () => {
    const job = await insertJob(t, SALES_JOB);
    await applyWith(job, { file: 'cv-simple-vi.pdf' });
    await hr('POST', '/applications/score-pending');

    await t.db.update(jobs).set({ experience: 'Từ 10 năm' }).where(eq(jobs.id, job.id));
    const again = await json<{ scored: number; remaining: number }>(await hr('POST', '/applications/score-pending'));

    expect(again).toEqual({ scored: 1, remaining: 0 });
    const list = await json<ApplicationsResponse>(await hr('GET', '/applications'));
    expect(list.applications[0]?.matchPercent).toBe(75);
  });

  it('should refuse visitors who are not signed in as HR', async () => {
    const res = await t.send('POST', '/api/hr/applications/score-pending');

    expect(res.status).toBe(401);
  });
});
