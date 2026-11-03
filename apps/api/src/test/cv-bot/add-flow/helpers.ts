import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ApplicationDetailDto, ApplicationsResponse } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { applications, type Job, type NewJob } from '../../../db/schema.js';
import { insertJob, json, loginHr } from '../../fixtures.js';
import { createTestContext, type TestContext } from '../../harness.js';

/** Fictional applicant used by every "Thêm hồ sơ" test here. */
export const PHONE = '0912345678';

const CV_PDFS = new URL('../../cv-pdfs/', import.meta.url);

/** A real PDF from the shared fixtures (fictional people). */
export const realPdf = (name: 'cv-simple-vi.pdf' | 'cv-two-column.pdf' | 'cv-scanned-image.pdf') =>
  new File([readFileSync(fileURLToPath(new URL(name, CV_PDFS)))], name, { type: 'application/pdf' });

export const form = (fields: Record<string, string>, file?: File) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  if (file) body.append('cv', file);
  return body;
};

export interface Flow {
  t: TestContext;
  cookie: string;
  job: Job;
  /** Every fetch the process tried while the test ran; the server must never reach out for a CV link. */
  network: () => string[];
}

/**
 * The real API on a real Postgres (PGlite): a fresh database state, a signed-in HR and an open job per test.
 * Global fetch is replaced so a link can never leave the machine, and any attempt is recorded.
 */
export function useFlow(jobOverrides: Partial<NewJob> = {}): Flow {
  const state: { t?: TestContext; cookie?: string; job?: Job; urls: string[] } = { urls: [] };
  beforeAll(async () => {
    state.t = await createTestContext();
  });
  beforeEach(async () => {
    const t = need(state.t, 'test context');
    await t.reset();
    state.cookie = await loginHr(t);
    state.job = await insertJob(t, { title: 'Nhân viên Kinh doanh', ...jobOverrides });
    state.urls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        state.urls.push(String(input));
        return new Response('unexpected network call', { status: 599 });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  return {
    get t() {
      return need(state.t, 'test context');
    },
    get cookie() {
      return need(state.cookie, 'HR cookie');
    },
    get job() {
      return need(state.job, 'job');
    },
    network: () => [...state.urls, ...need(state.t, 'test context').outbound.calls.map((c) => c.url)],
  };
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is not ready`);
  return value;
}

export const validFields = (flow: Flow, over: Record<string, string> = {}) => ({
  jobId: flow.job.id,
  fullName: 'Trần Minh Khoa',
  phone: PHONE,
  email: 'khoa.tran@example.com',
  source: 'zalo',
  consent: 'true',
  ...over,
});

const omit = (fields: Record<string, string>, keys: readonly string[]) =>
  Object.fromEntries(Object.entries(fields).filter(([key]) => !keys.includes(key)));

/** Sends "Thêm hồ sơ" the way the page does: multipart, the CSRF header, HR's cookie. */
export const postForm = (flow: Flow, fields: Record<string, string>, file?: File, path = '/api/hr/applications') =>
  flow.t.request(path, {
    method: 'POST',
    body: form(fields, file),
    headers: { cookie: flow.cookie, 'x-requested-with': 'careers-web' },
  });

export const add = (flow: Flow, over: Record<string, string> = {}, file?: File) =>
  postForm(flow, validFields(flow, over), file);

/** Like add, with the named fields left out (the page sends no field for an empty box). */
export const addWithout = (flow: Flow, missing: readonly string[], over: Record<string, string> = {}) =>
  postForm(flow, omit(validFields(flow, over), missing));

export async function addedId(res: Response): Promise<string> {
  if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${await res.text()}`);
  return (await json<{ id: string }>(res)).id;
}

export const replace = (flow: Flow, id: string, fields: Record<string, string>, file?: File) =>
  flow.t.request(`/api/hr/applications/${id}/cv`, {
    method: 'PUT',
    body: form(fields, file),
    headers: { cookie: flow.cookie, 'x-requested-with': 'careers-web' },
  });

export const hrSend = (flow: Flow, method: string, path: string, body?: unknown) =>
  flow.t.send(method, `/api/hr${path}`, body, { cookie: flow.cookie });

export const detail = async (flow: Flow, id: string) =>
  json<ApplicationDetailDto>(await hrSend(flow, 'GET', `/applications/${id}`));

export const list = async (flow: Flow, query = '') =>
  json<ApplicationsResponse>(await hrSend(flow, 'GET', `/applications${query}`));

export const score = async (flow: Flow, id: string) =>
  json<ApplicationDetailDto>(await hrSend(flow, 'POST', `/applications/${id}/score`));

export const row = async (flow: Flow, id: string) =>
  flow.t.db.query.applications.findFirst({ where: eq(applications.id, id) });

export const rows = (flow: Flow) => flow.t.db.select().from(applications);

export const errorsOf = async (res: Response) => (await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors;
