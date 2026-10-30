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
  InterviewMode,
  MessageTemplatesResponse,
  TemplateKey,
  ContactChannel,
  JobTemplate,
  DashboardDto,
  JobInput,
  JobListResponse,
  JobPageResponse,
  JobTemplateResponse,
  LookupResponse,
  TempPasswordResponse,
  HrNewsListResponse,
  HrNewsPostDto,
  NewsCategoryDto,
  NewsListResponse,
  NewsPostDto,
  NewsPostInput,
  ReviewBatchDto,
  ReviewBatchRowDto,
  ReviewCreateInput,
  ReviewDecisionInput,
  ReviewPageDto,
  ApplicationSource,
  HrApplicationInput,
  HrContactInput,
  SourceDto,
  ParsedCvDto,
} from '@careers/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
    /** Machine-readable reason, e.g. "job_closed". */
    public code?: string,
    /** The rest of the error body, e.g. `existing` with a "duplicate" (read it with a type guard). */
    public details: Record<string, unknown> = {},
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
  /** Cloudflare Turnstile token, when CAPTCHA is on. */
  captchaToken?: string;
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
  interviewMode?: InterviewMode | null;
  /** Empty string clears it. */
  meetingUrl?: string | null;
  /** "Vẫn hẹn": invite before the reviewer approved; the reason is logged for the reviewer. */
  reviewBypassReason?: string;
}

/** A new CV: a PDF, a link, or (candidate only) the CV saved in the account. */
export type CvInput = { file: File } | { link: string } | { useSaved: true };

/** "Thêm hồ sơ": the fields plus an optional PDF (spec-cv-intake.md). */
export interface AddApplicationInput extends HrApplicationInput {
  cvFile: File | null;
}

/** What HR does to a sent batch (spec-boss-review.md). */
export type ReviewAction =
  | { type: 'extend'; respondBy: string }
  | { type: 'revoke' }
  | { type: 'add'; items: ReviewCreateInput['items'] }
  | { type: 'remove'; itemId: string }
  | { type: 'reply'; itemId: string; reply: string };

/** An uploaded article image: its public address and real size (for width/height, no layout shift). */
export interface UploadedImage {
  url: string;
  width: number;
  height: number;
}

export interface NewsListQuery {
  page?: number;
  /** Category slug. */
  category?: string;
  /** Hashtag slug. */
  tag?: string;
}

/** A hashtag suggestion for the editor (postCount includes drafts). */
export interface NewsTagSuggestion {
  name: string;
  slug: string;
  postCount: number;
}

export interface HrProfilePatch {
  name: string;
  phone: string;
  contactEmail: string;
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
  lookupApplications(phone: string, captchaToken?: string): Promise<LookupResponse>;

  // Candidate account (optional, never needed to apply)
  /** Google is the only candidate sign-in. The account sees applications sent with its email. */
  googleSignIn(): Promise<CandidateMe>;
  candidateOverview(): Promise<CandidateOverview | null>;
  /** "Cập nhật CV" of an own application; 409 with the reason when it is no longer allowed. */
  candidateReplaceCv(applicationId: string, cv: CvInput): Promise<CandidateOverview>;
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
  hrAddTemplateChoice(list: 'departments' | 'experiences' | 'educations', value: string): Promise<JobTemplateResponse>;
  hrJob(id: string): Promise<HrJobDto>;
  hrSaveJob(id: string | null, input: JobInput): Promise<HrJobDto>;
  hrJobAction(id: string, action: JobAction): Promise<{ ok: true }>;
  /** "Sửa hạn nộp": reopens an ended job. */
  hrSetDeadline(id: string, deadline: string): Promise<{ ok: true }>;
  /** Only drafts can be deleted. */
  hrDeleteJob(id: string): Promise<{ ok: true }>;
  hrApplications(jobId?: string, q?: string, source?: ApplicationSource): Promise<ApplicationsResponse>;
  /** "Thêm hồ sơ". 409 { code: "duplicate", existing } when this phone already applied for this job. */
  hrAddApplication(input: AddApplicationInput): Promise<{ id: string }>;
  /** "Thêm hồ sơ" pre-fill: name, phone, email read from a PDF (not stored). readable false for a scan. */
  hrParseCv(file: File): Promise<ParsedCvDto>;
  /** "Thêm CV" / "Đổi CV" on any application. */
  hrReplaceCv(id: string, cv: CvInput): Promise<ApplicationDetailDto>;
  /** HR's source list (spec-custom-sources.md), with the number of applications of each. */
  hrSources(): Promise<SourceDto[]>;
  /** 422 { fieldErrors: { name } } for a name that exists (case and tones ignored) or the 50th source. */
  hrCreateSource(name: string): Promise<SourceDto>;
  /** Rename and / or hide; returns the whole list. 409 for "Website" or hiding "Khác". */
  hrUpdateSource(key: string, patch: { name?: string; hidden?: boolean }): Promise<SourceDto[]>;
  /** Only a source HR added that no application uses (409 otherwise). */
  hrDeleteSource(key: string): Promise<SourceDto[]>;
  /** Phone, email, source of an application HR added (409 for one the candidate sent). */
  hrUpdateContact(id: string, input: HrContactInput): Promise<ApplicationDetailDto>;
  hrApplication(id: string): Promise<ApplicationDetailDto>;
  hrUpdateApplication(id: string, patch: ApplicationPatch): Promise<ApplicationDetailDto>;
  hrDeleteApplication(id: string): Promise<{ ok: true }>;
  /** "Chấm CV": scores the CV against the job's requirements (reuses the stored result when unchanged). */
  hrScoreCv(id: string): Promise<ApplicationDetailDto>;
  /** Scores a batch of CV files that have no up-to-date result. */
  hrScorePending(): Promise<{ scored: number; remaining: number }>;
  hrDeleteDueApplications(): Promise<{ deleted: number }>;
  /** Link that opens an uploaded CV for HR, or null where files are not stored (demo). */
  hrCvUrl(applicationId: string): string | null;
  hrUsers(): Promise<HrUserDto[]>;
  hrCreateUser(input: { email: string; name: string }): Promise<TempPasswordResponse>;
  hrResetPassword(id: string): Promise<TempPasswordResponse>;
  hrDeleteUser(id: string): Promise<{ ok: true }>;
  hrChangePassword(current: string, next: string): Promise<HrMe>;
  hrUpdateProfile(patch: HrProfilePatch): Promise<HrMe>;
  hrMessageTemplates(): Promise<MessageTemplatesResponse>;
  hrSaveMessageTemplate(key: TemplateKey, input: { subject: string; body: string }): Promise<MessageTemplatesResponse>;
  hrResetMessageTemplate(key: TemplateKey): Promise<MessageTemplatesResponse>;
  /** "Đã soạn thư": HR opened a filled template in Gmail / a mail app, or copied it. */
  hrLogContact(id: string, input: { templateKey: TemplateKey; channel: ContactChannel }): Promise<ApplicationDetailDto>;

