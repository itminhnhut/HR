import type { ActivityDto, ApplicationDetailDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, applicationActivity, type Job } from '../db/schema.js';
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
      phone: `09140000${String(n).padStart(2, '0')}`,
      consentAt: t.clock.now,
      policyVersion: '2026-11',
      ...overrides,
    })
    .returning();
  return row;
}

const patch = async (id: string, body: unknown) =>
  json<ApplicationDetailDto>(await hr('PATCH', `/applications/${id}`, body));
const open = async (id: string) => json<ApplicationDetailDto>(await hr('GET', `/applications/${id}`));
const of = (log: readonly ActivityDto[], kind: ActivityDto['kind']) => log.filter((line) => line.kind === kind);

describe('Nhật ký hồ sơ', () => {
  it('should say who changed the status, from what to what, and why', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    const { activity } = await patch(app.id, { status: 'rejected', rejectReason: 'salary' });

    // Assert
    expect(of(activity, 'status')[0]).toMatchObject({
      actor: expect.any(String),
      from: 'seen',
      to: 'rejected',
      detail: 'salary',
      at: t.clock.now.toISOString(),
    });
    expect(of(activity, 'status')[0]?.actor.length).toBeGreaterThan(0);
  });

  it('should keep every change, newest first', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    await patch(app.id, { status: 'interview' });
    t.clock.now = new Date(t.clock.now.getTime() + 60_000);
    const { activity } = await patch(app.id, {
      status: 'rejected',
      rejectReason: 'other',
      rejectNote: 'Đã nhận nơi khác',
    });

    // Assert
    expect(of(activity, 'status').map((line) => line.to)).toEqual(['rejected', 'interview']);
  });

  it('should record who first opened a new application', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'new' });

    // Act
    const { activity } = await open(app.id);

    // Assert
    expect(of(activity, 'status')).toEqual([expect.objectContaining({ from: 'new', to: 'seen' })]);
  });

  it('should write nothing when an application is only opened again', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    const { activity } = await open(app.id);

    // Assert
    expect(activity).toEqual([]);
  });

  it('should keep an undo in the log, marked as one, since it did happen', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });
    await patch(app.id, { status: 'rejected', rejectReason: 'salary' });

    // Act
    const { activity } = await patch(app.id, { status: 'seen', isUndo: true });

    // Assert
    expect(of(activity, 'status').map((line) => [line.to, line.detail])).toEqual(
      expect.arrayContaining([
        ['seen', 'undo'],
        ['rejected', 'salary'],
      ]),
    );
  });

  it('should say how the interview time changed', async () => {
    // Arrange
    const before = new Date(t.clock.now.getTime() + 3_600_000);
    const after = new Date(t.clock.now.getTime() + 7_200_000);
    const app = await insertApplication(await insertJob(t), { status: 'interview', interviewAt: before });

    // Act
    const { activity } = await patch(app.id, { interviewAt: after.toISOString() });

    // Assert
    expect(of(activity, 'interview')).toEqual([
      expect.objectContaining({ from: before.toISOString(), to: after.toISOString() }),
    ]);
  });

  it('should count a note saved again and again while typing as one edit, and leave the words out', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    await patch(app.id, { note: 'Gọi' });
    t.clock.now = new Date(t.clock.now.getTime() + 60_000);
    const { activity } = await patch(app.id, { note: 'Gọi lại' });

    // Assert
    expect(of(activity, 'note')).toHaveLength(1);
    expect(of(activity, 'note')[0]).toMatchObject({ from: null, to: null, at: t.clock.now.toISOString() });
  });

  it('should write a later edit of the note as another line', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });
    await patch(app.id, { note: 'Gọi' });

    // Act
    t.clock.now = new Date(t.clock.now.getTime() + 11 * 60_000);
    const { activity } = await patch(app.id, { note: 'Gọi lại' });

    // Assert
    expect(of(activity, 'note')).toHaveLength(2);
  });

  it('should write nothing when nothing changed', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen', note: 'Gọi' });

    // Act
    const { activity } = await patch(app.id, { note: 'Gọi' });

    // Assert
    expect(activity).toEqual([]);
  });

  it('should say which contact detail HR changed', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), {
      status: 'seen',
      addedBy: 'Mai',
      phone: '0914000099',
      source: 'zalo',
    });

    // Act
    const res = await hr('PATCH', `/applications/${app.id}/contact`, {
      phone: '0914000098',
      email: '',
      source: 'zalo',
    });
    expect(res.status).toBeLessThan(300);
    const { activity } = await open(app.id);

    // Assert
    expect(of(activity, 'contact')).toEqual([
      expect.objectContaining({ detail: 'phone', from: '0914000099', to: '0914000098' }),
    ]);
  });

  it('should go with the application when it is deleted, as it names people', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });
    await patch(app.id, { status: 'rejected', rejectReason: 'salary' });

    // Act
    await hr('DELETE', `/applications/${app.id}`);

    // Assert
    expect(await t.db.select().from(applicationActivity)).toEqual([]);
  });
});
