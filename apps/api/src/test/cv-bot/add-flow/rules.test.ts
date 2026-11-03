import type { CandidateOverview, DashboardDto, HrJobsResponse, LookupResponse, SourceDto } from '@careers/shared';
import { addDays, POLICY_VERSION, todayInVietnam } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { applications, applicationSources, subscribers } from '../../../db/schema.js';
import { googleToken, pdfFile } from '../../fakes.js';
import { cookiesFrom, insertJob, json, loginHr } from '../../fixtures.js';
import {
  add,
  addedId,
  addWithout,
  detail,
  errorsOf,
  hrSend,
  list,
  PHONE,
  row,
  rows,
  useFlow,
  type Flow,
} from './helpers.js';

const flow = useFlow();

const today = (f: Flow) => todayInVietnam(f.t.clock.now);
const dueCount = async (f: Flow) => (await json<HrJobsResponse>(await hrSend(f, 'GET', '/jobs'))).dueForDeletion;

/** Moves the clock past the HR session's life and signs in again, as HR would a month later. */
async function daysLater(f: Flow, days: number): Promise<string> {
  f.t.clock.now = new Date(f.t.clock.now.getTime() + days * 24 * 60 * 60_000);
  return loginHr(f.t);
}

describe('The mandatory consent', () => {
  it.each(['false', 'on', '1', 'TRUE', 'yes', ''])('should refuse the value "%s"', async (consent) => {
    // Act
    const res = await add(flow, { consent });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).consent).toBe('Xác nhận ứng viên đã đồng ý trước khi lưu.');
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse a form without the tick', async () => {
    // Act
    const res = await addWithout(flow, ['consent']);

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it('should store who confirmed it, when, and under which policy', async () => {
    // Act
    const id = await addedId(await add(flow));

    // Assert
    expect(await row(flow, id)).toMatchObject({
      consentBy: 'Phòng Nhân sự',
      addedBy: 'Phòng Nhân sự',
      consentAt: flow.t.clock.now,
      policyVersion: POLICY_VERSION,
    });
  });
});

describe('The source', () => {
  it.each(['email', 'zalo', 'topcv', 'vietnamworks', 'facebook', 'other'])('should accept %s', async (source) => {
    // Act
    const id = await addedId(await add(flow, { source }));

    // Assert
    expect((await detail(flow, id)).source).toBe(source);
  });

  it('should refuse "website": HR did not receive it through the form', async () => {
    // Act
    const res = await add(flow, { source: 'website' });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).source).toBeTruthy();
  });

  it('should refuse a source that does not exist', async () => {
    // Act
    const res = await add(flow, { source: 'khong-co' });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).source).toBeTruthy();
  });

  it('should refuse a hidden source', async () => {
    // Arrange
    await flow.t.db.update(applicationSources).set({ hidden: true }).where(eq(applicationSources.key, 'topcv'));

    // Act
    const res = await add(flow, { source: 'topcv' });

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it('should accept a source HR just created', async () => {
    // Arrange
    const created = await hrSend(flow, 'POST', '/sources', { name: 'Hội chợ việc làm' });
    const { key } = await json<SourceDto>(created);

    // Act
    const id = await addedId(await add(flow, { source: key }));

    // Assert
    expect((await detail(flow, id)).source).toBe(key);
  });

  it('should filter the list by the source', async () => {
    // Arrange
    await addedId(await add(flow, { source: 'zalo' }));
    await addedId(await add(flow, { source: 'email', phone: '0987654321' }));

    // Act
    const found = await list(flow, '?source=email');

    // Assert
    expect(found.applications.map((a) => a.source)).toEqual(['email']);
  });
});

describe('The job', () => {
  it('should accept a closed job', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: today(flow) });

    // Act
    const res = await add(flow, { jobId: closed.id });

    // Assert
    expect(res.status).toBe(201);
  });

  it('should accept a job past its deadline', async () => {
    // Arrange
    const expired = await insertJob(flow.t, { deadline: addDays(today(flow), -2) });

    // Act
    const res = await add(flow, { jobId: expired.id });

    // Assert
    expect(res.status).toBe(201);
  });

  it('should refuse a draft and say so on the job box', async () => {
    // Arrange
    const draft = await insertJob(flow.t, { state: 'draft' });

    // Act
    const res = await add(flow, { jobId: draft.id });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).jobId).toBe('Tin còn là nháp.');
  });

  it('should answer not found for a job deleted while the form was open', async () => {
    // Arrange
    const draft = await insertJob(flow.t, { state: 'draft' });
    expect((await hrSend(flow, 'DELETE', `/jobs/${draft.id}`)).status).toBe(200);

    // Act
    const res = await add(flow, { jobId: draft.id }, pdfFile());

    // Assert
    expect(res.status).toBe(404);
    expect(await rows(flow)).toEqual([]);
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it('should refuse something that is not a job id', async () => {
    // Act
    const res = await add(flow, { jobId: 'not-a-uuid' });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).jobId).toBe('Chọn vị trí ứng tuyển.');
  });
});