  // News (spec-news.md). Public: published posts only.
  listNews(query: NewsListQuery): Promise<NewsListResponse>;
  /** 404 for drafts, hidden posts and unknown slugs. */
  getNews(slug: string): Promise<NewsPostDto>;
  hrNews(): Promise<HrNewsListResponse>;
  hrNewsPost(id: string): Promise<HrNewsPostDto>;
  /** A new draft. 422 { fieldErrors } like saving. */
  hrCreateNews(input: NewsPostInput): Promise<HrNewsPostDto>;
  /**
   * Autosave. Partial: a field left out keeps its stored value. Slug: a typed one wins, '' follows the title
   * again, and once the post was ever published it never changes. A published post stays publishable (422).
   */
  hrSaveNews(id: string, input: NewsPostInput): Promise<HrNewsPostDto>;
  /** 422 { fieldErrors: { title?, categoryId?, cover?, content? } } when something is missing. */
  hrPublishNews(id: string): Promise<HrNewsPostDto>;
  /** Published → hidden: off the site and the sitemap, keeps its address. Publish shows it again. */
  hrUnpublishNews(id: string): Promise<HrNewsPostDto>;
  /** Hashtags already used, most used first, matched without accents (at most 20). */
  hrNewsTags(q: string): Promise<{ tags: NewsTagSuggestion[] }>;
  hrDeleteNews(id: string): Promise<{ ok: true }>;
  hrCreateNewsCategory(name: string): Promise<NewsCategoryDto>;
  hrRenameNewsCategory(id: string, name: string): Promise<NewsCategoryDto>;
  /** 409 while the category still has posts. */
  hrDeleteNewsCategory(id: string): Promise<{ ok: true }>;
  /** JPEG/PNG/WebP up to NEWS_IMAGE_MAX_BYTES (4 MB); the editor shrinks big photos first. */
  hrUploadNewsImage(file: File): Promise<UploadedImage>;

  // "Sếp duyệt ứng viên" (spec-boss-review.md). HR side needs a session; the reviewer's side only the link token.
  hrReviews(): Promise<ReviewBatchRowDto[]>;
  hrReview(id: string): Promise<ReviewBatchDto>;
  /** 409 { code: "in_review" } when an application already waits in another batch. */
  hrCreateReview(input: ReviewCreateInput): Promise<ReviewBatchDto>;
  hrReviewAction(id: string, action: ReviewAction): Promise<ReviewBatchDto>;
  /** 404 for an unknown link. Opening it tells HR the reviewer has seen it. */
  reviewPage(token: string): Promise<ReviewPageDto>;
  /** 409 when the link expired / was revoked, or HR already set the interview. */
  reviewDecide(token: string, itemId: string, input: ReviewDecisionInput): Promise<ReviewPageDto>;
  reviewDone(token: string): Promise<ReviewPageDto>;
  /** The CV file through the review link, or null where files are not stored (demo). */
  reviewCvUrl(token: string, itemId: string): string | null;
}
