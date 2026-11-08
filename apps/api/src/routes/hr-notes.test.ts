import type { ApplicationDetailDto, ApplicationsResponse, DashboardDto, RecruitmentLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applicationNotes, applications, type Job } from '../db/schema.js';
import { upsertHrUser } from '../services/hr-accounts.js';
import { HR_PASSWORD, insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
let job: Job;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
  job = await insertJob(t, { title: 'Thu ngân' });
});

const hr = (method: string, path: string, body?: unknown, withCookie = cookie) =>
  t.send(method, `/api/hr${path}`, body, { cookie: withCookie });

let n = 0;
async function insertApplication(overrides: Partial<typeof applications.$inferInsert> = {}) {
  n += 1;
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: `Ứng viên Ghi ${n}`,
      phone: `09170000${String(n).padStart(2, '0')}`,
      status: 'seen',
      consentAt: t.clock.now,
      policyVersion: '2026-11',
      ...overrides,
    })
    .returning();
  return row;
}

const later = (minutes: number) => {
  t.clock.now = new Date(t.clock.now.getTime() + minutes * 60_000);
};
const addNote = async (id: string, body: string) =>
  json<ApplicationDetailDto>(await hr('POST', `/applications/${id}/notes`, { body }));
const logOf = async () => (await json<RecruitmentLogPageDto>(await hr('GET', '/recruitment-log?nhom=ghi-chu'))).lines;

describe('Ghi chú nội bộ as a timeline', () => {
  it('should add notes one after another, newest first, each with its time and author', async () => {
    // Arrange
    const app = await insertApplication();
    await addNote(app.id, 'T7 gọi chưa được');
    later(60);

    // Act
    const detail = await addNote(app.id, '  T2 gọi chưa được  ');

    // Assert
    expect(detail.notes.map((note) => note.body)).toEqual(['T2 gọi chưa được', 'T7 gọi chưa được']);
    expect(detail.notes[0]).toMatchObject({
      createdBy: 'Phòng Nhân sự',
      createdAt: t.clock.now.toISOString(),
      updatedAt: t.clock.now.toISOString(),
    });
  });

  it('should log each note added with its words', async () => {
    // Arrange
    const app = await insertApplication({ fullName: 'Lâm Thị Ghi' });

    // Act
    await addNote(app.id, 'Ứng viên hẹn T3');

    // Assert
    expect(await logOf()).toEqual([
      expect.objectContaining({
        action: 'Thêm ghi chú',
        to: 'Ứng viên hẹn T3',
        candidateName: 'Lâm Thị Ghi',
        actor: 'Phòng Nhân sự',
      }),
    ]);
  });

  it('should refuse an empty note', async () => {
    // Arrange
    const app = await insertApplication();

    // Act
    const res = await hr('POST', `/applications/${app.id}/notes`, { body: '   ' });

    // Assert
    expect(res.status).toBe(422);
  });

  it("should let another HR edit someone's note, and keep the old words in the log", async () => {
    // Arrange
    const app = await insertApplication();
    const [note] = (await addNote(app.id, 'Hẹn gọi T3')).notes;
    await upsertHrUser(t.db, { email: 'khac@congty.vn', name: 'Chị Khác', password: HR_PASSWORD });
    const other = await loginHr(t, 'khac@congty.vn');
    later(5);

    // Act
    const res = await hr('PATCH', `/applications/${app.id}/notes/${note?.id}`, { body: 'Hẹn gọi T4' }, other);

    // Assert
    expect(res.status).toBe(200);
    const detail = await json<ApplicationDetailDto>(res);
    expect(detail.notes).toEqual([
      expect.objectContaining({ body: 'Hẹn gọi T4', createdBy: 'Phòng Nhân sự', updatedAt: t.clock.now.toISOString() }),
    ]);
    expect((await logOf())[0]).toMatchObject({
      action: 'Sửa ghi chú',
      from: 'Hẹn gọi T3',
      to: 'Hẹn gọi T4',
      actor: 'Chị Khác',
    });
  });

  it('should write nothing when an edit leaves the words as they were', async () => {
    // Arrange
    const app = await insertApplication();
    const [note] = (await addNote(app.id, 'Hẹn gọi T3')).notes;

    // Act
    await hr('PATCH', `/applications/${app.id}/notes/${note?.id}`, { body: ' Hẹn gọi T3 ' });

    // Assert
    expect((await logOf()).map((l) => l.action)).toEqual(['Thêm ghi chú']);
  });

  it('should delete a note and keep its words in the log', async () => {
    // Arrange
    const app = await insertApplication();
    const [note] = (await addNote(app.id, 'Số này sai')).notes;

    // Act
    const res = await hr('DELETE', `/applications/${app.id}/notes/${note?.id}`);

    // Assert
    expect(res.status).toBe(200);
    expect((await json<ApplicationDetailDto>(res)).notes).toEqual([]);
    // Added and deleted in the same instant: find the line rather than rely on the order of equal times.
    expect((await logOf()).find((l) => l.action === 'Xoá ghi chú')).toMatchObject({ from: 'Số này sai', to: null });
  });

  it("should not find a note through another application's address", async () => {
    // Arrange
    const [mine, other] = [await insertApplication(), await insertApplication()];
    const [note] = (await addNote(mine.id, 'Của hồ sơ khác')).notes;

    // Act
    const edit = await hr('PATCH', `/applications/${other.id}/notes/${note?.id}`, { body: 'x' });
    const remove = await hr('DELETE', `/applications/${other.id}/notes/khong-phai-id`);

    // Assert
    expect([edit.status, remove.status]).toEqual([404, 404]);
  });

  it('should still write "Sửa ghi chú" in the application’s own log, without the words', async () => {
    // Arrange
    const app = await insertApplication();

    // Act
    const detail = await addNote(app.id, 'Riêng tư');

    // Assert
    expect(detail.activity).toEqual([expect.objectContaining({ kind: 'note', detail: 'add', from: null, to: null })]);
  });
});

