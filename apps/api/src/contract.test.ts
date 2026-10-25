/**
 * Contract test: the FE's real HTTP client (apps/web/src/api/http.ts) against this API.
 * Catches any drift between what the browser sends/expects and what the BE does.
 */
import type { CandidateOverview } from '@careers/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api, ApiError } from '../../web/src/api/types.js';
import { seedDemoData } from './db/seed.js';
import { upsertHrUser } from './services/hr-accounts.js';
import { pdfFile } from './test/fakes.js';
import { createTestContext, type TestContext } from './test/harness.js';

let t: TestContext;
let api: Api;
const jar = new Map<string, string>();

/** A browser-like fetch: same-origin, keeps cookies between calls. */
async function browserFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (jar.size > 0) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  const res = await t.request(String(input), { ...init, headers });
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
    if (value && !/max-age=0/i.test(line)) jar.set(name, value);
    else jar.delete(name);
  }
  return res;
}

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected the call to fail');
}

// Loaded at runtime so the API's type-check does not walk into the web app's Vite-specific modules.
const HTTP_CLIENT = '../../web/src/api/http.ts';

beforeAll(async () => {
  t = await createTestContext();
  vi.stubEnv('VITE_API_URL', '/api');
  vi.stubGlobal('fetch', browserFetch);
  ({ httpApi: api } = (await import(/* @vite-ignore */ HTTP_CLIENT)) as { httpApi: Api });
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await t.reset();
  jar.clear();
  await seedDemoData(t.db, t.clock.now);
});

async function signInHr() {
  await upsertHrUser(t.db, { email: 'hr@lee-hr.com', name: 'HR', password: 'Hop-Dong-Test-2026' });
  return api.hrSignIn('hr@lee-hr.com', 'Hop-Dong-Test-2026');
}

describe('public pages through the FE client', () => {
  it('reads the board and a job page', async () => {
    const board = await api.listJobs();
    expect(board.jobs.length).toBeGreaterThan(0);
    const page = await api.getJob(board.jobs[0].slug);
    expect(page.job.slug).toBe(board.jobs[0].slug);
  });

  it('applies with a PDF; the same form again right away is not a second application', async () => {
    const [job] = (await api.listJobs()).jobs;
    const input = {
      jobId: job.id,
      fullName: 'Nguyễn Văn An',
      phone: '0912 000 111',
      email: '',
      message: '',
      cvLink: '',
      cvFile: pdfFile('An.pdf'),
      consent: true as const,
      formOpenedAt: t.clock.now.getTime(),
    };
    expect(await api.apply(input)).toEqual({ ok: true, firstName: 'An', phone: '0912000111' });
    await api.apply(input);
    await signInHr();
    expect((await api.hrApplications(job.id, '0912000111')).applications).toHaveLength(1);
    await api.hrLogout();
  });

  it('surfaces field errors and the job_closed code as ApiError', async () => {
    const [job] = (await api.listJobs()).jobs;
    const base = {
      jobId: job.id,
      fullName: 'An',
      phone: '0912000111',
      cvLink: 'https://x.vn/cv',
      cvFile: null,
      keepForOtherJobs: false,
      formOpenedAt: t.clock.now.getTime(),
    };
    const noConsent = await failure(api.apply({ ...base, consent: false as unknown as true }));
    expect(noConsent.status).toBe(422);
    expect(noConsent.fieldErrors.consent).toBeTruthy();

    t.clock.now = new Date('2030-01-01T00:00:00Z');
    const closed = await failure(api.apply({ ...base, consent: true, formOpenedAt: t.clock.now.getTime() }));
    expect([closed.status, closed.code]).toEqual([409, 'job_closed']);
  });

  it('looks applications up by phone, without personal data', async () => {
    const { applications } = await api.lookupApplications('0912 345 128');
    expect(applications.length).toBe(3);
    expect(Object.keys(applications[0]).sort()).toEqual(['appliedOn', 'jobSlug', 'jobTitle', 'stage']);
    expect((await failure(api.lookupApplications('12'))).status).toBe(422);
  });
});

