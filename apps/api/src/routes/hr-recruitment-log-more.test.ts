import type { RecruitmentLogLineDto, RecruitmentLogPageDto, ReviewBatchDto, SourceDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, type Job } from '../db/schema.js';
import { googleToken, pdfFile } from '../test/fakes.js';
import { cookiesFrom, insertJob, json, loginHr } from '../test/fixtures.js';
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
  job = await insertJob(t, { title: 'Nhân viên bán hàng' });
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const boss = (method: string, path: string, body?: unknown) => t.send(method, `/api/review${path}`, body);
const multipart = (fields: Record<string, string>, file?: File) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append('cv', file);
  return form;
};
const sendForm = (method: string, path: string, body: FormData, withCookie = cookie) =>
  t.request(path, { method, body, headers: { cookie: withCookie, 'x-requested-with': 'careers-web' } });

let n = 0;
async function insertApplication(overrides: Partial<typeof applications.$inferInsert> = {}) {
  n += 1;
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: `Ứng viên Mẫu ${n}`,
      phone: `09160000${String(n).padStart(2, '0')}`,
      email: `mau${n}@mail.test`,
      status: 'seen',
      consentAt: t.clock.now,
      policyVersion: '2026-11',
      ...overrides,
    })
    .returning();
  return row;
}

const linesOf = async (query = '') =>
  (await json<RecruitmentLogPageDto>(await hr('GET', `/recruitment-log${query}`))).lines;
const later = (minutes: number) => {
  t.clock.now = new Date(t.clock.now.getTime() + minutes * 60_000);
};

