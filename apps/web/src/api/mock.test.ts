import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays as addDaysIso } from '@careers/shared';
import { mockApi, resetMockDb } from './mock';
import { DEMO_CANDIDATE_EMAIL, DEMO_HR } from './mock-seed';
import { ApiError } from './types';

const base = {
  jobId: 'j1',
  fullName: 'Nguyễn Văn A',
  phone: '0912 000 111',
  email: '',
  message: '',
  cvLink: 'https://drive.google.com/cv',
  cvFile: null,
  consent: true,
  formOpenedAt: Date.now(),
} as const;

async function rejection(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected a rejection');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  resetMockDb(new Date());
});

const run = <T>(p: Promise<T>) => {
  vi.runAllTimersAsync();
  return p;
};

describe('apply', () => {
  it('requires the consent tick (BR-11)', async () => {
    const err = await rejection(run(mockApi.apply({ ...base, consent: false as unknown as true })));
    expect(err.status).toBe(422);
    expect(err.fieldErrors.consent).toMatch(/đồng ý/);
  });

  it('requires a CV file or link', async () => {
    const err = await rejection(run(mockApi.apply({ ...base, cvLink: '' })));
    expect(err.fieldErrors.cv).toBeTruthy();
  });

  it('rejects CVs over 4 MB', async () => {
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'cv.pdf', { type: 'application/pdf' });
    const err = await rejection(run(mockApi.apply({ ...base, cvLink: '', cvFile: big })));
    expect(err.fieldErrors.cv).toMatch(/4 MB/);
  });

  it('updates instead of duplicating within 30 days (BR-07)', async () => {
    const first = await run(mockApi.apply(base));
    expect(first.updatedExisting).toBe(false);
    const second = await run(mockApi.apply({ ...base, message: 'cập nhật' }));
    expect(second.updatedExisting).toBe(true);
    expect(second.previousDate).toBeTruthy();
  });

  it('refuses closed jobs with code job_closed', async () => {
    const err = await rejection(run(mockApi.apply({ ...base, jobId: 'j6' })));
    expect(err.status).toBe(409);
    expect(err.code).toBe('job_closed');
  });
});

describe('hr', () => {
  it('signs HR in only with the right password', async () => {
    const err = await rejection(run(mockApi.hrSignIn(DEMO_HR.email, 'sai')));
    expect(err.status).toBe(401);
    expect(await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password))).toMatchObject({ email: DEMO_HR.email });
  });

  it('blocks HR endpoints without a session', async () => {
    const err = await rejection(run(mockApi.hrJobs()));
    expect(err.status).toBe(401);
  });

  it('opening an application marks it seen', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const detail = await run(mockApi.hrApplication('a2'));
    expect(detail.status).toBe('seen');
  });

  it('will not publish a job with a deadline over 60 days (BR-01)', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const job = await run(mockApi.hrJob('j7'));
    const err = await rejection(
      run(
        mockApi.hrSaveJob('j7', {
          ...job,
          deadline: '2099-01-01',
          intent: 'publish',
        }),
      ),
    );
    expect(err.fieldErrors.deadline).toMatch(/60 ngày/);
  });

  it('deletes drafts but never a job that was published', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const { jobs } = await run(mockApi.hrJobs());
    const draft = jobs.find((j) => j.status === 'draft')!;
    const live = jobs.find((j) => j.status === 'open')!;

    await run(mockApi.hrDeleteJob(draft.id));
    const err = await rejection(run(mockApi.hrDeleteJob(live.id)));

    const after = (await run(mockApi.hrJobs())).jobs.map((j) => j.id);
    expect(after).not.toContain(draft.id);
    expect(after).toContain(live.id);
    expect(err.status).toBe(422);
  });

  it('has no CV download link in the demo', () => {
    expect(mockApi.hrCvUrl('a1')).toBeNull();
  });
});

describe('editing live jobs', () => {
  it('keeps the public link when the title changes (BR-04)', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const job = await run(mockApi.hrJob('j1'));
    const saved = await run(
      mockApi.hrSaveJob('j1', { ...job, department: 'Kinh doanh', title: 'Chuyên viên Kinh doanh', intent: 'draft' }),
    );
    expect(saved.slug).toBe(job.slug);
  });
});

describe('re-applying within 30 days (BR-07)', () => {
  it('keeps the HR status and moves the application to the top', async () => {
    const [job] = (await run(mockApi.listJobs())).jobs;
    const input = { ...base, jobId: job.id, phone: '0933111222' };
    await run(mockApi.apply(input));
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const first = (await run(mockApi.hrApplications())).applications.find((a) => a.phone === '0933111222')!;
    await run(mockApi.hrUpdateApplication(first.id, { status: 'interview' }));

    await run(mockApi.apply(input));

    const [top] = (await run(mockApi.hrApplications())).applications;
    expect(top).toMatchObject({ id: first.id, status: 'interview' });
  });
});