describe('candidate account through the FE client', () => {
  // Like local dev: the FE sends "dev:<email>" instead of a Google ID token, the BE accepts it.
  beforeEach(() => {
    vi.stubEnv('VITE_DEV_GOOGLE_EMAIL', 'minhanh@email.com');
    t.deps.verifyGoogleToken = async (token) =>
      token.startsWith('dev:') ? { email: token.slice(4), name: 'Minh Anh (Google)' } : null;
  });

  it('signs in with Google, edits the profile, signs out', async () => {
    expect(await api.candidateOverview()).toBeNull();
    const me = await api.googleSignIn();
    expect(me).toMatchObject({ email: 'minhanh@email.com', name: 'Trần Minh Anh' });

    const overview = (await api.candidateOverview()) as CandidateOverview;
    expect(overview.applications.length).toBe(3);

    const updated = await api.updateCandidate({
      name: 'Minh Anh',
      phone: '0912 345 128',
      alertDepartments: ['Kỹ thuật'],
      cvFile: pdfFile('MinhAnh.pdf'),
    });
    expect(updated).toMatchObject({
      name: 'Minh Anh',
      phone: '0912345128',
      alertDepartments: ['Kỹ thuật'],
      cvFileName: 'MinhAnh.pdf',
    });

    await api.candidateLogout();
    expect(await api.candidateOverview()).toBeNull();
  });

  it('files an application under the Google email when signed in', async () => {
    await api.googleSignIn();
    const [job] = (await api.listJobs()).jobs;
    await api.apply({
      jobId: job.id,
      fullName: 'Trần Minh Anh',
      phone: '0912345128',
      email: 'khac@yahoo.com',
      cvLink: 'https://drive.google.com/x',
      cvFile: null,
      consent: true,
      formOpenedAt: t.clock.now.getTime(),
    });
    const overview = (await api.candidateOverview()) as CandidateOverview;
    expect(overview.applications.some((a) => a.jobSlug === job.slug)).toBe(true);
  });

  it('applies with the CV saved in the account', async () => {
    await api.googleSignIn();
    await api.updateCandidate({ cvFile: pdfFile('CV-luu.pdf') });
    const [job] = (await api.listJobs()).jobs;
    const res = await api.apply({
      jobId: job.id,
      fullName: 'Trần Minh Anh',
      phone: '0912345128',
      cvFile: null,
      useSavedCv: true,
      consent: true,
      formOpenedAt: t.clock.now.getTime(),
    });
    expect(res.ok).toBe(true);
    const saved = (await api.candidateOverview()) as CandidateOverview;
    expect(saved.applications.some((a) => a.jobSlug === job.slug)).toBe(true);
  });

  it('deletes all own data (BR-14)', async () => {
    await api.googleSignIn();
    expect(await api.deleteCandidateData()).toEqual({ ok: true });
    expect(await api.candidateOverview()).toBeNull();
  });
});

describe('HR through the FE client', () => {
  it('is signed out until Google sign-in, then manages jobs and applications', async () => {
    expect(await api.hrMe()).toBeNull();
    expect((await failure(api.hrJobs())).status).toBe(401);
    const wrong = await failure(api.hrSignIn('hr@lee-hr.com', 'sai'));
    expect(wrong.status).toBe(401);
    expect(await signInHr()).toMatchObject({ email: 'hr@lee-hr.com', name: 'HR' });
    expect(await api.hrMe()).toMatchObject({ email: 'hr@lee-hr.com' });

    const { jobs } = await api.hrJobs();
    const draft = jobs.find((j) => j.status === 'draft');
    expect(draft).toBeDefined();
    const form = await api.hrJob(draft?.id ?? '');
    const saved = await api.hrSaveJob(form.id, {
      ...form,
      department: 'Vận hành',
      deadline: '2026-11-15',
      intent: 'draft',
    });
    expect(saved.deadline).toBe('2026-11-15');
    expect(await api.hrDeleteJob(saved.id)).toEqual({ ok: true });

    const open = jobs.find((j) => j.status === 'open');
    expect(await api.hrJobAction(open?.id ?? '', 'close')).toEqual({ ok: true });
    expect(await api.hrSetDeadline(open?.id ?? '', '2026-11-30')).toEqual({ ok: true });
    expect((await api.hrJob(open?.id ?? '')).status).toBe('open');

    const template = await api.hrJobTemplate();
    expect(template.template.roadmap).toHaveLength(5);
    const dashboard = await api.hrDashboard();
    expect(dashboard.perDay).toHaveLength(30);

    const apps = await api.hrApplications();
    const fresh = apps.applications.find((a) => a.status === 'new');
    const detail = await api.hrApplication(fresh?.id ?? '');
    expect(detail.status).toBe('seen');
    const patched = await api.hrUpdateApplication(detail.id, {
      status: 'interview',
      interviewAt: '2026-10-29T09:00:00+07:00',
      note: 'Hẹn thứ 5',
    });
    expect(patched).toMatchObject({ status: 'interview', note: 'Hẹn thứ 5', noteUpdatedBy: 'HR' });
    expect(patched.interviewAt).toBe('2026-10-29T02:00:00.000Z');
    expect((await api.hrApplications(undefined, patched.fullName)).applications.map((a) => a.id)).toContain(patched.id);
    expect(await api.hrDeleteApplication(patched.id)).toEqual({ ok: true });

    const created = await api.hrCreateUser({ email: 'moi@lee-hr.com', name: 'Người mới' });
    expect(created.password.length).toBeGreaterThan(12);
    expect((await api.hrUsers()).map((u) => u.email)).toContain('moi@lee-hr.com');
    expect(await api.hrDeleteUser(created.user.id)).toEqual({ ok: true });

    await api.hrLogout();
    expect(await api.hrMe()).toBeNull();
  });

  it('opens an uploaded CV through hrCvUrl', async () => {
    const [job] = (await api.listJobs()).jobs;
    await api.apply({
      jobId: job.id,
      fullName: 'Lê Bình',
      phone: '0933000111',
      cvFile: pdfFile('Binh.pdf'),
      consent: true,
      formOpenedAt: t.clock.now.getTime(),
    });
    await signInHr();
    const { applications } = await api.hrApplications(job.id);
    const app = applications.find((a) => a.fullName === 'Lê Bình');
    const url = api.hrCvUrl(app?.id ?? '');
    expect(url).toBe(`/api/hr/applications/${app?.id}/cv`);

    const res = await browserFetch(url ?? '');
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect((await res.text()).startsWith('%PDF-')).toBe(true);
  });
});
