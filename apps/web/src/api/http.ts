import { ApiError, type Api } from './types';

/**
 * Client for the real BE. Contract (all JSON unless noted, cookies for sessions):
 *
 *   GET    /jobs                        → JobListResponse
 *   GET    /jobs/:slug                  → JobPageResponse
 *   POST   /applications   (multipart)  → ApplyResponse     409 { code: "job_closed" }
 *   POST   /subscribers                 → { ok }
 *   POST   /candidate/otp               { phone, channel } → { ok }
 *   POST   /candidate/otp/verify        { phone, code }    → CandidateMe
 *   POST   /candidate/google            { idToken }        → { email, needsPhone }
 *   GET    /candidate/me                → CandidateOverview | 401
 *   PATCH  /candidate/me   (multipart)  → CandidateMe
 *   GET    /candidate/saved             → string[]
 *   PUT    /candidate/saved/:slug       { saved } → string[]
 *   DELETE /candidate/me                → { ok }
 *   POST   /candidate/logout            → { ok }
 *   GET    /hr/me                       → HrMe | 401
 *   POST   /hr/auth/google              { idToken } → HrMe   403 = email not allowed
 *   POST   /hr/logout                   → { ok }
 *   GET    /hr/jobs                     → HrJobsResponse
 *   GET    /hr/jobs/:id                 → HrJobDto
 *   POST   /hr/jobs  |  PUT /hr/jobs/:id  JobInput → HrJobDto
 *   POST   /hr/jobs/:id/:action         (publish|extend|pause|resume|fill) → { ok }
 *   GET    /hr/applications?jobId=      → ApplicationsResponse
 *   GET    /hr/applications/:id         → ApplicationDetailDto (marks "seen")
 *   PATCH  /hr/applications/:id         { status?, note?, thanked? } → ApplicationDetailDto
 *   GET    /hr/subscribers              → SubscriberDto[]
 *   DELETE /hr/subscribers/:id          → { ok }
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}, allow401 = false): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      // CSRF guard: the BE rejects state-changing requests without it.
      'x-requested-with': 'careers-web',
      ...(isForm || !init.body ? {} : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
  if (allow401 && res.status === 401) return null as T;
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? 'Có lỗi xảy ra, thử lại sau.', body?.fieldErrors ?? {}, body?.code);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

/** Google Identity Services one-tap / popup, returns an ID token for the BE to verify. */
function googleIdToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return Promise.reject(new ApiError(500, 'Chưa cấu hình VITE_GOOGLE_CLIENT_ID.'));
  type Gis = {
    accounts: {
      id: {
        initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
        prompt(cb?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void;
      };
    };
  };
  const load = () =>
    new Promise<Gis>((resolve, reject) => {
      const w = window as unknown as { google?: Gis };
      if (w.google) return resolve(w.google);
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => resolve((window as unknown as { google: Gis }).google);
      s.onerror = () => reject(new ApiError(503, 'Không tải được Google, thử lại sau.'));
      document.head.appendChild(s);
    });
  return load().then(
    (g) =>
      new Promise<string>((resolve, reject) => {
        // FedCM may never call back on dismissal; give up after a minute.
        const timer = setTimeout(() => reject(new ApiError(408, 'Chưa đăng nhập được Google, thử lại.')), 60_000);
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => {
            clearTimeout(timer);
            resolve(r.credential);
          },
        });
        g.accounts.id.prompt((n) => {
          if (n.isNotDisplayed() || n.isSkippedMoment()) reject(new ApiError(400, 'Đã hủy đăng nhập Google.'));
        });
      }),
  );
}

export const httpApi: Api = {
  listJobs: () => request('/jobs'),
  getJob: (slug) => request(`/jobs/${encodeURIComponent(slug)}`),
  apply: (input) => {
    const form = new FormData();
    const { cvFile, ...fields } = input;
    for (const [k, v] of Object.entries(fields)) if (v !== null && v !== undefined) form.append(k, String(v));
    if (cvFile) form.append('cv', cvFile);
    return request('/applications', { method: 'POST', body: form });
  },
  subscribe: (input) => request('/subscribers', json('POST', input)),

  requestOtp: (phone, channel) => request('/candidate/otp', json('POST', { phone, channel })),
  verifyOtp: (phone, code) => request('/candidate/otp/verify', json('POST', { phone, code })),
  googleSignIn: async () => request('/candidate/google', json('POST', { idToken: await googleIdToken() })),
  candidateOverview: () => request('/candidate/me', {}, true),
  updateCandidate: (patch) => {
    const form = new FormData();
    if (patch.name !== undefined) form.append('name', patch.name);
    if (patch.keepForOtherJobs !== undefined) form.append('keepForOtherJobs', String(patch.keepForOtherJobs));
    if (patch.alertDepartments) form.append('alertDepartments', JSON.stringify(patch.alertDepartments));
    if (patch.cvFile) form.append('cv', patch.cvFile);
    return request('/candidate/me', { method: 'PATCH', body: form });
  },
  setSavedJob: (slug, saved) => request(`/candidate/saved/${encodeURIComponent(slug)}`, json('PUT', { saved })),
  savedJobSlugs: () => request('/candidate/saved'),
  deleteCandidateData: () => request('/candidate/me', { method: 'DELETE' }),
  candidateLogout: () => request('/candidate/logout', { method: 'POST' }),

  hrMe: () => request('/hr/me', {}, true),
  hrGoogleSignIn: async () => request('/hr/auth/google', json('POST', { idToken: await googleIdToken() })),
  hrLogout: () => request('/hr/logout', { method: 'POST' }),
  hrJobs: () => request('/hr/jobs'),
  hrJob: (id) => request(`/hr/jobs/${encodeURIComponent(id)}`),
  hrSaveJob: (id, input) =>
    id ? request(`/hr/jobs/${encodeURIComponent(id)}`, json('PUT', input)) : request('/hr/jobs', json('POST', input)),
  hrJobAction: (id, action) => request(`/hr/jobs/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
  hrApplications: (jobId) => request(`/hr/applications${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`),
  hrApplication: (id) => request(`/hr/applications/${encodeURIComponent(id)}`),
  hrUpdateApplication: (id, patch) => request(`/hr/applications/${encodeURIComponent(id)}`, json('PATCH', patch)),
  hrSubscribers: () => request('/hr/subscribers'),
  hrDeleteSubscriber: (id) => request(`/hr/subscribers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
