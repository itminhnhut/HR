import type { CandidateOverview, SignedOutResponse } from '@careers/shared';
import { ApiError, type Api, type CvInput } from './types';

/**
 * Client for the real BE. Contract (all JSON unless noted, cookies for sessions):
 *
 *   GET    /jobs                        → JobListResponse
 *   GET    /jobs/:slug                  → JobPageResponse
 *   POST   /applications   (multipart)  → ApplyResponse     409 { code: "job_closed" }
 *   POST   /applications/lookup         { phone } → LookupResponse   (no sign-in; 429 when rate-limited)
 *   POST   /candidate/google            { idToken }        → CandidateMe   (only candidate sign-in)
 *   GET    /candidate/me                → CandidateOverview | { signedIn: false }
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
 *   GET    /hr/applications/:id/cv      → the uploaded PDF (inline)
 *   GET    /hr/users  |  POST { email, name } → TempPasswordResponse
 *   POST   /hr/users/:id/reset-password → TempPasswordResponse
 *   DELETE /hr/users/:id                → { ok }
 *   POST   /hr/me/password              { current, next } → HrMe
 *   PATCH  /hr/me                       { name, phone, contactEmail, jobTitle, alias } → HrMe
 *   GET    /hr/message-templates        → MessageTemplatesResponse
 *   PUT    /hr/message-templates/:key   { subject, body, note, calloutTitle, callout, closing } → MessageTemplatesResponse
 *                                       DELETE resets
 *   POST   /hr/applications/:id/contacts { templateKey, channel } → ApplicationDetailDto
 *   GET    /news?page=&category=<slug>&tag=<slug> → NewsListResponse   404 unknown category/tag
 *   GET    /news/:slug                  → NewsPostDto   404 for drafts
 *   GET    /hr/news                     → HrNewsListResponse
 *   POST   /hr/news  |  PUT /hr/news/:id  NewsPostInput → HrNewsPostDto   422 { fieldErrors }
 *   GET    /hr/news/:id                 → HrNewsPostDto
 *   POST   /hr/news/:id/(publish|unpublish) → HrNewsPostDto   publish: 422 { fieldErrors }; unpublish → hidden
 *   GET    /hr/news/tags?q=             → { tags: { name, slug, postCount }[] }
 *   DELETE /hr/news/:id                 → { ok }
 *   POST   /hr/news/categories  { name } → NewsCategoryDto  |  PATCH /hr/news/categories/:id { name }
 *   DELETE /hr/news/categories/:id      → { ok }   409 while it has posts
 *   POST   /hr/news/images  (multipart "file")  → { url, width, height }
 *   GET    /hr/reviews                  → ReviewBatchRowDto[]
 *   POST   /hr/reviews                  ReviewCreateInput → ReviewBatchDto   409 { code: "in_review" }
 *   GET    /hr/reviews/:id              → ReviewBatchDto
 *   POST   /hr/reviews/:id/(extend|revoke)  { respondBy } → ReviewBatchDto
 *   POST   /hr/reviews/:id/items  { items }  |  DELETE /hr/reviews/:id/items/:itemId → ReviewBatchDto
 *   POST   /hr/reviews/:id/items/:itemId/reply  { reply } → ReviewBatchDto
 *   GET    /review/:token               → ReviewPageDto   (no sign-in; 404 unknown link)
 *   PUT    /review/:token/items/:itemId { decision, comment } → ReviewPageDto   409 closed / scheduled
 *   POST   /review/:token/done          → ReviewPageDto
 *   GET    /review/:token/items/:itemId/cv → the PDF (inline)
 *   POST   /hr/applications  (multipart, "cv" file) → { id }   409 { code: "duplicate", existing }
 *   POST   /hr/applications/parse-cv  (multipart, "cv" file) → ParsedCvDto   422 { fieldErrors.cv }   nothing stored
 *   PUT    /hr/applications/:id/cv  (multipart: "cv" | cvLink) → ApplicationDetailDto
 *   GET    /hr/sources  |  POST { name } → SourceDto   422 duplicate name / 50 sources
 *   PATCH  /hr/sources/:key  { name?, hidden? }  |  DELETE /hr/sources/:key → SourceDto[]   409 website / in use
 *   PATCH  /hr/applications/:id/contact  { phone, email, source, referrer } → ApplicationDetailDto
 *   PUT    /candidate/applications/:id/cv  (multipart: "cv" | cvLink | useSavedCv) → CandidateOverview   409 cv_locked
 *   POST   /hr/timesheet/absences/:id/files  (multipart "file", one a request) → AbsenceFileDto[]   400 { code } bad file, 409 too_many_files
 *   GET    /hr/timesheet/absence-files/:id   → the file (inline, private, no-store)
 *   DELETE /hr/timesheet/absence-files/:id   → AbsenceFileDto[]
 *   GET    /hr/payroll/months/:YYYY-MM → PayrollMonthDto   403 no payroll right (no numbers), 404 { error: valid range }
 *   POST   /hr/payroll/export { months, employeeIds?, kind } → PayrollExportDto   403, 404 out of range, 409 waiting / no rows
 *   POST   /hr/payroll/months/:YYYY-MM/approve { acknowledgedRed } → PayrollMonthDto   403 no approve right, 409 not a draft, 422 red not acknowledged
 *   POST   /hr/payroll/months/:YYYY-MM/reopen  { reason } → PayrollMonthDto   403 no approve right, 409 paid / not the latest approved, 422 { fieldErrors.reason }
 *   POST   /hr/payroll/months/:YYYY-MM/paid    { paidOn, note? } → PayrollMonthDto   409 not approved, 422 { fieldErrors.paidOn }
 *   PUT    /hr/payroll/months/:YYYY-MM/lines/:employeeId/inputs  partial inputs → { inputs, line }   409 payroll_month_locked, 422 { fieldErrors }
 *   GET    /hr/payroll/profiles  → PayrollProfileListDto  |  GET /hr/payroll/profiles/:id → PayrollProfileDto  |  DELETE → { ok }
 *   GET    /hr/payroll/profiles/:id/prefill → PayrollProfilePrefillDto
 *   POST   /hr/payroll/profiles/:id/versions  |  PUT …/versions/:vid  PayrollProfileVersionInput → PayrollProfileVersionSavedDto   422 { fieldErrors }
 *   DELETE /hr/payroll/profiles/:id/versions/:vid → { ok }
 *   POST   /hr/payroll/profiles/:id/(dependants|commitments|recurring)  |  PUT …/:fid  |  DELETE …/:fid   422 { fieldErrors }
 *   PUT    /hr/payroll/profiles/:id/opening/:year  PayrollOpeningInput → PayrollOpeningDto  |  DELETE → { ok }
 *   POST   /hr/payroll/profiles/:id/bank  PayrollBankInput → PayrollBankAccountDto (last 4 only)  |  DELETE …/bank/:bid
 *   POST   /hr/payroll/profiles/:id/bank/:bid/reveal → { accountNumber }   logged
 *   GET    /hr/payroll/first-month-checklist → PayrollChecklistDto  |  PUT /hr/payroll/first-month-checks { item, employeeId, confirmed }
 *   GET    /hr/payroll/settings?key=&nguoi= → PayrollSettingDto[]  |  GET /hr/payroll/settings/month?thang=YYYY-MM&nguoi= → PayrollSettingsMonthDto
 *   POST   /hr/payroll/settings  PayrollSettingInput → PayrollSettingSavedDto   422 { fieldErrors }, 409 same date
 *   PUT    /hr/payroll/settings/:id  |  DELETE /hr/payroll/settings/:id   409 used by an approved month
 *   POST   /hr/payroll/settings/:id/correct { value, source } → PayrollSettingSavedDto   "Sửa lỗi"
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const profilePath = (employeeId: string, rest = '') => `/hr/payroll/profiles/${encodeURIComponent(employeeId)}${rest}`;
const send = (method: 'POST' | 'PUT', input: unknown): RequestInit => ({ method, body: JSON.stringify(input) });
const saveTo = (employeeId: string, path: string, id: string | null, input: unknown) =>
  request<never>(profilePath(employeeId, id ? `/${path}/${encodeURIComponent(id)}` : `/${path}`), send(id ? 'PUT' : 'POST', input));
const settingPath = (id = '', rest = '') => `/hr/payroll/settings${id ? `/${encodeURIComponent(id)}` : ''}${rest}`;
const settingQuery = (pairs: Record<string, string | undefined>) => {
  const text = new URLSearchParams(Object.entries(pairs).filter((e): e is [string, string] => !!e[1])).toString();
  return text ? `?${text}` : '';
};
const payrollMonthPath = (year: number, month: number) => `/hr/payroll/months/${year}-${String(month).padStart(2, '0')}`;

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
    throw new ApiError(
      res.status,
      body?.error ?? 'Có lỗi xảy ra, thử lại sau.',
      body?.fieldErrors ?? {},
      body?.code,
      body ?? {},
    );
  }
  return body as T;
}

const NETWORK_LOST = 'Mất mạng khi gửi file. Thử gửi lại.';

/** The error body the BE sends, read the same way as request() reads it. */
function uploadError(xhr: XMLHttpRequest): ApiError {
  let body: { error?: string; fieldErrors?: Record<string, string>; code?: string } = {};
  try {
    body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
  } catch (error) {
    console.warn('Upload error body was not JSON', error);
  }
  return new ApiError(xhr.status, body.error ?? 'Có lỗi xảy ra, thử lại sau.', body.fieldErrors ?? {}, body.code, body);
}