describe('Nhật ký tuyển dụng: adding an application and its CV', () => {
  it('should write "Thêm hồ sơ" with its source when HR adds one', async () => {
    // Arrange
    const fields = {
      jobId: job.id,
      fullName: 'Hoàng Văn Mẫu',
      phone: '0916 111 222',
      source: 'zalo',
      consent: 'true',
    };

    // Act
    const res = await sendForm('POST', '/api/hr/applications', multipart(fields));

    // Assert
    expect(res.status).toBe(201);
    expect(await linesOf()).toEqual([
      expect.objectContaining({
        group: 'ho-so',
        action: 'Thêm hồ sơ',
        candidateName: 'Hoàng Văn Mẫu',
        jobTitle: 'Nhân viên bán hàng',
        detail: 'Nguồn: Zalo',
        actor: 'Phòng Nhân sự',
      }),
    ]);
  });

  it('should write "Nộp hồ sơ" by the candidate when one comes from the site', async () => {
    // Arrange
    const form = multipart({
      jobId: job.id,
      fullName: 'Đỗ Thị Mẫu',
      phone: '0916 333 444',
      cvLink: 'https://drive.google.com/cv-mau',
      consent: 'true',
      formOpenedAt: String(t.clock.now.getTime() - 60_000),
    });

    // Act
    const res = await t.request('/api/applications', {
      method: 'POST',
      body: form,
      headers: { 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await linesOf()).toEqual([
      expect.objectContaining({ group: 'ho-so', action: 'Nộp hồ sơ', actor: 'Ứng viên', candidateName: 'Đỗ Thị Mẫu' }),
    ]);
  });

  it('should write "Đổi CV", old → new, when HR replaces the CV', async () => {
    // Arrange
    const app = await insertApplication({ cvLink: 'https://drive.google.com/cv-cu' });

    // Act
    const res = await sendForm('PUT', `/api/hr/applications/${app.id}/cv`, multipart({}, pdfFile('CV moi.pdf')));

    // Assert
    expect(res.status).toBe(200);
    expect(await linesOf('?nhom=ho-so')).toEqual([
      expect.objectContaining({
        action: 'Đổi CV',
        from: 'https://drive.google.com/cv-cu',
        to: 'CV moi.pdf',
        actor: 'Phòng Nhân sự',
      }),
    ]);
  });

  it('should write "Thêm CV" by the candidate when they add one to their application', async () => {
    // Arrange
    const app = await insertApplication({ email: 'mau-uv@mail.test', status: 'seen' });
    const signIn = await t.send('POST', '/api/candidate/google', { idToken: googleToken('mau-uv@mail.test') });

    // Act
    const res = await sendForm(
      'PUT',
      `/api/candidate/applications/${app.id}/cv`,
      multipart({}, pdfFile('CV uv.pdf')),
      cookiesFrom(signIn),
    );

    // Assert
    expect(res.status).toBe(200);
    expect(await linesOf('?nhom=ho-so')).toEqual([
      expect.objectContaining({ action: 'Thêm CV', from: null, to: 'CV uv.pdf', actor: 'Ứng viên' }),
    ]);
  });
});

describe('Nhật ký tuyển dụng: deleting an application', () => {
  it('should keep its lines without the name, and write the deletion', async () => {
    // Arrange
    const app = await insertApplication({ fullName: 'Vũ Văn Xoá', addedBy: 'Mai', phone: '0916000999' });
    await hr('PATCH', `/applications/${app.id}/contact`, { phone: '0916000998', email: '', source: 'website' });
    await hr('PATCH', `/applications/${app.id}`, { status: 'scheduling' });
    later(1);

    // Act
    const res = await hr('DELETE', `/applications/${app.id}`);

    // Assert
    expect(res.status).toBe(200);
    const lines = await linesOf();
    expect(lines[0]).toMatchObject({ group: 'ho-so', action: 'Xoá hồ sơ', actor: 'Phòng Nhân sự' });
    expect(lines.every((l) => l.isDeleted && l.applicationId === null && l.candidateName === null)).toBe(true);
    expect(lines.every((l) => l.jobTitle === 'Nhân viên bán hàng')).toBe(true);
    expect(JSON.stringify(lines)).not.toMatch(/Vũ Văn Xoá|0916000999|0916000998/);
    expect(lines.find((l) => l.group === 'trang-thai')).toMatchObject({ from: 'Đã xem', to: 'Chờ xếp lịch' });
  });

  it('should not be found by the deleted name any more', async () => {
    // Arrange
    const app = await insertApplication({ fullName: 'Vũ Văn Xoá' });
    await hr('PATCH', `/applications/${app.id}`, { status: 'scheduling' });

    // Act
    await hr('DELETE', `/applications/${app.id}`);

    // Assert
    expect(await linesOf(`?tim=${encodeURIComponent('Vũ Văn Xoá')}`)).toEqual([]);
  });

  it('should write the deletion by the candidate when they delete their account', async () => {
    // Arrange
    await insertApplication({ fullName: 'Ngô Thị Rời', email: 'roi@mail.test' });
    const signIn = await t.send('POST', '/api/candidate/google', { idToken: googleToken('roi@mail.test') });

    // Act
    const res = await t.send('DELETE', '/api/candidate/me', undefined, { cookie: cookiesFrom(signIn) });

    // Assert
    expect(res.status).toBe(200);
    expect(await linesOf()).toEqual([
      expect.objectContaining({ action: 'Xoá hồ sơ', actor: 'Ứng viên', candidateName: null, isDeleted: true }),
    ]);
  });
});

describe('Nhật ký tuyển dụng: Sếp duyệt', () => {
  async function sendBatch(ids: string[]) {
    const res = await hr('POST', '/reviews', {
      title: 'Đợt thử',
      senderName: 'Phòng Nhân sự',
      reviewerName: 'anh Mẫu',
      respondBy: '2026-10-22T10:00:00.000Z',
      items: ids.map((applicationId) => ({ applicationId, hrPick: 'maybe' })),
    });
    return json<ReviewBatchDto>(res);
  }

  it('should write each application sent, and the reviewer’s decision with their name', async () => {
    // Arrange
    const app = await insertApplication({ fullName: 'Lý Văn Duyệt' });
    const batch = await sendBatch([app.id]);
    later(1);

    // Act
    await boss('PUT', `/${batch.token}/items/${batch.items[0]?.id}`, {
      decision: 'reject',
      comment: 'Thiếu kinh nghiệm',
    });

    // Assert
    const lines = await linesOf('?nhom=sep-duyet');
    expect(lines).toEqual([
      expect.objectContaining({
        action: 'Sếp quyết định',
        actor: 'anh Mẫu',
        to: 'Không phỏng vấn',
        detail: 'Thiếu kinh nghiệm',
      }),
      expect.objectContaining({
        action: 'Gửi sếp duyệt',
        actor: 'Phòng Nhân sự',
        detail: 'Đợt "Đợt thử", gửi anh Mẫu',
      }),
    ]);
  });

  it('should write taking an application out of a batch, a reply to the reviewer, and inviting without approval', async () => {
    // Arrange
    const [asked, removed] = [await insertApplication(), await insertApplication()];
    const batch = await sendBatch([asked.id, removed.id]);
    const [askedItem, removedItem] = batch.items;
    await boss('PUT', `/${batch.token}/items/${askedItem?.id}`, { decision: 'ask', comment: 'Lương mong muốn?' });

    // Act
    await hr('POST', `/reviews/${batch.id}/items/${askedItem?.id}/reply`, { reply: '15 triệu' });
    await hr('DELETE', `/reviews/${batch.id}/items/${removedItem?.id}`);
    await hr('PATCH', `/applications/${asked.id}`, {
      status: 'interview',
      reviewBypassReason: 'Ứng viên chỉ rảnh hôm nay',
    });

    // Assert
    const actions = (await linesOf('?nhom=sep-duyet')).map((l: RecruitmentLogLineDto) => [l.action, l.detail]);
    expect(actions).toEqual(
      expect.arrayContaining([
        ['Trả lời sếp', '15 triệu'],
        ['Bỏ khỏi đợt duyệt', 'Đợt "Đợt thử"'],
        ['Vẫn hẹn khi sếp chưa duyệt', 'Ứng viên chỉ rảnh hôm nay'],
      ]),
    );
  });
});

describe('Nhật ký tuyển dụng: Chấm CV, lịch phỏng vấn and the reject reason', () => {
  it('should write a new CV score HR asked for, and nothing when the score did not change', async () => {
    // Arrange
    const app = await insertApplication({ cvLink: 'https://drive.google.com/cv' });

    // Act
    await hr('POST', `/applications/${app.id}/score`);
    later(1);
    await hr('POST', `/applications/${app.id}/score`);

    // Assert
    expect(await linesOf('?nhom=cham-cv')).toEqual([
      expect.objectContaining({ action: 'Chấm CV', from: 'Chưa chấm', to: 'Không chấm được', actor: 'Phòng Nhân sự' }),
    ]);
  });

  it('should write a change of interview mode and of the meeting link', async () => {
    // Arrange
    const app = await insertApplication({ status: 'interview', interviewMode: 'onsite' });

    // Act
    await hr('PATCH', `/applications/${app.id}`, {
      interviewMode: 'online',
      meetingUrl: 'https://meet.google.com/abc',
    });

    // Assert
    expect(await linesOf('?nhom=phong-van')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'Đổi hình thức phỏng vấn', from: 'Tại văn phòng', to: 'Online' }),
        expect.objectContaining({ action: 'Đổi link phỏng vấn', from: 'Trống', to: 'https://meet.google.com/abc' }),
      ]),
    );
  });

  it('should write a new reason for "Chưa phù hợp" when the status stays', async () => {
    // Arrange
    const app = await insertApplication({ status: 'rejected', rejectReason: 'salary' });

    // Act
    await hr('PATCH', `/applications/${app.id}`, { rejectReason: 'other', rejectNote: 'Đã nhận việc nơi khác' });

    // Assert
    expect(await linesOf('?nhom=trang-thai')).toEqual([
      expect.objectContaining({
        action: 'Sửa lý do chưa phù hợp',
        from: expect.stringContaining('Lương'),
        to: expect.stringContaining('Đã nhận việc nơi khác'),
      }),
    ]);
  });
});