describe('The note', () => {
  it('should be trimmed and credited to the HR who wrote it', async () => {
    // Act
    const id = await addedId(await add(flow, { note: '  Gửi qua Zalo tối qua  ' }));

    // Assert
    expect(await detail(flow, id)).toMatchObject({
      note: 'Gửi qua Zalo tối qua',
      noteUpdatedBy: 'Phòng Nhân sự',
      noteUpdatedAt: flow.t.clock.now.toISOString(),
    });
  });

  it('should credit nobody when it is only spaces', async () => {
    // Act
    const id = await addedId(await add(flow, { note: '    ' }));

    // Assert
    expect(await detail(flow, id)).toMatchObject({ note: null, noteUpdatedBy: null, noteUpdatedAt: null });
  });

  it('should take 2000 characters and refuse one more', async () => {
    // Act
    const longest = await add(flow, { note: 'a'.repeat(2000) });
    const tooLong = await add(flow, { note: 'a'.repeat(2001), phone: '0987654321' });

    // Assert
    expect(longest.status).toBe(201);
    expect(tooLong.status).toBe(422);
    expect((await errorsOf(tooLong)).note).toBe('Ghi chú tối đa 2000 ký tự.');
  });

  it('should show its first line in the list', async () => {
    // Arrange
    await addedId(await add(flow, { note: '\n  Dòng đầu\nDòng sau' }));

    // Act
    const { applications } = await list(flow);

    // Assert
    expect(applications[0].noteLine).toBe('Dòng đầu');
  });

  it('should stay private: neither the phone lookup nor the candidate account shows it', async () => {
    // Arrange
    await addedId(await add(flow, { note: 'GHI-CHU-NOI-BO' }));
    const signedIn = await flow.t.send('POST', '/api/candidate/google', {
      idToken: googleToken('khoa.tran@example.com'),
    });

    // Act
    const lookup = await flow.t.send('POST', '/api/applications/lookup', { phone: PHONE });
    const account = await flow.t.send('GET', '/api/candidate/me', undefined, { cookie: cookiesFrom(signedIn) });

    // Assert
    expect(await lookup.text()).not.toContain('GHI-CHU-NOI-BO');
    expect(await account.text()).not.toContain('GHI-CHU-NOI-BO');
  });
});

describe('What a new profile starts as', () => {
  it('should be "seen", with nothing sent and no sign-up for job alerts', async () => {
    // Act
    const id = await addedId(await add(flow, { cvLink: 'https://example.com/cv.pdf' }));

    // Assert
    expect((await detail(flow, id)).status).toBe('seen');
    expect(flow.network()).toEqual([]);
    expect(await flow.t.db.select().from(subscribers)).toEqual([]);
  });

  it('should show up in the phone lookup', async () => {
    // Arrange
    await addedId(await add(flow));

    // Act
    const res = await flow.t.send('POST', '/api/applications/lookup', { phone: PHONE });

    // Assert
    expect((await json<LookupResponse>(res)).applications).toHaveLength(1);
  });

  it('should show up in the account of the same email, whatever case HR typed', async () => {
    // Arrange
    await addedId(await add(flow, { email: 'KHOA.TRAN@EXAMPLE.COM', cvLink: 'https://example.com/cv.pdf' }));
    const signedIn = await flow.t.send('POST', '/api/candidate/google', {
      idToken: googleToken('khoa.tran@example.com'),
    });

    // Act
    const res = await flow.t.send('GET', '/api/candidate/me', undefined, { cookie: cookiesFrom(signedIn) });

    // Assert
    const { applications } = await json<CandidateOverview>(res);
    expect(applications).toHaveLength(1);
    expect(applications[0].hasCv).toBe(true);
  });
});

