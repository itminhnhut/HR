import type { DashboardDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, type Job, type NewApplication } from '../db/schema.js';
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

const dashboard = async () => json<DashboardDto>(await t.request('/api/hr/dashboard', { headers: { cookie } }));

let n = 0;
async function insertApplication(job: Job, overrides: Partial<NewApplication> = {}) {
  n += 1;
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: `Ứng viên ${n}`,
      phone: `09130000${String(n).padStart(2, '0')}`,
      consentAt: t.clock.now,
      policyVersion: 'v',
      status: 'seen',
      ...overrides,
    })
    .returning();
  return row;
}

describe('GET /api/hr/dashboard', () => {
  it('counts applications per Vietnam day over the last 30 days, oldest first', async () => {
    const job = await insertJob(t);
    const at = (iso: string) => insertApplication(job, { createdAt: new Date(iso) });
    await at('2026-09-20T16:59:00.000Z'); // 23:59 on 20/09 in Vietnam: before the window
    await at('2026-09-20T17:00:00.000Z'); // 00:00 on 21/09: first day
    await at('2026-10-19T16:30:00.000Z'); // 23:30 on 19/10
    await at('2026-10-19T17:30:00.000Z'); // 00:30 on 20/10
    await at('2026-10-20T02:00:00.000Z'); // 09:00 on 20/10

    const { perDay } = await dashboard();

    expect(perDay).toHaveLength(30);
    expect(perDay[0]).toEqual({ day: '2026-09-21', count: 1 });
    expect(perDay.at(-2)).toEqual({ day: '2026-10-19', count: 1 });
    expect(perDay.at(-1)).toEqual({ day: '2026-10-20', count: 2 });
    expect(perDay.reduce((sum, d) => sum + d.count, 0)).toBe(4);
  });

  it('splits the daily counts per job for the chart filter', async () => {
    const kySu = await insertJob(t, { title: 'Kỹ sư' });
    const keToan = await insertJob(t, { title: 'Kế toán' });
    await insertJob(t, { title: 'Không ai nộp' });
    await insertApplication(kySu, { createdAt: new Date('2026-10-20T01:00:00.000Z') });
    await insertApplication(kySu, { createdAt: new Date('2026-10-18T01:00:00.000Z') });
    await insertApplication(keToan, { createdAt: new Date('2026-10-20T01:00:00.000Z') });

    const { perJobPerDay } = await dashboard();

    const byTitle = Object.fromEntries(perJobPerDay.map((j) => [j.jobTitle, j.counts]));
    expect(Object.keys(byTitle).sort()).toEqual(['Kế toán', 'Kỹ sư']);
    expect(byTitle['Kỹ sư']).toHaveLength(30);
    expect([byTitle['Kỹ sư'][27], byTitle['Kỹ sư'][29]]).toEqual([1, 1]);
    expect(byTitle['Kế toán'].reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('counts new applications and those waiting since before the last 3 Vietnam days', async () => {
    const job = await insertJob(t);
    await insertApplication(job, { status: 'new', createdAt: new Date('2026-10-16T16:59:00.000Z') }); // 23:59 16/10
    await insertApplication(job, { status: 'new', createdAt: new Date('2026-10-16T17:00:00.000Z') }); // 00:00 17/10
    await insertApplication(job, { status: 'new', createdAt: new Date('2026-08-01T00:00:00.000Z') });
    await insertApplication(job, { status: 'seen', createdAt: new Date('2026-08-01T00:00:00.000Z') });

    const body = await dashboard();

    expect(body.newApplications).toBe(3);
    expect(body.waitingOver3Days).toBe(2);
  });

  it('lists interviews soonest first, those without a time last', async () => {
    const job = await insertJob(t, { title: 'Kỹ sư' });
    const later = await insertApplication(job, {
      status: 'interview',
      interviewAt: new Date('2026-10-23T02:00:00.000Z'),
    });
    const noTime = await insertApplication(job, { status: 'interview', note: 'Chờ chốt lịch\nGọi lại' });
    const sooner = await insertApplication(job, {
      status: 'interview',
      interviewAt: new Date('2026-10-21T02:00:00.000Z'),
    });
    await insertApplication(job, { status: 'rejected', interviewAt: new Date('2026-10-21T01:00:00.000Z') });

    const { interviews } = await dashboard();

    expect(interviews.map((i) => i.id)).toEqual([sooner.id, later.id, noTime.id]);
    expect(interviews[2]).toEqual({
      id: noTime.id,
      fullName: noTime.fullName,
      jobTitle: 'Kỹ sư',
      interviewAt: null,
      noteLine: 'Chờ chốt lịch',
    });
  });

  it('lists jobs ending within 3 days and jobs that expired in the last 14 days', async () => {
    await insertJob(t, { title: 'Sắp hết', deadline: '2026-10-22' });
    await insertJob(t, { title: 'Vừa hết', deadline: '2026-10-10', publishedOn: '2026-09-01' });
    await insertJob(t, { title: 'Hết lâu rồi', deadline: '2026-10-05', publishedOn: '2026-09-01' });
    await insertJob(t, { title: 'Còn lâu' });
    await insertJob(t, { title: 'Đã đóng', state: 'closed', closedOn: '2026-10-18', deadline: '2026-10-19' });

    const { endingJobs } = await dashboard();

    expect(endingJobs.map((j) => [j.title, j.deadline, j.status])).toEqual([
      ['Vừa hết', '2026-10-10', 'expired'],
      ['Sắp hết', '2026-10-22', 'expiring'],
    ]);
  });

  it('counts applications due for deletion: jobs that ended more than 30 days ago', async () => {
    const closed = await insertJob(t, { state: 'closed', closedOn: '2026-09-19', deadline: '2026-10-30' });
    const expired = await insertJob(t, { deadline: '2026-09-15', publishedOn: '2026-09-01' });
    const recent = await insertJob(t, { state: 'closed', closedOn: '2026-09-20', deadline: '2026-10-30' });
    await insertApplication(closed);
    await insertApplication(closed);
    await insertApplication(expired);
    await insertApplication(recent);

    expect((await dashboard()).dueForDeletion).toBe(3);
  });

  it('answers with empty figures when there is no data yet', async () => {
    const body = await dashboard();

    expect(body).toMatchObject({
      newApplications: 0,
      waitingOver3Days: 0,
      perJobPerDay: [],
      interviews: [],
      endingJobs: [],
      dueForDeletion: 0,
    });
    expect(body.perDay.every((d) => d.count === 0)).toBe(true);
  });
});