describe('The newest note elsewhere', () => {
  it('should show the first line of the newest note on the list row and the dashboard', async () => {
    // Arrange
    const app = await insertApplication({ status: 'interview', note: 'Cột cũ, không đọc nữa' });
    await t.db.insert(applicationNotes).values([
      { applicationId: app.id, body: 'Ghi chú trước', createdAt: new Date('2026-10-01T00:00:00Z') },
      { applicationId: app.id, body: '\n  Gọi lại thứ 5  \nChi tiết', createdAt: new Date('2026-10-02T00:00:00Z') },
    ]);

    // Act
    const list = await json<ApplicationsResponse>(await hr('GET', '/applications'));
    const dashboard = await json<DashboardDto>(await hr('GET', '/dashboard'));

    // Assert
    expect(list.applications[0]?.noteLine).toBe('Gọi lại thứ 5');
    expect(dashboard.interviews[0]?.noteLine).toBe('Gọi lại thứ 5');
  });

  it('should keep note, noteUpdatedAt and noteUpdatedBy of the detail as the newest note, for older screens', async () => {
    // Arrange
    const app = await insertApplication({ note: 'Cột cũ' });
    await addNote(app.id, 'Mới nhất');

    // Act
    const detail = await json<ApplicationDetailDto>(await hr('GET', `/applications/${app.id}`));

    // Assert
    expect(detail).toMatchObject({
      note: 'Mới nhất',
      noteUpdatedAt: t.clock.now.toISOString(),
      noteUpdatedBy: 'Phòng Nhân sự',
    });
  });
});

describe('PATCH /applications/:id with note, as before', () => {
  it('should add the note as an entry', async () => {
    // Arrange
    const app = await insertApplication();

    // Act
    const detail = await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, { note: ' Đã gọi ' }));

    // Assert
    expect(detail.notes).toEqual([expect.objectContaining({ body: 'Đã gọi', createdBy: 'Phòng Nhân sự' })]);
    expect(detail).toMatchObject({ note: 'Đã gọi', noteLine: 'Đã gọi' });
  });

  it.each([
    ['the same words as the newest note', 'Đã gọi'],
    ['an empty note', ''],
    ['no note', null],
  ])('should add nothing for %s', async (_what, note) => {
    // Arrange
    const app = await insertApplication();
    await addNote(app.id, 'Đã gọi');

    // Act
    const detail = await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, { note }));

    // Assert
    expect(detail.notes.map((x) => x.body)).toEqual(['Đã gọi']);
  });
});

describe('Adding an application with a note', () => {
  it('should make the note its first entry', async () => {
    // Arrange
    const form = new FormData();
    for (const [k, v] of Object.entries({
      jobId: job.id,
      fullName: 'Kim Văn Ghi',
      phone: '0917 555 666',
      source: 'zalo',
      consent: 'true',
      note: 'Gửi qua Zalo tối qua',
    }))
      form.append(k, v);

    // Act
    const res = await t.request('/api/hr/applications', {
      method: 'POST',
      body: form,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });

    // Assert
    const { id } = await json<{ id: string }>(res);
    const detail = await json<ApplicationDetailDto>(await hr('GET', `/applications/${id}`));
    expect(detail.notes).toEqual([
      expect.objectContaining({ body: 'Gửi qua Zalo tối qua', createdBy: 'Phòng Nhân sự' }),
    ]);
  });
});
