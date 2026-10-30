import type { ApplicationDetailDto, ApplicationsResponse, HrJobsResponse, SubscriberDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, jobs, subscribers, type Job } from '../db/schema.js';
import { upsertHrUser } from '../services/hr-accounts.js';
import { pdfFile } from '../test/fakes.js';
import { HR_PASSWORD, insertJob, json, loginHr } from '../test/fixtures.js';
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
      phone: `09120000${String(n).padStart(2, '0')}`,
      consentAt: t.clock.now,
      policyVersion: '2026-10',
      createdAt: new Date(t.clock.now.getTime() - n * 60_000),
      ...overrides,
    })
    .returning();
  return row;
}

describe('GET /api/hr/applications', () => {
  it('lists newest first with counts per status and the jobs that have applications', async () => {
    const a = await insertJob(t, { title: 'A' });
    const b = await insertJob(t, { title: 'B' });
    await insertJob(t, { title: 'Không ai nộp' });
    const first = await insertApplication(a, { createdAt: new Date('2026-10-18T00:00:00Z') });
    const second = await insertApplication(b, { createdAt: new Date('2026-10-19T00:00:00Z'), status: 'interview' });

    const body = await json<ApplicationsResponse>(await hr('GET', '/applications'));

    expect(body.applications.map((x) => x.id)).toEqual([second.id, first.id]);
    expect(body.applications[0]).toEqual({
      id: second.id,
      jobId: b.id,
      jobTitle: 'B',
      fullName: second.fullName,
      phone: second.phone,
      status: 'interview',
      createdAt: '2026-10-19T00:00:00.000Z',
      hasCv: false,
      noteLine: null,
      interviewAt: null,
      review: null,
      source: 'website',
      cvUpdatedByCandidate: false,
      matchPercent: null,
    });
    expect(body.counts).toEqual({ all: 2, new: 1, seen: 0, interview: 1, rejected: 0 });
    expect(body.jobs).toEqual([
      { id: a.id, title: 'A' },
      { id: b.id, title: 'B' },
    ]);
  });

  it('filters by job', async () => {
    const a = await insertJob(t);
    const b = await insertJob(t);
    await insertApplication(a);
    await insertApplication(b);
    const body = await json<ApplicationsResponse>(await hr('GET', `/applications?jobId=${a.id}`));
    expect(body.applications.map((x) => x.jobId)).toEqual([a.id]);
    expect(body.counts.all).toBe(1);
    expect(body.jobs).toHaveLength(2);
  });

  it('shows whether there is a CV, the first line of the note and the interview time', async () => {
    const job = await insertJob(t);
    await insertApplication(job, {
      cvLink: 'https://drive.google.com/x',
      note: '\n  Gọi lại thứ 5  \nChi tiết thêm',
      status: 'interview',
      interviewAt: new Date('2026-10-22T02:00:00.000Z'),
    });

    const [row] = (await json<ApplicationsResponse>(await hr('GET', '/applications'))).applications;

    expect(row).toMatchObject({ hasCv: true, noteLine: 'Gọi lại thứ 5', interviewAt: '2026-10-22T02:00:00.000Z' });
  });

  it('finds applications by name or phone, without tones and in any order', async () => {
    const job = await insertJob(t);
    const huy = await insertApplication(job, { fullName: 'Phạm Quốc Huy', phone: '0797586611' });
    const hoa = await insertApplication(job, { fullName: 'Lê Thị Hoa', phone: '0912345678', status: 'seen' });
    const search = async (q: string) =>
      (await json<ApplicationsResponse>(await hr('GET', `/applications?q=${encodeURIComponent(q)}`))).applications.map(
        (a) => a.id,
      );

    expect(await search('huy 0797')).toEqual([huy.id]);
    expect(await search('QUOC pham')).toEqual([huy.id]);
    expect(await search('thi hoa')).toEqual([hoa.id]);
    expect(await search('LÊ hòa')).toEqual([hoa.id]);
    expect(await search('0912.345')).toEqual([hoa.id]);
    expect(await search('586 611')).toEqual([huy.id]);
    expect(await search('khong co ai')).toEqual([]);
    expect((await search('')).sort()).toEqual([huy.id, hoa.id].sort());
  });

  it('counts only the applications the search found', async () => {
    const job = await insertJob(t);
    await insertApplication(job, { fullName: 'Phạm Quốc Huy' });
    await insertApplication(job, { fullName: 'Lê Thị Hoa', status: 'seen' });

    const body = await json<ApplicationsResponse>(await hr('GET', '/applications?q=hoa'));

    expect(body.counts).toEqual({ all: 1, new: 0, seen: 1, interview: 0, rejected: 0 });
  });

  it('returns an empty list for a malformed job filter', async () => {
    const res = await hr('GET', '/applications?jobId=abc');
    expect(res.status).toBe(200);
    expect((await json<ApplicationsResponse>(res)).applications).toEqual([]);
  });

  it('needs an HR session', async () => {
    expect((await t.request('/api/hr/applications')).status).toBe(401);
    expect((await t.request('/api/hr/subscribers')).status).toBe(401);
  });
});

