import type { ApplicationDetailDto, ApplicationsResponse, DashboardDto } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, applicationStatusLog, type Job } from '../db/schema.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

/** "Chờ xếp lịch": called, no interview time agreed yet (spec-cho-xep-lich.md). Cases TC-XL-01..04. */

let t: TestContext;
let cookie: string;
let job: Job;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
  job = await insertJob(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const TOMORROW_9 = '2026-10-21T02:00:00.000Z';

let n = 0;
async function insertApplication(overrides: Partial<typeof applications.$inferInsert> = {}) {
  n += 1;
  const [row] = await t.db
    .insert(applications)
    .values({ jobId: job.id, fullName: `Ứng viên ${n}`, phone: `09130000${String(n).padStart(2, '0')}`, consentAt: t.clock.now, policyVersion: '2026-11', ...overrides })
    .returning();
  if (!row) throw new Error('No application');
  return row;
}

const patch = async (id: string, body: unknown) => {
  const res = await hr('PATCH', `/applications/${id}`, body);
  return { status: res.status, body: (await res.json()) as ApplicationDetailDto & { error?: string } };
};

describe('waiting to schedule an interview', () => {
  it('TC-XL-01: should move a seen application to "Chờ xếp lịch" without an interview time, and log it', async () => {
    // Arrange
    const app = await insertApplication({ status: 'seen' });

    // Act
    const answer = await patch(app.id, { status: 'scheduling', note: 'Đã gọi, bận thứ 7, chưa xếp được lịch PV' });

    // Assert
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ status: 'scheduling', interviewAt: null, note: 'Đã gọi, bận thứ 7, chưa xếp được lịch PV' });
    expect(answer.body.activity.map((a) => a.kind)).toContain('status');
  });

  it('TC-XL-02: should drop a stand-in interview time when the application goes back to "Chờ xếp lịch"', async () => {
    // Arrange: "Hẹn phỏng vấn" with a time HR only put there for now
    const app = await insertApplication({ status: 'interview', interviewAt: new Date(TOMORROW_9), interviewMode: 'onsite' });

    // Act
    const answer = await patch(app.id, { status: 'scheduling' });
    const dashboard = await json<DashboardDto>(await hr('GET', '/dashboard'));

    // Assert
    expect(answer.body).toMatchObject({ status: 'scheduling', interviewAt: null, interviewMode: null });
    expect(dashboard.interviews.map((i) => i.id)).not.toContain(app.id);
  });

  it('TC-XL-03: should still ask for a time when it moves on to "Hẹn phỏng vấn", and refuse a result before that', async () => {
    // Arrange
    const app = await insertApplication({ status: 'scheduling' });

    // Act
    const timeWithout = await patch(app.id, { status: 'scheduling', interviewAt: TOMORROW_9 });
    const result = await patch(app.id, { status: 'passed' });
    const invited = await patch(app.id, { status: 'interview', interviewAt: TOMORROW_9, interviewMode: 'onsite' });

    // Assert
    expect(timeWithout.status).toBe(422);
    expect(result.status).toBe(422);
    expect(invited.body).toMatchObject({ status: 'interview', interviewAt: TOMORROW_9 });
  });

  it('TC-XL-04: should count it apart in the list and on the dashboard, and not as a step reached in the reports', async () => {
    // Arrange
    const app = await insertApplication({ status: 'seen' });
    await insertApplication({ status: 'seen' });
    await patch(app.id, { status: 'scheduling' });

    // Act
    const list = await json<ApplicationsResponse>(await hr('GET', '/applications'));
    const dashboard = await json<DashboardDto>(await hr('GET', '/dashboard'));
    const steps = await t.db.select().from(applicationStatusLog).where(eq(applicationStatusLog.applicationId, app.id));

    // Assert
    expect(list.counts).toMatchObject({ scheduling: 1, seen: 1 });
    expect(dashboard.statusCounts).toMatchObject({ scheduling: 1, seen: 1 });
    expect(list.applications.find((a) => a.id === app.id)?.status).toBe('scheduling');
    expect(steps.map((s) => s.toStatus)).not.toContain('scheduling');
  });
});