/** fetch() cannot tell how far a body has gone up, so a file goes through XMLHttpRequest. */
function upload<T>(path: string, form: FormData, onProgress?: (percent: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('x-requested-with', 'careers-web');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onerror = () => reject(new ApiError(0, NETWORK_LOST));
    xhr.ontimeout = () => reject(new ApiError(0, NETWORK_LOST));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(uploadError(xhr));
      try {
        resolve(JSON.parse(xhr.responseText) as T);
      } catch (error) {
        reject(new ApiError(xhr.status, `Máy chủ trả lời lạ: ${error instanceof Error ? error.message : 'không đọc được'}.`));
      }
    };
    xhr.send(form);
  });
}

/** A new CV as multipart: "cv" file, "cvLink", or "useSavedCv". */
function cvForm(cv: CvInput): FormData {
  const form = new FormData();
  if ('file' in cv) form.append('cv', cv.file);
  else if ('link' in cv) form.append('cvLink', cv.link);
  else form.append('useSavedCv', 'true');
  return form;
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
  candidateOverview: async () => {
    // Older servers answered 401 when signed out; both mean "not signed in".
    const body = await request<CandidateOverview | SignedOutResponse | null>('/candidate/me', {}, true);
    return body && !('signedIn' in body) ? body : null;
  },
  updateCandidate: (patch) => {
    const form = new FormData();
    if (patch.name !== undefined) form.append('name', patch.name);
    if (patch.phone !== undefined) form.append('phone', patch.phone);
    if (patch.alertDepartments) form.append('alertDepartments', JSON.stringify(patch.alertDepartments));
    if (patch.cvFile) form.append('cv', patch.cvFile);
    return request('/candidate/me', { method: 'PATCH', body: form });
  },
  deleteCandidateData: () => request('/candidate/me', { method: 'DELETE' }),
  candidateReplaceCv: (applicationId, cv) =>
    request(`/candidate/applications/${encodeURIComponent(applicationId)}/cv`, { method: 'PUT', body: cvForm(cv) }),
  candidateLogout: () => request('/candidate/logout', { method: 'POST' }),

  hrMe: () => request('/hr/me', {}, true),
  hrSignIn: (email, password) => request('/hr/auth/login', json('POST', { email, password })),
  hrLogout: () => request('/hr/logout', { method: 'POST' }),
  hrJobs: () => request('/hr/jobs'),
  hrDashboard: (period) => request(`/hr/dashboard${period ? `?from=${period.from}&to=${period.to}` : ''}`),
  hrRealtime: () => request('/hr/analytics/realtime'),
  hrJobTemplate: () => request('/hr/jobs/template'),
  hrSaveJobTemplate: (template) => request('/hr/jobs/template', json('PUT', template)),
  hrAddTemplateChoice: (list, value) => request('/hr/jobs/template/choices', json('POST', { list, value })),
  hrJob: (id) => request(`/hr/jobs/${encodeURIComponent(id)}`),
  hrSaveJob: (id, input) =>
    id ? request(`/hr/jobs/${encodeURIComponent(id)}`, json('PUT', input)) : request('/hr/jobs', json('POST', input)),
  hrJobAction: (id, action) => request(`/hr/jobs/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
  hrSetDeadline: (id, deadline) => request(`/hr/jobs/${encodeURIComponent(id)}/deadline`, json('POST', { deadline })),
  hrDeleteJob: (id) => request(`/hr/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrApplications: (jobId, q, source) => {
    const params = new URLSearchParams();
    if (jobId) params.set('jobId', jobId);
    if (q?.trim()) params.set('q', q.trim());
    if (source) params.set('source', source);
    const query = params.toString();
    return request(`/hr/applications${query ? `?${query}` : ''}`);
  },
  hrApplication: (id) => request(`/hr/applications/${encodeURIComponent(id)}`),
  hrRecruitmentLog: ({ group, search, offset }) => {
    const query = new URLSearchParams({ tu: String(offset), ...(group ? { nhom: group } : {}), ...(search ? { tim: search } : {}) });
    return request(`/hr/recruitment-log?${query}`);
  },
  hrAddApplication: ({ cvFile, ...fields }) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value) form.append(key, String(value));
    if (cvFile) form.append('cv', cvFile);
    return request('/hr/applications', { method: 'POST', body: form });
  },
  hrParseCv: (file) => {
    const form = new FormData();
    form.append('cv', file);
    return request('/hr/applications/parse-cv', { method: 'POST', body: form });
  },
  hrReplaceCv: (id, cv) =>
    request(`/hr/applications/${encodeURIComponent(id)}/cv`, { method: 'PUT', body: cvForm(cv) }),
  hrTimesheet: (year, month) => request(`/hr/timesheet/periods/${year}/${month}`),
  hrTimesheetYear: (year) => request(`/hr/timesheet/years/${year}`),
  hrPayrollLog: (q) => {
    const asked = { tu: String(q.offset), nhom: q.area, ky: q.month, ma: q.personCode, ai: q.actor, loai: q.isApprovalOnly ? 'duyet' : undefined, tim: q.search };
    const query = new URLSearchParams(Object.entries(asked).flatMap(([name, value]) => (value ? [[name, value]] : [])));
    return request(`/hr/payroll/log?${query}`);
  },
  hrPayrollMonth: (year, month) => request(payrollMonthPath(year, month)),
  hrPayrollExport: (input) => request('/hr/payroll/export', send('POST', input)),
  hrPayrollPayslips: (monthKey) => request(`/hr/payroll/months/${monthKey}/payslips`),
  hrPayrollPayslipsMark: (monthKey, input) => request(`/hr/payroll/months/${monthKey}/payslips/mark`, send('POST', input)),
  hrPayrollPayslipSend: (monthKey, input) => request(`/hr/payroll/months/${monthKey}/payslips/send`, send('POST', input)),
  hrPayrollApprove: (year, month, input) => request(`${payrollMonthPath(year, month)}/approve`, { method: 'POST', body: JSON.stringify(input) }),
  hrPayrollReopen: (year, month, input) => request(`${payrollMonthPath(year, month)}/reopen`, { method: 'POST', body: JSON.stringify(input) }),
  hrPayrollMarkPaid: (year, month, input) => request(`${payrollMonthPath(year, month)}/paid`, { method: 'POST', body: JSON.stringify(input) }),
  hrPayrollSaveInputs: (monthKey, employeeId, input) =>
    request(`/hr/payroll/months/${encodeURIComponent(monthKey)}/lines/${encodeURIComponent(employeeId)}/inputs`, send('PUT', input)),
  hrPayrollProfiles: () => request('/hr/payroll/profiles'),
  hrPayrollProfile: (employeeId) => request(profilePath(employeeId)),
  hrPayrollProfilePrefill: (employeeId) => request(profilePath(employeeId, '/prefill')),
  hrPayrollDeleteProfile: (employeeId) => request(profilePath(employeeId), { method: 'DELETE' }),
  hrPayrollSaveLevel: (employeeId, id, input) => saveTo(employeeId, 'versions', id, input),
  hrPayrollDeleteLevel: (employeeId, id) => request(profilePath(employeeId, `/versions/${encodeURIComponent(id)}`), { method: 'DELETE' }),
  hrPayrollSaveDependant: (employeeId, id, input) => saveTo(employeeId, 'dependants', id, input),
  hrPayrollSaveCommitment: (employeeId, id, input) => saveTo(employeeId, 'commitments', id, input),
  hrPayrollSaveRecurring: (employeeId, id, input) => saveTo(employeeId, 'recurring', id, input),
  hrPayrollDeleteFact: (employeeId, kind, id) => request(profilePath(employeeId, `/${kind}/${encodeURIComponent(id)}`), { method: 'DELETE' }),
  hrPayrollSaveOpening: (employeeId, taxYear, input) => request(profilePath(employeeId, `/opening/${taxYear}`), send('PUT', input)),
  hrPayrollDeleteOpening: (employeeId, taxYear) => request(profilePath(employeeId, `/opening/${taxYear}`), { method: 'DELETE' }),
  hrPayrollAddBank: (employeeId, input) => request(profilePath(employeeId, '/bank'), send('POST', input)),
  hrPayrollDeleteBank: (employeeId, id) => request(profilePath(employeeId, `/bank/${encodeURIComponent(id)}`), { method: 'DELETE' }),
  hrPayrollRevealBank: (employeeId, id) => request(profilePath(employeeId, `/bank/${encodeURIComponent(id)}/reveal`), { method: 'POST' }),
  hrPayrollChecklist: () => request('/hr/payroll/first-month-checklist'),
  hrPayrollConfirmCheck: (input) => request('/hr/payroll/first-month-checks', send('PUT', input)),
  hrPayrollSettings: (filter = {}) => request(`${settingPath()}${settingQuery({ key: filter.key, nguoi: filter.employeeId })}`),
  hrPayrollSettingsMonth: (month, employeeId) => request(`${settingPath('month')}${settingQuery({ thang: month, nguoi: employeeId })}`),
  hrPayrollAddSetting: (input) => request(settingPath(), send('POST', input)),
  hrPayrollEditSetting: (id, input) => request(settingPath(id), send('PUT', input)),
  hrPayrollDeleteSetting: (id) => request(settingPath(id), { method: 'DELETE' }),
  hrPayrollCorrectSetting: (id, input) => request(settingPath(id, '/correct'), send('POST', input)),
  hrSaveHolidayRange: (input) => request('/hr/timesheet/holidays/range', { method: 'POST', body: JSON.stringify(input) }),
  hrDeleteHolidayRange: (from, to) => request(`/hr/timesheet/holidays/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { method: 'DELETE' }),
  hrAllAbsences: (year) => request(`/hr/timesheet/absences?year=${year}`),
  hrUpdateAbsence: (id, absenceId, input) => request(`/hr/timesheet/employees/${encodeURIComponent(id)}/absences/${encodeURIComponent(absenceId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  hrDepartments: () => request('/hr/timesheet/departments'),
  hrAddDepartment: (input) => request('/hr/timesheet/departments', { method: 'POST', body: JSON.stringify(input) }),
  hrUpdateDepartment: (id, input) => request(`/hr/timesheet/departments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  hrDeleteDepartment: (id) => request(`/hr/timesheet/departments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrStaffKinds: () => request('/hr/timesheet/staff-kinds'),
  hrAddStaffKind: (input) => request('/hr/timesheet/staff-kinds', { method: 'POST', body: JSON.stringify(input) }),
  hrUpdateStaffKind: (id, input) => request(`/hr/timesheet/staff-kinds/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  hrDeleteStaffKind: (id) => request(`/hr/timesheet/staff-kinds/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrAbsenceKinds: () => request('/hr/timesheet/absence-kinds'),
  hrApprovers: () => request('/hr/timesheet/approvers'),
  hrAddApprover: (name) => request('/hr/timesheet/approvers', { method: 'POST', body: JSON.stringify({ name }) }),
  hrDeleteApprover: (id) => request(`/hr/timesheet/approvers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrAddAbsenceKind: (input) => request('/hr/timesheet/absence-kinds', { method: 'POST', body: JSON.stringify(input) }),
  hrUpdateAbsenceKind: (key, input) => request(`/hr/timesheet/absence-kinds/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  hrSetNeedsPaper: (key, needsPaper) => request(`/hr/timesheet/absence-kinds/${encodeURIComponent(key)}/needs-paper`, { method: 'PUT', body: JSON.stringify({ needsPaper }) }),
  hrDeleteAbsenceKind: (key) => request(`/hr/timesheet/absence-kinds/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  hrRegisterAbsence: (id, input) => request(`/hr/timesheet/employees/${encodeURIComponent(id)}/absences`, { method: 'POST', body: JSON.stringify(input) }),
  hrRemoveSheetLeave: (id, line) => request(`/hr/timesheet/employees/${encodeURIComponent(id)}/sheet-leave/remove`, json('POST', line)),
  hrRemoveAbsence: (id, absenceId) => request(`/hr/timesheet/employees/${encodeURIComponent(id)}/absences/${encodeURIComponent(absenceId)}`, { method: 'DELETE' }),
  hrUploadAbsenceFile: (absenceId, file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return upload(`/hr/timesheet/absences/${encodeURIComponent(absenceId)}/files`, form, onProgress);
  },
  hrRemoveAbsenceFile: (fileId) => request(`/hr/timesheet/absence-files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
  hrAbsenceFileUrl: (fileId) => `${BASE}/hr/timesheet/absence-files/${encodeURIComponent(fileId)}`,
  hrTimesheetAddLeaveChange: (id, input) => request(`/hr/timesheet/${encodeURIComponent(id)}/leave-changes`, { method: 'POST', body: JSON.stringify(input) }),
  hrTimesheetRemoveLeaveChange: (id, changeId) => request(`/hr/timesheet/${encodeURIComponent(id)}/leave-changes/${encodeURIComponent(changeId)}`, { method: 'DELETE' }),
  hrDeleteEmployee: (id) => request(`/hr/timesheet/employees/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrTimesheetRange: (from, to) => request(`/hr/timesheet/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  hrTimesheetCells: (id, cells) => request(`/hr/timesheet/${encodeURIComponent(id)}/cells`, json('PATCH', { cells })),
  hrTimesheetNorms: (id, norms) => request(`/hr/timesheet/${encodeURIComponent(id)}/norms`, json('PATCH', { norms })),
  hrTimesheetAddAdjustment: (id, input) => request(`/hr/timesheet/${encodeURIComponent(id)}/adjustments`, json('POST', input)),
  hrTimesheetRemoveAdjustment: (id, adjustmentId) =>
    request(`/hr/timesheet/${encodeURIComponent(id)}/adjustments/${encodeURIComponent(adjustmentId)}`, { method: 'DELETE' }),
  hrTimesheetClose: (id) => request(`/hr/timesheet/${encodeURIComponent(id)}/close`, { method: 'POST' }),
  hrTimesheetReopen: (id, reason) => request(`/hr/timesheet/${encodeURIComponent(id)}/reopen`, json('POST', { reason })),
  hrOpenPeriodAhead: (year, month) => request(`/hr/timesheet/periods/${year}/${month}`, { method: 'POST' }),
  hrSetLeaveMode: (id, mode) => request(`/hr/timesheet/${encodeURIComponent(id)}/leave-mode`, json('PUT', { mode })),
  hrTimesheetLog: ({ area, search, offset }) => {
    const query = new URLSearchParams({ tu: String(offset), ...(area ? { nhom: area } : {}), ...(search ? { tim: search } : {}) });
    return request(`/hr/timesheet/log?${query}`);
  },
  hrEmployees: () => request('/hr/timesheet/employees'),
  hrCreateEmployee: (input) => request('/hr/timesheet/employees', json('POST', input)),
  hrUpdateEmployee: (id, input) => request(`/hr/timesheet/employees/${encodeURIComponent(id)}`, json('PATCH', input)),
  hrRegions: () => request('/hr/timesheet/regions'),
  hrCreateRegion: (input) => request('/hr/timesheet/regions', json('POST', input)),
  hrUpdateRegion: (id, input) => request(`/hr/timesheet/regions/${encodeURIComponent(id)}`, json('PATCH', input)),
  hrDeleteRegion: (id) => request(`/hr/timesheet/regions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrHolidays: () => request('/hr/timesheet/holidays'),
  hrSaveHoliday: (input) => request('/hr/timesheet/holidays', json('POST', input)),
  hrDeleteHoliday: (day) => request(`/hr/timesheet/holidays/${encodeURIComponent(day)}`, { method: 'DELETE' }),
  hrSources: () => request('/hr/sources'),
  hrCreateSource: (name) => request('/hr/sources', json('POST', { name })),
  hrUpdateSource: (key, patch) => request(`/hr/sources/${encodeURIComponent(key)}`, json('PATCH', patch)),
  hrDeleteSource: (key) => request(`/hr/sources/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  hrLogReach: (id, via) => request(`/hr/applications/${encodeURIComponent(id)}/reach`, json('POST', { via })),
  hrUpdateContact: (id, input) => request(`/hr/applications/${encodeURIComponent(id)}/contact`, json('PATCH', input)),
  hrUpdateApplication: (id, patch) => request(`/hr/applications/${encodeURIComponent(id)}`, json('PATCH', patch)),
  hrAddNote: (id, body) => request(`/hr/applications/${encodeURIComponent(id)}/notes`, json('POST', { body })),
  hrEditNote: (id, noteId, body) =>
    request(`/hr/applications/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, json('PATCH', { body })),
  hrDeleteNote: (id, noteId) =>
    request(`/hr/applications/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' }),
  hrScorePending: () => request('/hr/applications/score-pending', { method: 'POST' }),
  hrScoreCv: (id) => request(`/hr/applications/${encodeURIComponent(id)}/score`, { method: 'POST' }),
  hrDeleteApplication: (id) => request(`/hr/applications/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrCvUrl: (id) => `${BASE}/hr/applications/${encodeURIComponent(id)}/cv`,
  hrCvLink: (id) => request(`/hr/applications/${encodeURIComponent(id)}/cv-link`),
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

  listNews: ({ page, category, tag }) => {
    const params = new URLSearchParams();
    if (page && page > 1) params.set('page', String(page));
    if (category) params.set('category', category);
    if (tag) params.set('tag', tag);
    const query = params.toString();
    return request(`/news${query ? `?${query}` : ''}`);
  },
  getNews: (slug) => request(`/news/${encodeURIComponent(slug)}`),
  hrNews: () => request('/hr/news'),
  hrNewsPost: (id) => request(`/hr/news/${encodeURIComponent(id)}`),
  hrCreateNews: (input) => request('/hr/news', json('POST', input)),
  hrSaveNews: (id, input) => request(`/hr/news/${encodeURIComponent(id)}`, json('PUT', input)),
  hrPublishNews: (id) => request(`/hr/news/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  hrUnpublishNews: (id) => request(`/hr/news/${encodeURIComponent(id)}/unpublish`, { method: 'POST' }),
  hrNewsTags: (q) => request(`/hr/news/tags?q=${encodeURIComponent(q.trim())}`),
  hrDeleteNews: (id) => request(`/hr/news/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrCreateNewsCategory: (name) => request('/hr/news/categories', json('POST', { name })),
  hrRenameNewsCategory: (id, name) => request(`/hr/news/categories/${encodeURIComponent(id)}`, json('PATCH', { name })),
  hrDeleteNewsCategory: (id) => request(`/hr/news/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hrUploadNewsImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/hr/news/images', { method: 'POST', body: form });
  },

  hrReviews: () => request('/hr/reviews'),
  hrReview: (id) => request(`/hr/reviews/${encodeURIComponent(id)}`),
  hrCreateReview: (input) => request('/hr/reviews', json('POST', input)),
  hrReviewAction: (id, action) => {
    const base = `/hr/reviews/${encodeURIComponent(id)}`;
    switch (action.type) {
      case 'extend':
        return request(`${base}/extend`, json('POST', { respondBy: action.respondBy }));
      case 'revoke':
        return request(`${base}/revoke`, { method: 'POST' });
      case 'add':
        return request(`${base}/items`, json('POST', { items: action.items }));
      case 'remove':
        return request(`${base}/items/${encodeURIComponent(action.itemId)}`, { method: 'DELETE' });
      case 'reply':
        return request(
          `${base}/items/${encodeURIComponent(action.itemId)}/reply`,
          json('POST', { reply: action.reply }),
        );
    }
  },
  reviewPage: (token) => request(`/review/${encodeURIComponent(token)}`),
  reviewDecide: (token, itemId, input) =>
    request(`/review/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}`, json('PUT', input)),
  reviewDone: (token) => request(`/review/${encodeURIComponent(token)}/done`, { method: 'POST' }),
  reviewCvUrl: (token, itemId) => `${BASE}/review/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}/cv`,
};