describe('Nhật ký tuyển dụng: Nguồn', () => {
  it('should write adding, renaming, hiding, showing and deleting a source', async () => {
    // Arrange
    const created = await json<SourceDto>(await hr('POST', '/sources', { name: 'Hội chợ việc làm' }));

    // Act
    await hr('PATCH', `/sources/${created.key}`, { name: 'Ngày hội việc làm' });
    await hr('PATCH', `/sources/${created.key}`, { hidden: true });
    await hr('PATCH', `/sources/${created.key}`, { hidden: false });
    await hr('DELETE', `/sources/${created.key}`);

    // Assert
    const lines = await linesOf('?nhom=nguon');
    expect(lines.map((l) => [l.action, l.from, l.to])).toEqual(
      expect.arrayContaining([
        ['Thêm nguồn', null, 'Hội chợ việc làm'],
        ['Đổi tên nguồn', 'Hội chợ việc làm', 'Ngày hội việc làm'],
        ['Ẩn nguồn', null, 'Ngày hội việc làm'],
        ['Hiện nguồn', null, 'Ngày hội việc làm'],
        ['Xoá nguồn', 'Ngày hội việc làm', null],
      ]),
    );
    expect(lines).toHaveLength(5);
    expect(lines.every((l) => l.applicationId === null && !l.isDeleted && l.actor === 'Phòng Nhân sự')).toBe(true);
  });
});