describe('The 30-day deletion date', () => {
  it('should not touch a profile while its job is open', async () => {
    // Arrange
    await addedId(await add(flow));

    // Act
    const res = await hrSend(flow, 'DELETE', '/applications/due');

    // Assert
    expect(await json(res)).toEqual({ deleted: 0 });
    expect(await rows(flow)).toHaveLength(1);
  });

  it('should keep a profile until 30 full days after the job closed', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: addDays(today(flow), -30) });
    await addedId(await add(flow, { jobId: closed.id }));

    // Act
    const due = await dueCount(flow);

    // Assert
    expect(due).toBe(0);
  });

  it('should count the profile as due on the 31st day and delete its file with it', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: today(flow) });
    await addedId(await add(flow, { jobId: closed.id }, pdfFile()));
    const cookie = await daysLater(flow, 31);

    // Act
    const jobsRes = await flow.t.send('GET', '/api/hr/jobs', undefined, { cookie });
    const res = await flow.t.send('DELETE', '/api/hr/applications/due', undefined, { cookie });

    // Assert
    expect((await json<HrJobsResponse>(jobsRes)).dueForDeletion).toBe(1);
    expect(await json(res)).toEqual({ deleted: 1 });
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it('should count a profile with only a link the same way', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: today(flow) });
    await addedId(await add(flow, { jobId: closed.id, cvLink: 'https://example.com/cv.pdf' }));
    const cookie = await daysLater(flow, 31);

    // Act
    const res = await flow.t.send('DELETE', '/api/hr/applications/due', undefined, { cookie });

    // Assert
    expect(await json(res)).toEqual({ deleted: 1 });
    expect(await rows(flow)).toEqual([]);
  });

  it('should not show a profile added today as due on the jobs page or the dashboard', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: addDays(today(flow), -60) });
    await addedId(await add(flow, { jobId: closed.id }));

    // Act
    const board = await json<DashboardDto>(await hrSend(flow, 'GET', '/dashboard'));

    // Assert
    expect(await dueCount(flow)).toBe(0);
    expect(board.dueForDeletion).toBe(0);
  });

  it('should count 30 full days from the day HR added it to a job that closed long ago', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: addDays(today(flow), -60) });
    await addedId(await add(flow, { jobId: closed.id }, pdfFile()));

    // Act
    const cookie30 = await daysLater(flow, 30);
    const at30 = await json<DashboardDto>(
      await flow.t.send('GET', '/api/hr/dashboard', undefined, { cookie: cookie30 }),
    );
    const cookie31 = await daysLater(flow, 1);
    const at31 = await json<DashboardDto>(
      await flow.t.send('GET', '/api/hr/dashboard', undefined, { cookie: cookie31 }),
    );
    const res = await flow.t.send('DELETE', '/api/hr/applications/due', undefined, { cookie: cookie31 });

    // Assert
    expect(at30.dueForDeletion).toBe(0);
    expect(at31.dueForDeletion).toBe(1);
    expect(await json(res)).toEqual({ deleted: 1 });
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it('should delete only the older profile of a job when another was added today', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: addDays(today(flow), -60) });
    const longAgo = new Date(flow.t.clock.now.getTime() - 90 * 24 * 60 * 60_000);
    const oldId = await addedId(await add(flow, { jobId: closed.id, phone: '0987654321' }, pdfFile('Cu.pdf')));
    await flow.t.db.update(applications).set({ consentAt: longAgo }).where(eq(applications.id, oldId));
    const keptId = await addedId(await add(flow, { jobId: closed.id }, pdfFile('Moi.pdf')));

    // Act
    const due = await dueCount(flow);
    const res = await hrSend(flow, 'DELETE', '/applications/due');

    // Assert
    expect(due).toBe(1);
    expect(await json(res)).toEqual({ deleted: 1 });
    expect((await rows(flow)).map((r) => r.id)).toEqual([keptId]);
    expect(flow.t.cvStore.files.size).toBe(1);
  });

  it('should not delete a profile HR added today to a job that closed long ago', async () => {
    // Arrange
    const closed = await insertJob(flow.t, { state: 'closed', closedOn: addDays(today(flow), -60) });
    await addedId(await add(flow, { jobId: closed.id }));

    // Act
    const res = await hrSend(flow, 'DELETE', '/applications/due');

    // Assert
    expect(await json(res)).toEqual({ deleted: 0 });
    expect(await rows(flow)).toHaveLength(1);
  });
});
