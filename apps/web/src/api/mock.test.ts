import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays as addDaysIso } from '@careers/shared';
import { mockApi, resetMockDb } from './mock';
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
  keepForOtherJobs: false,
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

describe('subscribe', () => {
  it('needs its own consent (BR-10)', async () => {
    const err = await rejection(
      run(mockApi.subscribe({ phone: '0912000111', department: 'Kinh doanh', consent: false })),
    );
    expect(err.status).toBe(422);
  });
});

describe('hr', () => {
  it('blocks HR endpoints without a session', async () => {
    const err = await rejection(run(mockApi.hrJobs()));
    expect(err.status).toBe(401);
  });

  it('lists jobs with an extension target only when allowed', async () => {
    await run(mockApi.hrGoogleSignIn());
    const { jobs } = await run(mockApi.hrJobs());
    const expiring = jobs.find((j) => j.id === 'j3')!;
    expect(expiring.status).toBe('expiring');
    expect(expiring.extendTo).toBeTruthy();
    expect(jobs.find((j) => j.id === 'j1')!.extendTo).toBeNull();
  });

  it('opening an application marks it seen', async () => {
    await run(mockApi.hrGoogleSignIn());
    const detail = await run(mockApi.hrApplication('a2'));
    expect(detail.status).toBe('seen');
  });

  it('will not publish a job with a deadline over 60 days (BR-01)', async () => {
    await run(mockApi.hrGoogleSignIn());
    const job = await run(mockApi.hrJob('j7'));
    const err = await rejection(
      run(
        mockApi.hrSaveJob('j7', {
          ...job,
          department: job.department as 'Vận hành',
          deadline: '2099-01-01',
          intent: 'publish',
        }),
      ),
    );
    expect(err.fieldErrors.deadline).toMatch(/60 ngày/);
  });
});

describe('editing live jobs', () => {
  it('keeps the public link when the title changes (BR-04)', async () => {
    await run(mockApi.hrGoogleSignIn());
    const job = await run(mockApi.hrJob('j1'));
    const saved = await run(
      mockApi.hrSaveJob('j1', { ...job, department: 'Kinh doanh', title: 'Chuyên viên Kinh doanh', intent: 'draft' }),
    );
    expect(saved.slug).toBe(job.slug);
  });

  it('cannot push the deadline past 60 days from publishing by editing (BR-18)', async () => {
    await run(mockApi.hrGoogleSignIn());
    const job = await run(mockApi.hrJob('j3')); // published 20 days ago
    const err = await rejection(
      run(
        mockApi.hrSaveJob('j3', {
          ...job,
          department: 'Nhân sự',
          deadline: addDaysIso(job.deadline, 45),
          intent: 'draft',
        }),
      ),
    );
    expect(err.fieldErrors.deadline).toBeTruthy();
  });
});

describe('candidate', () => {
  it('signs in with the demo OTP and sees own applications', async () => {
    await run(mockApi.verifyOtp('0912 345 128', '123456'));
    const overview = await run(mockApi.candidateOverview());
    expect(overview?.applications.length).toBeGreaterThan(0);
    expect(overview?.applications.every((a) => a.stage !== ('rejected' as never))).toBe(true);
  });

  it('deleting data removes applications (BR-14)', async () => {
    await run(mockApi.verifyOtp('0912345128', '123456'));
    await run(mockApi.deleteCandidateData());
    await run(mockApi.hrGoogleSignIn());
    const { applications } = await run(mockApi.hrApplications());
    expect(applications.some((a) => a.phone === '0912345128')).toBe(false);
  });
});
