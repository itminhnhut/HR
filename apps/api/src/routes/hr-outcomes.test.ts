import {
  addDays,
  todayInVietnam,
  type ApplicationDetailDto,
  type DashboardDto,
  type RejectReason,
} from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, applicationStatusLog, type Job } from '../db/schema.js';
import { logStatus } from '../services/status-log.js';
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

let n = 0;
async function insertApplication(job: Job, overrides: Partial<typeof applications.$inferInsert> = {}) {
  n += 1;
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: `Ứng viên ${n}`,
      phone: `09130000${String(n).padStart(2, '0')}`,
      consentAt: t.clock.now,
      policyVersion: '2026-11',
      createdAt: new Date(t.clock.now.getTime() - 60_000),
      ...overrides,
    })
    .returning();
  await logStatus(t.db, row, 'new', null, row.createdAt);
  return row;
}

const interviewedOn = () => new Date(t.clock.now.getTime() - 3_600_000);

async function interviewed(job: Job, overrides: Partial<typeof applications.$inferInsert> = {}) {
  const row = await insertApplication(job, { status: 'interview', interviewAt: interviewedOn(), ...overrides });
  await logStatus(t.db, row, 'interview');
  return row;
}

const patch = async (id: string, body: unknown) => hr('PATCH', `/applications/${id}`, body);
const dashboard = async () => json<DashboardDto>(await hr('GET', '/dashboard'));

describe('the result of an interview', () => {
  it('should keep the interview date when HR records a pass, and clear the meeting link', async () => {
    // Arrange
    const app = await interviewed(await insertJob(t), { meetingUrl: 'https://meet.google.com/abc' });

    // Act
    const body = await json<ApplicationDetailDto>(await patch(app.id, { status: 'passed' }));

    // Assert
    expect(body).toMatchObject({ status: 'passed', interviewAt: interviewedOn().toISOString(), meetingUrl: null });
  });

  it('should move a passed application on to hired', async () => {
    // Arrange
    const app = await interviewed(await insertJob(t));
    await patch(app.id, { status: 'passed' });

    // Act
    const body = await json<ApplicationDetailDto>(await patch(app.id, { status: 'hired' }));

    // Assert
    expect(body.status).toBe('hired');
    expect(body.interviewAt).not.toBeNull();
  });

  it('should refuse a result for someone with no interview time', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'interview' });

    // Act
    const res = await patch(app.id, { status: 'passed' });

    // Assert
    expect(res.status).toBe(422);
  });
});

describe('the flow, enforced by the server too', () => {
  const statusOf = async (id: string) =>
    (await t.db.select().from(applications).where(eq(applications.id, id)))[0]?.status;

  it.each([
    ['a result before the interview', 'interview', 3_600_000, 'passed'],
    ['"Nhận việc" before "Đạt"', 'interview', -3_600_000, 'hired'],
    ['"Mới" for someone with an interview', 'interview', 3_600_000, 'new'],
  ] as const)('should refuse %s and change nothing', async (_name, status, offset, to) => {
    // Arrange
    const interviewAt = new Date(t.clock.now.getTime() + offset);
    const app = await insertApplication(await insertJob(t), { status, interviewAt });

    // Act
    const res = await patch(app.id, { status: to });

    // Assert
    expect(res.status).toBe(422);
    expect(await statusOf(app.id)).toBe(status);
  });

  it('should keep the interview date when "Đạt" was a mistake and goes back to waiting', async () => {
    // Arrange
    const app = await interviewed(await insertJob(t));
    await patch(app.id, { status: 'passed' });

    // Act
    const body = await json<ApplicationDetailDto>(
      await patch(app.id, { status: 'interview', interviewAt: interviewedOn().toISOString() }),
    );

    // Assert
    expect(body).toMatchObject({ status: 'interview', interviewAt: interviewedOn().toISOString() });
  });

  it('should stop counting steps that a correction took back', async () => {
    // Arrange
    const app = await interviewed(await insertJob(t), { source: 'website' });
    await patch(app.id, { status: 'passed' });
    await patch(app.id, { status: 'hired' });

    // Act: both were wrong, long past the five seconds of "Hoàn tác".
    await patch(app.id, { status: 'passed' });
    await patch(app.id, { status: 'interview', interviewAt: interviewedOn().toISOString() });

    // Assert
    expect((await dashboard()).sourceFunnel[0]).toMatchObject({ received: 1, interview: 1, passed: 0, hired: 0 });
  });

  it('should still count an interview for someone turned down after it', async () => {
    // Arrange
    const app = await interviewed(await insertJob(t), { source: 'website' });

    // Act
    await patch(app.id, { status: 'rejected', rejectReason: 'skills' });

    // Assert
    expect((await dashboard()).sourceFunnel[0]).toMatchObject({ interview: 1, topRejectReason: 'skills' });
  });

  it('should drop the reason from the numbers when someone turned down by mistake is invited again', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen', source: 'website' });
    await patch(app.id, { status: 'rejected', rejectReason: 'salary' });

    // Act
    await patch(app.id, { status: 'interview' });

    // Assert
    expect((await dashboard()).sourceFunnel[0]).toMatchObject({ interview: 1, topRejectReason: null });
  });
});

