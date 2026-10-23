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
  JobInput,
  JobListResponse,
  JobPageResponse,
  SubscriberDto,
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

export type JobAction = 'publish' | 'extend' | 'pause' | 'resume' | 'fill';

export interface ApplyInput extends Omit<ApplicationFields, 'phone'> {
  phone: string;
  cvFile: File | null;
}

export interface SubscribeInput {
  phone: string;
  department: string;
  fromJobId?: string | null;
  consent: boolean;
}

export interface CandidatePatch {
  name?: string;
  keepForOtherJobs?: boolean;
  alertDepartments?: string[];
  cvFile?: File;
}

export interface ApplicationPatch {
  status?: ApplicationStatus;
  note?: string | null;
  thanked?: boolean;
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
  subscribe(input: SubscribeInput): Promise<{ ok: true }>;

  // Candidate account (optional, never needed to apply)
  requestOtp(phone: string, channel: 'zalo' | 'sms'): Promise<{ ok: true; devCode?: string }>;
  verifyOtp(phone: string, code: string): Promise<CandidateMe>;
  googleSignIn(): Promise<{ email: string; needsPhone: boolean }>;
  candidateOverview(): Promise<CandidateOverview | null>;
  updateCandidate(patch: CandidatePatch): Promise<CandidateMe>;
  setSavedJob(slug: string, saved: boolean): Promise<string[]>;
  savedJobSlugs(): Promise<string[]>;
  deleteCandidateData(): Promise<{ ok: true }>;
  candidateLogout(): Promise<{ ok: true }>;

  // HR
  hrMe(): Promise<HrMe | null>;
  hrGoogleSignIn(): Promise<HrMe>;
  hrLogout(): Promise<{ ok: true }>;
  hrJobs(): Promise<HrJobsResponse>;
  hrJob(id: string): Promise<HrJobDto>;
  hrSaveJob(id: string | null, input: JobInput): Promise<HrJobDto>;
  hrJobAction(id: string, action: JobAction): Promise<{ ok: true }>;
  hrApplications(jobId?: string): Promise<ApplicationsResponse>;
  hrApplication(id: string): Promise<ApplicationDetailDto>;
  hrUpdateApplication(id: string, patch: ApplicationPatch): Promise<ApplicationDetailDto>;
  hrSubscribers(): Promise<SubscriberDto[]>;
  hrDeleteSubscriber(id: string): Promise<{ ok: true }>;
}
