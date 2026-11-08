import type { RecruitmentLogLineDto, RecruitmentLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, recruitmentLog, type Job } from '../db/schema.js';
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
      fullName: `Ứng viên Thử ${n}`,
      phone: `09150000${String(n).padStart(2, '0')}`,
      consentAt: t.clock.now,
      policyVersion: '2026-11',
      ...overrides,
    })
    .returning();
  return row;
}

const readLog = async (query = '') => json<RecruitmentLogPageDto>(await hr('GET', `/recruitment-log${query}`));
const linesOf = async (query = '') => (await readLog(query)).lines;
const later = (minutes: number) => {
  t.clock.now = new Date(t.clock.now.getTime() + minutes * 60_000);
};

describe('Nhật ký tuyển dụng: what is already written in "Nhật ký hồ sơ"', () => {
  it('should write a status change once, in plain words, with the application, who and when', async () => {
    // Arrange
    const job = await insertJob(t, { title: 'Kế toán tổng hợp' });
    const app = await insertApplication(job, { status: 'seen', fullName: 'Lê Thị Thử' });

    // Act
    await hr('PATCH', `/applications/${app.id}`, { status: 'rejected', rejectReason: 'salary' });

    // Assert
    const lines = await linesOf();
    expect(lines).toEqual([
      {
        id: expect.any(String),
        applicationId: app.id,
        candidateName: 'Lê Thị Thử',
        jobTitle: 'Kế toán tổng hợp',
        isDeleted: false,
        group: 'trang-thai',
        action: 'Đổi trạng thái',
        actor: 'Phòng Nhân sự',
        from: 'Đã xem',
        to: 'Chưa phù hợp',
        detail: expect.stringContaining('Lý do'),
        at: t.clock.now.toISOString(),
      },
    ]);
  });

  it('should mark an undo of the status as one', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });
    await hr('PATCH', `/applications/${app.id}`, { status: 'scheduling' });
    later(1);

    // Act
    await hr('PATCH', `/applications/${app.id}`, { status: 'seen', isUndo: true });

    // Assert
    const [undo] = await linesOf();
    expect(undo).toMatchObject({ action: 'Hoàn tác trạng thái', from: 'Chờ xếp lịch', to: 'Đã xem' });
  });

  it('should write who first opened a new application', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'new' });

    // Act
    await hr('GET', `/applications/${app.id}`);
    await hr('GET', `/applications/${app.id}`);

    // Assert
    expect(await linesOf()).toEqual([expect.objectContaining({ group: 'trang-thai', from: 'Mới', to: 'Đã xem' })]);
  });

  it('should write a new interview time under "Lịch phỏng vấn", as a time people read', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'interview' });

    // Act
    await hr('PATCH', `/applications/${app.id}`, { interviewAt: '2026-10-22T02:00:00.000Z' });

    // Assert
    const [line] = await linesOf('?nhom=phong-van');
    expect(line).toMatchObject({
      action: 'Đổi giờ phỏng vấn',
      from: 'Chưa chọn',
      to: expect.stringContaining('22/10'),
    });
    expect(line?.to).toContain('09:00');
  });

  it('should write each contact detail HR fixed under "Hồ sơ", old → new', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), {
      status: 'seen',
      addedBy: 'Mai',
      phone: '0915000099',
      source: 'zalo',
    });

    // Act
    const res = await hr('PATCH', `/applications/${app.id}/contact`, {
      phone: '0915000098',
      email: '',
      source: 'zalo',
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await linesOf()).toEqual([
      expect.objectContaining({ group: 'ho-so', action: 'Sửa số điện thoại', from: '0915000099', to: '0915000098' }),
    ]);
  });

  it('should write a letter HR prepared under "Liên hệ", with the letter and how', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'interview' });

    // Act
    await hr('POST', `/applications/${app.id}/contacts`, { templateKey: 'interview_onsite', channel: 'gmail' });

    // Assert
    expect(await linesOf()).toEqual([
      expect.objectContaining({
        group: 'lien-he',
        action: 'Soạn thư',
        detail: 'Mời phỏng vấn trực tiếp (Mở Gmail)',
        actor: 'Phòng Nhân sự',
      }),
    ]);
  });

  it('should still keep "Nhật ký hồ sơ" of the application as before', async () => {
    // Arrange
    const app = await insertApplication(await insertJob(t), { status: 'seen' });

    // Act
    await hr('PATCH', `/applications/${app.id}`, { status: 'scheduling' });
    const detail = await json<{ activity: { kind: string; from: string; to: string }[] }>(
      await hr('GET', `/applications/${app.id}`),
    );

    // Assert
    expect(detail.activity).toEqual([expect.objectContaining({ kind: 'status', from: 'seen', to: 'scheduling' })]);
  });
});

describe('Reading the Nhật ký tuyển dụng', () => {
  async function seed() {
    const job = await insertJob(t, { title: 'Nhân viên kho' });
    const an = await insertApplication(job, { status: 'seen', fullName: 'Trần Văn Thử' });
    const binh = await insertApplication(job, { status: 'interview', fullName: 'Phạm Thị Mẫu' });
    await hr('PATCH', `/applications/${an.id}`, { status: 'scheduling' });
    later(1);
    await hr('PATCH', `/applications/${binh.id}`, { interviewAt: '2026-10-23T03:00:00.000Z' });
    return { an, binh };
  }

  it('should put the newest first', async () => {
    // Arrange
    await seed();

    // Act
    const lines = await linesOf();

    // Assert
    expect(lines.map((l) => l.candidateName)).toEqual(['Phạm Thị Mẫu', 'Trần Văn Thử']);
  });

  it('should show only the group asked for', async () => {
    // Arrange
    await seed();

    // Act
    const lines = await linesOf('?nhom=trang-thai');

    // Assert
    expect(lines.map((l) => l.candidateName)).toEqual(['Trần Văn Thử']);
  });

  it.each([
    ['the candidate name, without tones or case', 'tran van'],
    ['who did it', 'nhân sự'],
    ['the words of the change', 'Chờ xếp'],
  ])('should find lines by %s', async (_what, words) => {
    // Arrange
    await seed();

    // Act
    const lines = await linesOf(`?tim=${encodeURIComponent(words)}`);

    // Assert
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l: RecruitmentLogLineDto) => l.candidateName === 'Trần Văn Thử' || words === 'nhân sự')).toBe(
      true,
    );
  });

  it('should give 100 lines at a time and say when there are more', async () => {
    // Arrange
    const values = Array.from({ length: 101 }, (_, i) => ({
      actor: 'Phòng Nhân sự',
      action: 'Thêm nguồn',
      group: 'nguon' as const,
      toValue: `Nguồn ${i}`,
      at: new Date(t.clock.now.getTime() - i * 60_000),
    }));
    await t.db.insert(recruitmentLog).values(values);

    // Act
    const first = await readLog();
    const rest = await readLog('?tu=100');

    // Assert
    expect(first.lines).toHaveLength(100);
    expect(first.hasMore).toBe(true);
    expect(rest).toMatchObject({ hasMore: false, lines: [expect.objectContaining({ to: 'Nguồn 100' })] });
  });

  it('should refuse a group it does not know', async () => {
    // Act
    const res = await hr('GET', '/recruitment-log?nhom=khac');

    // Assert
    expect(res.status).toBe(422);
  });

  it('should be for signed-in HR only', async () => {
    // Act
    const res = await t.request('/api/hr/recruitment-log');

    // Assert
    expect(res.status).toBe(401);
  });
});