describe('why an application is turned down', () => {
  it('should refuse "Chưa phù hợp" without a reason', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    const res = await patch(app.id, { status: 'rejected' });

    // Assert
    expect(res.status).toBe(422);
    const [row] = await t.db.select().from(applications).where(eq(applications.id, app.id));
    expect(row.status).toBe('seen');
  });

  it('should keep the reason and its note', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    const body = await json<ApplicationDetailDto>(
      await patch(app.id, { status: 'rejected', rejectReason: 'other', rejectNote: 'Đã nhận nơi khác' }),
    );

    // Assert
    expect(body).toMatchObject({ rejectReason: 'other', rejectNote: 'Đã nhận nơi khác' });
  });

  it('should ask for the details when the reason is "Khác"', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    const res = await patch(app.id, { status: 'rejected', rejectReason: 'other' });

    // Assert
    expect(res.status).toBe(422);
  });

  it('should clear the reason when the application is taken back', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });
    await patch(app.id, { status: 'rejected', rejectReason: 'salary' });

    // Act
    const body = await json<ApplicationDetailDto>(await patch(app.id, { status: 'interview' }));

    // Assert
    expect(body.rejectReason).toBeNull();
  });
});

describe('undoing a status change', () => {
  it('should bring back the status with its interview date and leave no mark in the numbers', async () => {
    // Arrange
    const job = await insertJob(t);
    const app = await interviewed(job);
    await patch(app.id, { status: 'passed' });

    // Act
    const body = await json<ApplicationDetailDto>(
      await patch(app.id, { status: 'interview', interviewAt: interviewedOn().toISOString(), isUndo: true }),
    );

    // Assert
    expect(body).toMatchObject({ status: 'interview', interviewAt: interviewedOn().toISOString() });
    const { sourceFunnel } = await dashboard();
    expect(sourceFunnel[0]).toMatchObject({ received: 1, interview: 1, passed: 0 });
  });

  it('should bring an old "Chưa phù hợp" with no reason back without asking for one', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'rejected' });
    await patch(app.id, { status: 'seen' });

    // Act
    const res = await patch(app.id, { status: 'rejected', isUndo: true });

    // Assert
    expect(res.status).toBe(200);
  });
});

describe('the report by source', () => {
  async function reject(id: string, rejectReason: RejectReason) {
    await patch(id, { status: 'rejected', rejectReason });
  }

  it('should count how far each application ever got, not where it stands now', async () => {
    // Arrange: one turned down after the interview still counts as interviewed.
    const job = await insertJob(t);
    const rejected = await interviewed(job, { source: 'website' });
    await reject(rejected.id, 'lacks_experience');
    const hired = await interviewed(job, { source: 'website' });
    await patch(hired.id, { status: 'passed' });
    await patch(hired.id, { status: 'hired' });
    await insertApplication(job, { source: 'website' });

    // Act
    const { sourceFunnel } = await dashboard();

    // Assert
    expect(sourceFunnel).toEqual([
      { source: 'website', received: 3, interview: 2, passed: 1, hired: 1, topRejectReason: 'lacks_experience' },
    ]);
  });

  it('should keep the numbers after the application itself is deleted', async () => {
    // Arrange
    const app = await interviewed(await insertJob(t), { source: 'website' });
    await reject(app.id, 'salary');

    // Act
    await t.db.delete(applications).where(eq(applications.id, app.id));

    // Assert
    const { sourceFunnel } = await dashboard();
    expect(sourceFunnel[0]).toMatchObject({ received: 1, interview: 1, topRejectReason: 'salary' });
  });

  it('should keep no name, phone or email in the log', async () => {
    // Arrange
    await interviewed(await insertJob(t));

    // Act
    const [row] = await t.db.select().from(applicationStatusLog);

    // Assert
    expect(Object.keys(row).sort()).toEqual(
      ['applicationId', 'createdAt', 'id', 'jobId', 'rejectReason', 'source', 'toStatus'].sort(),
    );
  });

  it('should leave out applications that came in before the period', async () => {
    // Arrange
    const old = new Date(t.clock.now.getTime() - 31 * 24 * 3_600_000);
    await insertApplication(await insertJob(t), { createdAt: old });

    // Act
    const { sourceFunnel } = await dashboard();

    // Assert
    expect(sourceFunnel).toEqual([]);
  });

  it('should count an application sent through the public form', async () => {
    // Arrange: added by HR through the real route is covered in cv-intake; here the log row is what the report reads.
    const job = await insertJob(t);
    await insertApplication(job);

    // Act
    const { sourceFunnel, awaitingResults } = await dashboard();

    // Assert
    expect(sourceFunnel[0]?.received).toBe(1);
    expect(awaitingResults).toBe(0);
  });
});