describe('GET /api/hr/applications/:id', () => {
  it('returns the full application and marks a new one as seen', async () => {
    const job = await insertJob(t, { title: 'Kỹ sư' });
    const app = await insertApplication(job, {
      email: 'an@gmail.com',
      cvLink: 'https://drive.google.com/x',
    });

    const body = await json<ApplicationDetailDto>(await hr('GET', `/applications/${app.id}`));

    expect(body).toMatchObject({
      status: 'seen',
      jobTitle: 'Kỹ sư',
      email: 'an@gmail.com',
      cvLink: 'https://drive.google.com/x',
      note: null,
      noteUpdatedAt: null,
      noteUpdatedBy: null,
      otherApplications: [],
    });
    const [row] = await t.db.select().from(applications);
    expect(row.status).toBe('seen');
  });

  it('lists other applications from the same phone, newest first', async () => {
    const kySu = await insertJob(t, { title: 'Kỹ sư' });
    const keToan = await insertJob(t, { title: 'Kế toán' });
    const banHang = await insertJob(t, { title: 'Bán hàng' });
    const app = await insertApplication(kySu, { phone: '0912999999' });
    const older = await insertApplication(keToan, {
      phone: '0912999999',
      status: 'rejected',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const newer = await insertApplication(banHang, {
      phone: '0912999999',
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    await insertApplication(banHang, { phone: '0912888888' });

    const body = await json<ApplicationDetailDto>(await hr('GET', `/applications/${app.id}`));

    expect(body.otherApplications).toEqual([
      { id: newer.id, jobTitle: 'Bán hàng', status: 'new', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: older.id, jobTitle: 'Kế toán', status: 'rejected', createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
  });

  it('leaves other statuses alone when opened', async () => {
    const app = await insertApplication(await insertJob(t), { status: 'interview' });
    expect((await json<ApplicationDetailDto>(await hr('GET', `/applications/${app.id}`))).status).toBe('interview');
  });

  it('answers 404 for unknown or malformed ids', async () => {
    expect((await hr('GET', '/applications/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await hr('GET', '/applications/x')).status).toBe(404);
  });
});

describe('PATCH /api/hr/applications/:id', () => {
  it('changes status and note, recording who changed the note and when', async () => {
    const app = await insertApplication(await insertJob(t));

    const body = await json<ApplicationDetailDto>(
      await hr('PATCH', `/applications/${app.id}`, { status: 'rejected', note: '  Thiếu kinh nghiệm  ' }),
    );

    expect(body).toMatchObject({
      status: 'rejected',
      note: 'Thiếu kinh nghiệm',
      noteLine: 'Thiếu kinh nghiệm',
      noteUpdatedAt: t.clock.now.toISOString(),
      noteUpdatedBy: 'Phòng Nhân sự',
    });
  });

  it('names the note author by email when the HR account has no name', async () => {
    await upsertHrUser(t.db, { email: 'ban@congty.vn', name: null, password: HR_PASSWORD });
    const other = await loginHr(t, 'ban@congty.vn');
    const app = await insertApplication(await insertJob(t));

    const res = await t.send('PATCH', `/api/hr/applications/${app.id}`, { note: 'Gọi lại' }, { cookie: other });

    expect((await json<ApplicationDetailDto>(res)).noteUpdatedBy).toBe('ban@congty.vn');
  });

  it('keeps the note author when the note did not change', async () => {
    const earlier = new Date('2026-10-01T00:00:00.000Z');
    const app = await insertApplication(await insertJob(t), {
      note: 'Gọi lại',
      noteUpdatedAt: earlier,
      noteUpdatedBy: 'Chị Lan',
    });

    const body = await json<ApplicationDetailDto>(
      await hr('PATCH', `/applications/${app.id}`, { status: 'seen', note: ' Gọi lại ' }),
    );

    expect(body).toMatchObject({ status: 'seen', noteUpdatedAt: earlier.toISOString(), noteUpdatedBy: 'Chị Lan' });
  });

  it('sets an interview with its time', async () => {
    const app = await insertApplication(await insertJob(t));

    const body = await json<ApplicationDetailDto>(
      await hr('PATCH', `/applications/${app.id}`, { status: 'interview', interviewAt: '2026-10-22T09:30:00+07:00' }),
    );

    expect(body).toMatchObject({ status: 'interview', interviewAt: '2026-10-22T02:30:00.000Z' });
  });

  it('clears the interview time when the application leaves "interview"', async () => {
    const app = await insertApplication(await insertJob(t), {
      status: 'interview',
      interviewAt: new Date('2026-10-22T02:30:00.000Z'),
    });

    const body = await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, { status: 'rejected' }));

    expect(body).toMatchObject({ status: 'rejected', interviewAt: null });
    expect((await t.db.select().from(applications))[0].interviewAt).toBeNull();
  });

  it('clears the interview time with null and refuses a time that is not ISO', async () => {
    const app = await insertApplication(await insertJob(t), {
      status: 'interview',
      interviewAt: new Date('2026-10-22T02:30:00.000Z'),
    });

    expect((await hr('PATCH', `/applications/${app.id}`, { interviewAt: 'thứ 5 9h' })).status).toBe(422);
    const body = await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, { interviewAt: null }));

    expect(body).toMatchObject({ status: 'interview', interviewAt: null });
  });

  it('clears the note with an empty string or null', async () => {
    const app = await insertApplication(await insertJob(t), { note: 'cũ' });
    expect(
      (await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, { note: '' }))).note,
    ).toBeNull();
  });

  it('rejects unknown and removed statuses', async () => {
    const app = await insertApplication(await insertJob(t));
    expect((await hr('PATCH', `/applications/${app.id}`, { status: 'hired' })).status).toBe(422);
    expect((await hr('PATCH', `/applications/${app.id}`, { status: 'passed' })).status).toBe(422);
  });

  it('leaves the application unchanged for an empty patch', async () => {
    const app = await insertApplication(await insertJob(t), { status: 'seen' });
    const body = await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, {}));
    expect(body.status).toBe('seen');
  });
});

describe('GET /api/hr/applications/:id/cv', () => {
  it('streams the stored PDF inline, never cached', async () => {
    const job = await insertJob(t);
    const pathname = await t.cvStore.put(job.id, new File(['%PDF-1.7 nội dung'], 'cv.pdf'));
    const app = await insertApplication(job, { fullName: 'Nguyễn An', cvPathname: pathname, cvFileName: 'cv.pdf' });

    const res = await t.request(`/api/hr/applications/${app.id}/cv`, { headers: { cookie } });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent('CV-Nguyễn An.pdf')}`,
    );
    expect(await res.text()).toBe('%PDF-1.7 nội dung');
  });

  it('answers 404 when the application has only a link', async () => {
    const app = await insertApplication(await insertJob(t), { cvLink: 'https://x.vn' });
    expect((await hr('GET', `/applications/${app.id}/cv`)).status).toBe(404);
  });

  it('answers 404 when the file is gone from the store', async () => {
    const app = await insertApplication(await insertJob(t), { cvPathname: 'cv/x/missing.pdf' });
    expect((await hr('GET', `/applications/${app.id}/cv`)).status).toBe(404);
  });

  it('is not readable without an HR session', async () => {
    const job = await insertJob(t);
    const pathname = await t.cvStore.put(job.id, new File(['%PDF-'], 'cv.pdf'));
    const app = await insertApplication(job, { cvPathname: pathname });
    expect((await t.request(`/api/hr/applications/${app.id}/cv`)).status).toBe(401);
  });
});

describe('DELETE /api/hr/applications/:id', () => {
  it('deletes the application and its CV file, leaving the others', async () => {
    const job = await insertJob(t);
    const pathname = await t.cvStore.put(job.id, pdfFile());
    const keptPath = await t.cvStore.put(job.id, pdfFile());
    const app = await insertApplication(job, { cvPathname: pathname });
    const kept = await insertApplication(job, { cvPathname: keptPath });

    const res = await hr('DELETE', `/applications/${app.id}`);

    expect(await res.json()).toEqual({ ok: true });
    expect((await t.db.select().from(applications)).map((a) => a.id)).toEqual([kept.id]);
    expect([...t.cvStore.files.keys()]).toEqual([keptPath]);
  });

  it('deletes an application that has only a link', async () => {
    const app = await insertApplication(await insertJob(t), { cvLink: 'https://drive.google.com/x' });
    expect((await hr('DELETE', `/applications/${app.id}`)).status).toBe(200);
    expect(await t.db.select().from(applications)).toEqual([]);
  });

  it('keeps the application when the file store fails, so HR can retry', async () => {
    const job = await insertJob(t);
    const app = await insertApplication(job, { cvPathname: await t.cvStore.put(job.id, pdfFile()) });
    t.deps.cvStore = {
      put: t.cvStore.put.bind(t.cvStore),
      get: t.cvStore.get.bind(t.cvStore),
      delete: async () => {
        throw new Error('blob down');
      },
    };
    try {
      expect((await hr('DELETE', `/applications/${app.id}`)).status).toBe(500);
    } finally {
      t.deps.cvStore = t.cvStore;
    }
    expect(await t.db.select().from(applications)).toHaveLength(1);
  });

  it('answers 404 for unknown or malformed ids', async () => {
    expect((await hr('DELETE', '/applications/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await hr('DELETE', '/applications/abc')).status).toBe(404);
  });
});

describe('DELETE /api/hr/applications/due', () => {
  /** One application with a CV file for the job; returns its pathname. */
  async function applicationWithCv(job: Job): Promise<string> {
    const pathname = await t.cvStore.put(job.id, pdfFile());
    await insertApplication(job, { cvPathname: pathname });
    return pathname;
  }

  it('deletes applications and files of jobs that ended more than 30 days ago, and nothing else', async () => {
    const closedLongAgo = await insertJob(t, { state: 'closed', closedOn: '2026-09-19', deadline: '2026-10-30' });
    const expiredLongAgo = await insertJob(t, { deadline: '2026-09-19', publishedOn: '2026-09-01' });
    const closedThirtyDays = await insertJob(t, { state: 'closed', closedOn: '2026-09-20', deadline: '2026-09-25' });
    const expiredRecently = await insertJob(t, { deadline: '2026-10-10', publishedOn: '2026-09-01' });
    const open = await insertJob(t);
    await applicationWithCv(closedLongAgo);
    await insertApplication(closedLongAgo, { cvLink: 'https://drive.google.com/x' });
    await applicationWithCv(expiredLongAgo);
    const kept = await Promise.all([closedThirtyDays, expiredRecently, open].map(applicationWithCv));

    const before = await json<HrJobsResponse>(await hr('GET', '/jobs'));
    const res = await hr('DELETE', '/applications/due');

    expect(before.dueForDeletion).toBe(3);
    expect(await res.json()).toEqual({ deleted: 3 });
    const left = await t.db.select().from(applications);
    expect(left.map((a) => a.jobId).sort()).toEqual([closedThirtyDays.id, expiredRecently.id, open.id].sort());
    expect([...t.cvStore.files.keys()].sort()).toEqual([...kept].sort());
    expect((await json<HrJobsResponse>(await hr('GET', '/jobs'))).dueForDeletion).toBe(0);
    expect(await t.db.select().from(jobs)).toHaveLength(5);
  });

  it('counts a closed job from the day it closed, not from its deadline', async () => {
    const job = await insertJob(t, { state: 'closed', closedOn: '2026-10-01', deadline: '2026-09-01' });
    await applicationWithCv(job);

    expect(await (await hr('DELETE', '/applications/due')).json()).toEqual({ deleted: 0 });
    expect(await t.db.select().from(applications)).toHaveLength(1);
  });

  it('answers zero when nothing is due', async () => {
    await insertApplication(await insertJob(t));
    expect(await (await hr('DELETE', '/applications/due')).json()).toEqual({ deleted: 0 });
    expect(await t.db.select().from(applications)).toHaveLength(1);
  });
});

describe('subscribers', () => {
  it('lists sign-ups newest first with the job they came from', async () => {
    const job = await insertJob(t, { title: 'Kế toán' });
    const base = { consentAt: t.clock.now, policyVersion: 'v' };
    await t.db.insert(subscribers).values([
      { ...base, phone: '0912000001', department: 'Kỹ thuật', createdAt: new Date('2026-10-01T00:00:00Z') },
      {
        ...base,
        phone: '0912000002',
        department: 'Kỹ thuật',
        fromJobId: job.id,
        createdAt: new Date('2026-10-02T00:00:00Z'),
      },
    ]);

    const body = await json<SubscriberDto[]>(await hr('GET', '/subscribers'));

    expect(body.map((s) => [s.phone, s.fromJobTitle])).toEqual([
      ['0912000002', 'Kế toán'],
      ['0912000001', null],
    ]);
    expect(body[0].createdAt).toBe('2026-10-02T00:00:00.000Z');
  });

  it('deletes one sign-up', async () => {
    const [row] = await t.db
      .insert(subscribers)
      .values({ phone: '0912000001', department: 'Kỹ thuật', consentAt: t.clock.now, policyVersion: 'v' })
      .returning();
    expect(await (await hr('DELETE', `/subscribers/${row.id}`)).json()).toEqual({ ok: true });
    expect(await t.db.select().from(subscribers)).toEqual([]);
    expect((await hr('DELETE', `/subscribers/${row.id}`)).status).toBe(200);
  });
});
