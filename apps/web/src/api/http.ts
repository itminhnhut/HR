import { ApiError, type Api } from './types';

/**
 * Client for the real BE. Contract (all JSON unless noted, cookies for sessions):
 *
 *   GET    /jobs                        → JobListResponse
 *   GET    /jobs/:slug                  → JobPageResponse
 *   POST   /applications   (multipart)  → ApplyResponse     409 { code: "job_closed" }
 *   POST   /applications/lookup         { phone } → LookupResponse   (no sign-in; 429 when rate-limited)
 *   POST   /candidate/google            { idToken }        → CandidateMe   (only candidate sign-in)
 *   GET    /candidate/me                → CandidateOverview | 401
 *   PATCH  /candidate/me   (multipart)  → CandidateMe
 *   DELETE /candidate/me                → { ok }
 *   POST   /candidate/logout            → { ok }
 *   GET    /hr/me                       → HrMe | 401
 *   POST   /hr/auth/login               { email, password } → HrMe   401 wrong, 429 locked 15 min
 *   POST   /hr/logout                   → { ok }
 *   GET    /hr/dashboard                → DashboardDto
 *   GET    /hr/jobs                     → HrJobsResponse
 *   GET    /hr/jobs/template  |  PUT    JobTemplate → JobTemplateResponse
 *   GET    /hr/jobs/:id                 → HrJobDto
 *   POST   /hr/jobs  |  PUT /hr/jobs/:id  JobInput → HrJobDto
 *   POST   /hr/jobs/:id/(publish|close) → { ok }
 *   POST   /hr/jobs/:id/deadline        { deadline } → { ok }   reopens an ended job
 *   DELETE /hr/jobs/:id                 → { ok }   drafts only, else 422
 *   GET    /hr/applications?jobId=&q=   → ApplicationsResponse
 *   GET    /hr/applications/:id         → ApplicationDetailDto (marks "seen")
 *   PATCH  /hr/applications/:id         { status?, note?, interviewAt? } → ApplicationDetailDto
 *   POST   /hr/applications/:id/score   → ApplicationDetailDto (cvScore filled)
 *   DELETE /hr/applications/:id         → { ok }   CV file included
 *   DELETE /hr/applications/due         → { deleted }   jobs ended more than 30 days ago
 *   GET    /hr/applications/:id/cv      → the uploaded PDF (inline)
 *   GET    /hr/users  |  POST { email, name } → TempPasswordResponse
 *   POST   /hr/users/:id/reset-password → TempPasswordResponse
 *   DELETE /hr/users/:id                → { ok }
 *   POST   /hr/me/password              { current, next } → HrMe
 *   PATCH  /hr/me                       { name, phone, contactEmail } → HrMe
 *   GET    /hr/message-templates        → MessageTemplatesResponse
 *   PUT    /hr/message-templates/:key   { subject, body } → MessageTemplatesResponse   DELETE resets
 *   POST   /hr/applications/:id/contacts { templateKey, channel } → ApplicationDetailDto
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
  // Local dev without an OAuth client: the local BE accepts "dev:<email>". Stripped from production builds.
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_GOOGLE_EMAIL) {
    return Promise.resolve(`dev:${import.meta.env.VITE_DEV_GOOGLE_EMAIL}`);
  }
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
  lookupApplications: (phone, captchaToken) =>
    request('/applications/lookup', json('POST', { phone, ...(captchaToken ? { captchaToken } : {}) })),

  googleSignIn: async () => request('/candidate/google', json('POST', { idToken: await googleIdToken() })),
  candidateOverview: () => request('/candidate/me', {}, true),
  updateCandidate: (patch) => {
    const form = new FormData();
    if (patch.name !== undefined) form.append('name', patch.name);
    if (patch.phone !== undefined) form.append('phone', patch.phone);
    if (patch.alertDepartments) form.append('alertDepartments', JSON.stringify(patch.alertDepartments));
    if (patch.cvFile) form.append('cv', patch.cvFile);
    return request('/candidate/me', { method: 'PATCH', body: form });
  },
  deleteCandidateData: () => request('/candidate/me', { method: 'DELETE' }),
  candidateLogout: () => request('/candidate/logout', { method: 'POST' }),

  hrMe: () => request('/hr/me', {}, true),
  hrSignIn: (email, password) => request('/hr/auth/login', json('POST', { email, password })),
  hrLogout: () => request('/hr/logout', { method: 'POST' }),
  hrJobs: () => request('/hr/jobs'),
  hrDashboard: () => request('/hr/dashboard'),
  hrJobTemplate: () => request('/hr/jobs/template'),
  hrSaveJobTemplate: (template) => request('/hr/jobs/template', json('PUT', template)),
  hrAddTemplateChoice: (list, value) => request('/hr/jobs/template/choices', json('POST', { list, value })),
  hrJob: (id) => request(`/hr/jobs/${encodeURIComponent(id)}`),
  hrSaveJob: (id, input) =>
    id ? request(`/hr/jobs/${encodeURIComponent(id)}`, json('PUT', input)) : request('/hr/jobs', json('POST', input)),
  hrJobAction: (id, action) => request(`/hr/jobs/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
  hrSetDeadline: (id, deadline) => request(`/hr/jobs/${encodeURIComponent(id)}/deadline`, json('POST', { deadline })),
  hrDeleteJob: (id) => request(`/hr/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrApplications: (jobId, q) => {
    const params = new URLSearchParams();
    if (jobId) params.set('jobId', jobId);
    if (q?.trim()) params.set('q', q.trim());
    const query = params.toString();
    return request(`/hr/applications${query ? `?${query}` : ''}`);
  },
  hrApplication: (id) => request(`/hr/applications/${encodeURIComponent(id)}`),
  hrUpdateApplication: (id, patch) => request(`/hr/applications/${encodeURIComponent(id)}`, json('PATCH', patch)),
  hrScorePending: () => request('/hr/applications/score-pending', { method: 'POST' }),
  hrScoreCv: (id) => request(`/hr/applications/${encodeURIComponent(id)}/score`, { method: 'POST' }),
  hrDeleteApplication: (id) => request(`/hr/applications/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrDeleteDueApplications: () => request('/hr/applications/due', { method: 'DELETE' }),
  hrCvUrl: (id) => `${BASE}/hr/applications/${encodeURIComponent(id)}/cv`,
  hrUsers: () => request('/hr/users'),
  hrCreateUser: (input) => request('/hr/users', json('POST', input)),
  hrResetPassword: (id) => request(`/hr/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
  hrDeleteUser: (id) => request(`/hr/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrChangePassword: (current, next) => request('/hr/me/password', json('POST', { current, next })),
  hrUpdateProfile: (patch) => request('/hr/me', json('PATCH', patch)),
  hrMessageTemplates: () => request('/hr/message-templates'),
  hrSaveMessageTemplate: (key, input) => request(`/hr/message-templates/${key}`, json('PUT', input)),
  hrResetMessageTemplate: (key) => request(`/hr/message-templates/${key}`, { method: 'DELETE' }),
  hrLogContact: (id, input) => request(`/hr/applications/${encodeURIComponent(id)}/contacts`, json('POST', input)),
};