describe('the period of the reports', () => {
  const dayOf = (daysAgo: number) => addDays(todayInVietnam(t.clock.now), -daysAgo);
  const report = async (from: string, to: string) =>
    json<DashboardDto>(await hr('GET', `/dashboard?from=${from}&to=${to}`));
  const at = (daysAgo: number) => new Date(`${dayOf(daysAgo)}T05:00:00.000+07:00`);

  it('should show 30 days unless asked otherwise', async () => {
    expect((await dashboard()).perDay).toHaveLength(30);
  });

  it('should count only the days of the chosen period, every report alike', async () => {
    // Arrange
    const job = await insertJob(t);
    await insertApplication(job, { createdAt: at(5) });
    await insertApplication(job, { createdAt: at(1) });

    // Act
    const body = await report(dayOf(2), dayOf(0));

    // Assert
    expect(body.perDay.map((d) => d.count)).toEqual([0, 1, 0]);
    expect(body.bySource[0]?.count).toBe(1);
    expect(body.sourceFunnel[0]?.received).toBe(1);
  });

  it('should answer for several years', async () => {
    expect((await report('2020-01-01', '2022-12-31')).perDay).toHaveLength(1096);
  });

  it('should keep the application in the charts after it is deleted', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { createdAt: at(1), source: 'website' });

    // Act
    await t.db.delete(applications).where(eq(applications.id, app.id));

    // Assert
    const body = await report(dayOf(2), dayOf(0));
    expect(body.perDay.map((d) => d.count)).toEqual([0, 1, 0]);
    expect(body.bySource[0]).toEqual({ source: 'website', count: 1 });
    expect(body.last7Days).toBe(1);
  });

  it('should not count an application twice when HR marks it unread again', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { createdAt: at(1), status: 'seen' });

    // Act
    await patch(app.id, { status: 'new' });

    // Assert
    expect((await report(dayOf(2), dayOf(0))).perDay.map((d) => d.count)).toEqual([0, 1, 0]);
  });

  it('should keep a real step when undoing a mark that was never written down', async () => {
    // Arrange
    const app = await interviewed(await insertJob(t), { createdAt: at(1) });
    await patch(app.id, { status: 'new' });

    // Act
    await patch(app.id, { status: 'interview', interviewAt: interviewedOn().toISOString(), isUndo: true });

    // Assert
    expect((await report(dayOf(2), dayOf(0))).sourceFunnel[0]).toMatchObject({ received: 1, interview: 1 });
  });

  it('should answer for a whole year', async () => {
    expect((await report('2025-01-01', '2025-12-31')).perDay).toHaveLength(365);
  });

  it('should answer for a single day', async () => {
    expect((await report(dayOf(0), dayOf(0))).perDay).toHaveLength(1);
  });

  it('should keep the 7-day figure whatever the period', async () => {
    // Arrange
    await insertApplication(await insertJob(t), { createdAt: at(1) });

    // Act
    const body = await report(dayOf(40), dayOf(35));

    // Assert
    expect(body.last7Days).toBe(1);
  });

  it.each([
    ['backwards', '2026-11-05', '2026-11-01'],
    ['not a date', 'hom-nay', '2026-11-01'],
    ['too long', '2010-01-01', '2026-11-01'],
  ])('should refuse a period that is %s', async (_name, from, to) => {
    expect((await hr('GET', `/dashboard?from=${from}&to=${to}`)).status).toBe(422);
  });
});

describe('how many stand at each status', () => {
  it('should count every status, the new ones too, whatever the period', async () => {
    // Arrange
    const job = await insertJob(t);
    const statuses = ['new', 'seen', 'interview', 'passed', 'hired', 'rejected'] as const;
    for (const status of statuses) await insertApplication(job, { status });
    await insertApplication(job, { status: 'passed' });

    // Act
    const { statusCounts } = await json<DashboardDto>(await hr('GET', '/dashboard?from=2020-01-01&to=2020-01-02'));

    // Assert
    expect(statusCounts).toEqual({ new: 1, seen: 1, interview: 1, passed: 2, hired: 1, rejected: 1 });
  });
});

describe('interviews waiting for a result', () => {
  it('should count those whose time has passed, not those still to come', async () => {
    // Arrange
    const job = await insertJob(t);
    await interviewed(job);
    await insertApplication(job, {
      status: 'interview',
      interviewAt: new Date(t.clock.now.getTime() + 3_600_000),
    });

    // Act
    const { awaitingResults } = await dashboard();

    // Assert
    expect(awaitingResults).toBe(1);
  });
});