describe('closing and reopening jobs', () => {
  it('closes a live job and reopens it with a new deadline', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    await run(mockApi.hrJobAction('j1', 'close'));
    expect((await run(mockApi.hrJob('j1'))).status).toBe('closed');

    await run(mockApi.hrSetDeadline('j1', addDaysIso(new Date().toISOString().slice(0, 10), 20)));

    expect((await run(mockApi.hrJob('j1'))).status).toBe('open');
  });

  it('refuses a new deadline more than 60 days away', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const err = await rejection(run(mockApi.hrSetDeadline('j10', '2099-01-01')));
    expect(err.status).toBe(422);
  });
});

describe('deleting applications', () => {
  it('deletes only applications of jobs that ended more than 30 days ago', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const before = await run(mockApi.hrJobs());
    expect(before.dueForDeletion).toBeGreaterThan(0);

    const { deleted } = await run(mockApi.hrDeleteDueApplications());

    expect(deleted).toBe(before.dueForDeletion);
    expect((await run(mockApi.hrJobs())).dueForDeletion).toBe(0);
    expect((await run(mockApi.hrApplications())).applications.some((a) => a.id === 'a1')).toBe(true);
  });

  it('deletes one application', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    await run(mockApi.hrDeleteApplication('a2'));
    expect((await run(mockApi.hrApplications())).applications.some((a) => a.id === 'a2')).toBe(false);
  });
});

describe('HR accounts', () => {
  it('creates an account with a one-time password that can sign in', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const { password } = await run(mockApi.hrCreateUser({ email: 'Moi@Lee-HR.com', name: 'Người mới' }));
    await run(mockApi.hrLogout());

    expect(await run(mockApi.hrSignIn('moi@lee-hr.com', password))).toMatchObject({ email: 'moi@lee-hr.com' });
  });

  it('never deletes the account in use', async () => {
    const me = await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const err = await rejection(run(mockApi.hrDeleteUser(me.id)));
    expect(err.status).toBe(422);
  });
});

describe('search', () => {
  it('finds applications by name without tones or by part of the phone', async () => {
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const byName = await run(mockApi.hrApplications(undefined, 'tran minh anh'));
    const byPhone = await run(mockApi.hrApplications(undefined, '345 128'));
    expect(byName.applications.every((a) => a.fullName === 'Trần Minh Anh')).toBe(true);
    expect(byName.applications.length).toBeGreaterThan(0);
    expect(byPhone.applications.map((a) => a.id).sort()).toEqual(byName.applications.map((a) => a.id).sort());
  });
});

describe('lookup by phone', () => {
  it('lists job, date and stage for the number, without personal data', async () => {
    const { applications } = await run(mockApi.lookupApplications('0912 345 128'));
    expect(applications.length).toBeGreaterThan(0);
    expect(Object.keys(applications[0]).sort()).toEqual(['appliedOn', 'jobSlug', 'jobTitle', 'stage']);
  });

  it('rejects an invalid number', async () => {
    expect((await rejection(run(mockApi.lookupApplications('12')))).status).toBe(422);
  });
});

describe('candidate', () => {
  it('signs in with Google and sees the applications sent with that email', async () => {
    const me = await run(mockApi.googleSignIn());
    expect(me.email).toBe(DEMO_CANDIDATE_EMAIL);
    const overview = await run(mockApi.candidateOverview());
    expect(overview?.applications).toHaveLength(3);
    expect(overview?.applications.every((a) => a.stage !== ('rejected' as never))).toBe(true);
  });

  it('needs a phone before turning job alerts on (BR-10)', async () => {
    await run(mockApi.googleSignIn());
    await run(mockApi.updateCandidate({ phone: '', alertDepartments: [] }));
    const err = await rejection(run(mockApi.updateCandidate({ alertDepartments: ['Kỹ thuật'] })));
    expect(err.fieldErrors.alertDepartments).toBeTruthy();
    const me = await run(mockApi.updateCandidate({ phone: '0912 345 128', alertDepartments: ['Kỹ thuật'] }));
    expect(me.alertDepartments).toEqual(['Kỹ thuật']);
  });

  it('deleting data removes the applications sent with the email (BR-14)', async () => {
    await run(mockApi.googleSignIn());
    await run(mockApi.deleteCandidateData());
    await run(mockApi.hrSignIn(DEMO_HR.email, DEMO_HR.password));
    const { applications } = await run(mockApi.hrApplications());
    expect(applications.some((a) => a.fullName === 'Trần Minh Anh')).toBe(false);
    expect(await run(mockApi.candidateOverview())).toBeNull();
  });
});
