import type {
  ApplicationDetailDto,
  ApplicationFields,
  ApplicationsResponse,
  ApplicationStatus,
  ApplyResponse,
  CandidateMe,
  CandidateOverview,
  HrJobDto,
  HrJobsResponse,
  HrMe,
  HrUserDto,
  JobTemplate,
  DashboardDto,
  JobInput,
  JobListResponse,
  JobPageResponse,
  JobTemplateResponse,
  LookupResponse,
  TempPasswordResponse,
} from '@careers/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
    /** Machine-readable reason, e.g. "job_closed". */
    public code?: string,
  ) {
    super(message);
  }
}

export type JobAction = 'publish' | 'close';

export interface ApplyInput extends Omit<ApplicationFields, 'phone'> {
  phone: string;
  cvFile: File | null;
  /** Signed in only: reuse the CV saved in the account (the BE keeps a copy per application). */
  useSavedCv?: boolean;
}

export interface CandidatePatch {
  name?: string;
  /** Unverified; empty string removes it. Pre-fills the application form. */
  phone?: string;
  alertDepartments?: string[];
  cvFile?: File;
}

export interface ApplicationPatch {
  status?: ApplicationStatus;
  note?: string | null;
  /** ISO time; null clears it. */
  interviewAt?: string | null;
}

/**
 * Everything the screens need. Two implementations: `mockApi` (in the
 * browser, for demos) and `httpApi` (the real BE at VITE_API_URL).
 */
export interface Api {
  // Public
  listJobs(): Promise<JobListResponse>;
  getJob(slug: string): Promise<JobPageResponse>;
  apply(input: ApplyInput): Promise<ApplyResponse>;
  /** Public lookup by phone: job, date and stage only (last 90 days). 429 when looked up too often. */
  lookupApplications(phone: string): Promise<LookupResponse>;

  // Candidate account (optional, never needed to apply)
  /** Google is the only candidate sign-in. The account sees applications sent with its email. */
  googleSignIn(): Promise<CandidateMe>;
  candidateOverview(): Promise<CandidateOverview | null>;
  updateCandidate(patch: CandidatePatch): Promise<CandidateMe>;
  deleteCandidateData(): Promise<{ ok: true }>;
  candidateLogout(): Promise<{ ok: true }>;

  // HR
  hrMe(): Promise<HrMe | null>;
  /** Own HR accounts (email + password), not Google. 401 wrong, 429 locked after 5 tries. */
  hrSignIn(email: string, password: string): Promise<HrMe>;
  hrLogout(): Promise<{ ok: true }>;
  hrJobs(): Promise<HrJobsResponse>;
  hrDashboard(): Promise<DashboardDto>;
  hrJobTemplate(): Promise<JobTemplateResponse>;
  hrSaveJobTemplate(template: JobTemplate): Promise<JobTemplateResponse>;
  hrJob(id: string): Promise<HrJobDto>;
  hrSaveJob(id: string | null, input: JobInput): Promise<HrJobDto>;
  hrJobAction(id: string, action: JobAction): Promise<{ ok: true }>;
  /** "Sửa hạn nộp": reopens an ended job. */
  hrSetDeadline(id: string, deadline: string): Promise<{ ok: true }>;
  /** Only drafts can be deleted. */
  hrDeleteJob(id: string): Promise<{ ok: true }>;
  hrApplications(jobId?: string, q?: string): Promise<ApplicationsResponse>;
  hrApplication(id: string): Promise<ApplicationDetailDto>;
  hrUpdateApplication(id: string, patch: ApplicationPatch): Promise<ApplicationDetailDto>;
  hrDeleteApplication(id: string): Promise<{ ok: true }>;
  hrDeleteDueApplications(): Promise<{ deleted: number }>;
  /** Link that opens an uploaded CV for HR, or null where files are not stored (demo). */
  hrCvUrl(applicationId: string): string | null;
  hrUsers(): Promise<HrUserDto[]>;
  hrCreateUser(input: { email: string; name: string }): Promise<TempPasswordResponse>;
  hrResetPassword(id: string): Promise<TempPasswordResponse>;
  hrDeleteUser(id: string): Promise<{ ok: true }>;
  hrChangePassword(current: string, next: string): Promise<HrMe>;
}
