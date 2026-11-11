import type {
  PayslipListDto,
  PayslipMarkInput,
  PayslipSendInput,
  PayslipSendResultDto,
} from '@careers/shared';
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
  RejectReason,
  ReportPeriod,
  InterviewMode,
  MessageTemplate,
  MessageTemplatesResponse,
  TemplateKey,
  ContactChannel,
  JobTemplate,
  DashboardDto,
  RealtimeDto,
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
  EmployeeDto,
  EmployeeInput,
  HolidayInput,
  RegionInput,
  SourceDto,
  TimesheetAdjustmentInput,
  TimesheetCellsInput,
  TimesheetDto,
  TimesheetHolidayDto,
  AbsenceInput,
  DepartmentDto,
  DepartmentInput,
  StaffKindDto,
  StaffKindInput,
  AbsenceKindDto,
  AbsenceKindInput,
  AbsenceRowDto,
  AbsenceFileDto,
  ApproverDto,
  HolidayRangeInput,
  LeaveChangeInput,
  TimesheetAbsenceDto,
  TimesheetLogPageDto,
  TimesheetMonthDto,
  TimesheetRegionDto,
  ParsedCvDto,
  TemplateChoiceList,
  TimesheetLogArea,
  LeaveMode,
  RecruitmentLogGroup,
  RecruitmentLogPageDto,
  PayrollBankAccountDto,
  PayrollBankInput,
  PayrollChecklistDto,
  PayrollFirstMonthCheckDto,
  PayrollFirstMonthCheckInput,
  PayrollCommitmentDto,
  PayrollDependantDto,
  PayrollOpeningDto,
  PayrollProfileDto,
  PayrollProfileListDto,
  PayrollProfilePrefillDto,
  PayrollProfileVersionInput,
  PayrollProfileVersionSavedDto,
  PayrollRecurringDto,
  PayrollRecurringKind,
  PayrollSettingDto,
  PayrollSettingInput,
  PayrollSettingSavedDto,
  PayrollSettingsMonthDto,
  PayrollLogArea,
  PayrollLogPageDto,
} from '@careers/shared';

import type {
  PayrollExportDto,
  PayrollExportRequest,
  PayrollMonthDto,
  PayrollMonthInputsInput,
  PayrollMonthInputsResultDto,
} from '@careers/shared';

/** Lương (spec-luong.md 10, 11.2): the month, its rows and HR's month inputs are shared with the API. */
export type {
  PayrollLogArea,
  PayrollLogLineDto,
  PayrollLogPageDto,
  PayrollCashItemDto,
  PayrollExportDto,
  PayrollExportMonthDto,
  PayrollExportRequest,
  PayrollLineDto,
  PayrollMonthDto,
  PayrollMonthInputsDto,
  PayrollMonthInputsInput,
  PayrollMonthInputsResultDto,
  PayrollOtherIncomeDto,
  PayrollOverrideDto,
  PayrollPeriodStatus,
} from '@careers/shared';

/** Duyệt (spec 11.4): a red warning left needs `acknowledgedRed` ("Đã xem cảnh báo đỏ"). */
/** What Nhật ký lương is asked for (spec-luong.md 11.9): every filter is optional, lines come 100 at a time. */
export interface PayrollLogQuery {
  area?: PayrollLogArea;
  /** "YYYY-MM"; left out for every month. */
  month?: string;
  /** A person's code, as the lines write it. */
  personCode?: string;
  actor?: string;
  /** Only Duyệt, Mở lại, Đã chuyển khoản. */
  isApprovalOnly?: boolean;
  search?: string;
  offset: number;
}

export interface PayrollApproveInput {
  acknowledgedRed: boolean;
}
/** Mở lại (R7): the reason is required. */
export interface PayrollReopenInput {
  reason: string;
}
/** Đã chuyển khoản: the transfer day "YYYY-MM-DD" and an optional note. */
export interface PayrollMarkPaidInput {
  paidOn: string;
  note?: string;
}

/** Người phụ thuộc, cam kết thuế, khoản (32) định kỳ: each added, changed and deleted the same way. */
export type PayrollFactKind = 'dependants' | 'commitments' | 'recurring';
export interface PayrollDependantInput {
  fromMonth: string;
  toMonth: string | null;
  count: number;
}
export interface PayrollCommitmentInput {
  year: number;
  signedOn: string;
}
export interface PayrollRecurringInput {
  kind: PayrollRecurringKind;
  /** 0 for "Công ty trả thay BH": the month's employee insurance, never typed. */
  amount: number;
  /** "Tính thuế" of "Công ty trả thay BH"; left out: not taxed, as HR's file. */
  taxable?: boolean;
  fromMonth: string;
  toMonth: string | null;
  note: string;
}
export type PayrollOpeningInput = Omit<PayrollOpeningDto, 'taxYear'>;

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
  rejectReason?: RejectReason;
  rejectNote?: string | null;
  /** "Hoàn tác": the change never happened. */
  isUndo?: boolean;
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
  jobTitle: string;
  alias: string;
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
  hrDashboard(period?: ReportPeriod): Promise<DashboardDto>;
  hrRealtime(): Promise<RealtimeDto>;
  hrJobTemplate(): Promise<JobTemplateResponse>;
  hrSaveJobTemplate(template: JobTemplate): Promise<JobTemplateResponse>;
  hrAddTemplateChoice(list: TemplateChoiceList, value: string): Promise<JobTemplateResponse>;
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
  hrTimesheet(year: number, month: number): Promise<TimesheetDto>;
  hrTimesheetRange(from: string, to: string): Promise<TimesheetDto>;
  hrTimesheetYear(year: number): Promise<TimesheetMonthDto[]>;
  /** Nhật ký lương, newest first. 403 without the payroll right. */
  hrPayrollLog(query: PayrollLogQuery): Promise<PayrollLogPageDto>;
  /** Bảng lương of one month. 403 without the payroll right; 404 with the valid range outside it. */
  hrPayrollMonth(year: number, month: number): Promise<PayrollMonthDto>;
  /**
   * The months of one download with what the file prints beyond the grid; the payroll file carries the whole account
   * number. 403 without the payroll right, 404 outside the range, 409 a month waiting for the close or without rows.
   */
  hrPayrollExport(input: PayrollExportRequest): Promise<PayrollExportDto>;
  /** Phiếu lương of a month "YYYY-MM": each person's address and whether the payslip was sent. */
  hrPayrollPayslips(monthKey: string): Promise<PayslipListDto>;
  /** "Đánh dấu đã gửi" (or taking it back). 409 unless the month is approved or paid. */
  hrPayrollPayslipsMark(monthKey: string, input: PayslipMarkInput): Promise<PayslipListDto>;
  /** "Gửi tự động" of one person with their file. 409 mail not configured, a draft month or no email. */
  hrPayrollPayslipSend(monthKey: string, input: PayslipSendInput): Promise<PayslipSendResultDto>;
  /** Duyệt a draft. 403 without the approve right, 409 not a draft, 422 a red warning not acknowledged. */
  hrPayrollApprove(year: number, month: number, input: PayrollApproveInput): Promise<PayrollMonthDto>;
  /** Mở lại the latest approved month. 403 without the approve right, 409 paid or not the latest, 422 no reason. */
  hrPayrollReopen(year: number, month: number, input: PayrollReopenInput): Promise<PayrollMonthDto>;
  /** Đã chuyển khoản on an approved month. 409 not approved, 422 a bad day. */
  hrPayrollMarkPaid(year: number, month: number, input: PayrollMarkPaidInput): Promise<PayrollMonthDto>;
  /** Đầu vào tháng of one person, partial (lists replaced whole). 409 payroll_month_locked, 422 { fieldErrors }. */
  hrPayrollSaveInputs(
    monthKey: string,
    employeeId: string,
    input: PayrollMonthInputsInput,
  ): Promise<PayrollMonthInputsResultDto>;
  /** Hồ sơ lương (spec-luong.md 11.5): everyone from Chấm công, with or without a profile. */
  hrPayrollProfiles(): Promise<PayrollProfileListDto>;
  hrPayrollProfile(employeeId: string): Promise<PayrollProfileDto>;
  /** What "Tạo hồ sơ" fills in: component defaults and the contract type's default, from the day they joined. */
  hrPayrollProfilePrefill(employeeId: string): Promise<PayrollProfilePrefillDto>;
  /** Only a profile no approved month used. */
  hrPayrollDeleteProfile(employeeId: string): Promise<{ ok: true }>;
  /** A pay level from a date; 422 { fieldErrors }, 409 two levels on one day. */
  hrPayrollSaveLevel(
    employeeId: string,
    id: string | null,
    input: PayrollProfileVersionInput,
  ): Promise<PayrollProfileVersionSavedDto>;
  hrPayrollDeleteLevel(employeeId: string, id: string): Promise<{ ok: true }>;
  hrPayrollSaveDependant(employeeId: string, id: string | null, input: PayrollDependantInput): Promise<PayrollDependantDto>;
  hrPayrollSaveCommitment(
    employeeId: string,
    id: string | null,
    input: PayrollCommitmentInput,
  ): Promise<PayrollCommitmentDto>;
  hrPayrollSaveRecurring(employeeId: string, id: string | null, input: PayrollRecurringInput): Promise<PayrollRecurringDto>;
  hrPayrollDeleteFact(employeeId: string, kind: PayrollFactKind, id: string): Promise<{ ok: true }>;
  hrPayrollSaveOpening(employeeId: string, taxYear: number, input: PayrollOpeningInput): Promise<PayrollOpeningDto>;
  hrPayrollDeleteOpening(employeeId: string, taxYear: number): Promise<{ ok: true }>;
  /** The number goes in whole and comes back as its last four digits. */
  hrPayrollAddBank(employeeId: string, input: PayrollBankInput): Promise<PayrollBankAccountDto>;
  hrPayrollDeleteBank(employeeId: string, id: string): Promise<{ ok: true }>;
  /** "Hiện đủ": the whole number, written in the payroll log. */
  hrPayrollRevealBank(employeeId: string, id: string): Promise<{ accountNumber: string }>;
  /** Danh sách kiểm trước tháng lương đầu (spec 17.2). */
  hrPayrollChecklist(): Promise<PayrollChecklistDto>;
  /** HR ticks (or unticks) one item of the list as checked. */
  hrPayrollConfirmCheck(input: PayrollFirstMonthCheckInput): Promise<PayrollFirstMonthCheckDto>;
  /** Cấu hình lương (spec 6, 11.6): every stored row; `key` and `employeeId` narrow it. */
  hrPayrollSettings(filter?: { key?: string; employeeId?: string }): Promise<PayrollSettingDto[]>;
  /** Each setting as month `YYYY-MM` reads it (R2), its rows labelled; `employeeId` resolves one person's view. */
  hrPayrollSettingsMonth(month: string, employeeId?: string): Promise<PayrollSettingsMonthDto>;
  /** A new row from a month (or date) for everyone or one person, or a stop row. 422 { fieldErrors }, 409 same date. */
  hrPayrollAddSetting(input: PayrollSettingInput): Promise<PayrollSettingSavedDto>;
  /** Only a row no approved month used (409 otherwise). */
  hrPayrollEditSetting(
    id: string,
    input: { from?: string; value?: unknown; source?: string },
  ): Promise<PayrollSettingSavedDto>;
  hrPayrollDeleteSetting(id: string): Promise<{ ok: true }>;
  /** "Sửa lỗi" (R5): a replacement on the same date, the old row kept as "đã thay". */
  hrPayrollCorrectSetting(id: string, input: { value: unknown; source?: string }): Promise<PayrollSettingSavedDto>;
  hrSaveHolidayRange(input: HolidayRangeInput): Promise<TimesheetHolidayDto[]>;
  hrDeleteHolidayRange(from: string, to: string): Promise<TimesheetHolidayDto[]>;
  hrAllAbsences(year: number): Promise<AbsenceRowDto[]>;
  hrUpdateAbsence(employeeId: string, absenceId: string, input: AbsenceInput): Promise<TimesheetAbsenceDto[]>;
  hrDepartments(): Promise<DepartmentDto[]>;
  hrAddDepartment(input: DepartmentInput): Promise<DepartmentDto[]>;
  hrUpdateDepartment(id: string, input: DepartmentInput): Promise<DepartmentDto[]>;
  hrDeleteDepartment(id: string): Promise<DepartmentDto[]>;
  hrStaffKinds(): Promise<StaffKindDto[]>;
  hrAddStaffKind(input: StaffKindInput): Promise<StaffKindDto[]>;
  hrUpdateStaffKind(id: string, input: StaffKindInput): Promise<StaffKindDto[]>;
  hrDeleteStaffKind(id: string): Promise<StaffKindDto[]>;
  hrAbsenceKinds(): Promise<AbsenceKindDto[]>;
  hrApprovers(): Promise<ApproverDto[]>;
  hrAddApprover(name: string): Promise<ApproverDto[]>;
  hrDeleteApprover(id: string): Promise<ApproverDto[]>;
  hrAddAbsenceKind(input: AbsenceKindInput): Promise<AbsenceKindDto[]>;
  hrDeleteAbsenceKind(key: string): Promise<AbsenceKindDto[]>;
  hrUpdateAbsenceKind(key: string, input: AbsenceKindInput): Promise<AbsenceKindDto[]>;
  hrSetNeedsPaper(key: string, needsPaper: boolean): Promise<AbsenceKindDto[]>;
  hrRegisterAbsence(employeeId: string, input: AbsenceInput): Promise<TimesheetAbsenceDto[]>;
  hrRemoveAbsence(employeeId: string, absenceId: string): Promise<TimesheetAbsenceDto[]>;
  /** Clears the days of a line typed straight into the sheet. */
  hrRemoveSheetLeave(employeeId: string, line: { code: string; from: string; to: string }): Promise<{ removed: number }>;
  /** One paper a request (multipart "file"), with how far it has gone (0–100). Returns the absence's papers, oldest first. */
  hrUploadAbsenceFile(absenceId: string, file: File, onProgress?: (percent: number) => void): Promise<AbsenceFileDto[]>;
  hrRemoveAbsenceFile(fileId: string): Promise<AbsenceFileDto[]>;
  /** Where a paper is read, signed in; null in the demo, which keeps no files. */
  hrAbsenceFileUrl(fileId: string): string | null;
  hrTimesheetAddLeaveChange(periodId: string, input: LeaveChangeInput): Promise<TimesheetDto>;
  hrTimesheetRemoveLeaveChange(periodId: string, changeId: string): Promise<TimesheetDto>;
  hrDeleteEmployee(id: string): Promise<EmployeeDto[]>;
  hrTimesheetCells(periodId: string, cells: TimesheetCellsInput['cells']): Promise<TimesheetDto>;
  hrTimesheetNorms(periodId: string, norms: Record<string, number>): Promise<TimesheetDto>;
  hrTimesheetAddAdjustment(periodId: string, input: TimesheetAdjustmentInput): Promise<TimesheetDto>;
  hrTimesheetRemoveAdjustment(periodId: string, adjustmentId: string): Promise<TimesheetDto>;
  hrTimesheetClose(periodId: string): Promise<TimesheetDto>;
  hrTimesheetReopen(periodId: string, reason: string): Promise<TimesheetDto>;
  hrSetLeaveMode(periodId: string, mode: LeaveMode): Promise<TimesheetDto>;
  hrOpenPeriodAhead(year: number, month: number): Promise<TimesheetDto>;
  hrTimesheetLog(query: { area?: TimesheetLogArea; search?: string; offset: number }): Promise<TimesheetLogPageDto>;
  hrEmployees(): Promise<EmployeeDto[]>;
  hrCreateEmployee(input: EmployeeInput): Promise<EmployeeDto>;
  hrUpdateEmployee(id: string, input: EmployeeInput): Promise<EmployeeDto>;
  hrRegions(): Promise<TimesheetRegionDto[]>;
  hrCreateRegion(input: RegionInput): Promise<TimesheetRegionDto[]>;
  hrUpdateRegion(id: string, input: RegionInput): Promise<TimesheetRegionDto[]>;
  hrDeleteRegion(id: string): Promise<TimesheetRegionDto[]>;
  hrHolidays(): Promise<TimesheetHolidayDto[]>;
  hrSaveHoliday(input: HolidayInput): Promise<TimesheetHolidayDto[]>;
  hrDeleteHoliday(day: string): Promise<TimesheetHolidayDto[]>;
  hrSources(): Promise<SourceDto[]>;
  /** 422 { fieldErrors: { name } } for a name that exists (case and tones ignored) or the 50th source. */
  hrCreateSource(name: string): Promise<SourceDto>;
  /** Rename and / or hide; returns the whole list. 409 for "Website" or hiding "Khác". */
  hrUpdateSource(key: string, patch: { name?: string; hidden?: boolean }): Promise<SourceDto[]>;
  /** Only a source HR added that no application uses (409 otherwise). */
  hrDeleteSource(key: string): Promise<SourceDto[]>;
  /** Phone, email, source of an application HR added (409 for one the candidate sent). */
  hrUpdateContact(id: string, input: HrContactInput): Promise<ApplicationDetailDto>;
  /** Notes a press on "Gọi" or "Zalo" in the log; the phone's own app does the rest. */
  hrLogReach(id: string, via: 'call' | 'zalo'): Promise<void>;
  hrApplication(id: string): Promise<ApplicationDetailDto>;
  /** "Nhật ký tuyển dụng": 100 lines a page, newest first. */
  hrRecruitmentLog(query: { group?: RecruitmentLogGroup; search?: string; offset: number }): Promise<RecruitmentLogPageDto>;
  hrUpdateApplication(id: string, patch: ApplicationPatch): Promise<ApplicationDetailDto>;
  /** "Ghi chú nội bộ": add, edit or delete one entry; each answers with the application's detail. */
  hrAddNote(id: string, body: string): Promise<ApplicationDetailDto>;
  hrEditNote(id: string, noteId: string, body: string): Promise<ApplicationDetailDto>;
  hrDeleteNote(id: string, noteId: string): Promise<ApplicationDetailDto>;
  hrDeleteApplication(id: string): Promise<{ ok: true }>;
  /** "Chấm CV": scores the CV against the job's requirements (reuses the stored result when unchanged). */
  hrScoreCv(id: string): Promise<ApplicationDetailDto>;
  /** Scores a batch of CV files that have no up-to-date result. */
  hrScorePending(): Promise<{ scored: number; remaining: number }>;
  /** Link that opens an uploaded CV for HR, or null where files are not stored (demo). */
  hrCvUrl(applicationId: string): string | null;
  /** The address an interview invitation carries; the demo stores no files, so it has none. */
  hrCvLink(applicationId: string): Promise<{ url: string; expiresAt: string } | null>;
  hrUsers(): Promise<HrUserDto[]>;
  hrCreateUser(input: { email: string; name: string }): Promise<TempPasswordResponse>;
  hrResetPassword(id: string): Promise<TempPasswordResponse>;
  hrDeleteUser(id: string): Promise<{ ok: true }>;
  hrChangePassword(current: string, next: string): Promise<HrMe>;
  hrUpdateProfile(patch: HrProfilePatch): Promise<HrMe>;
  hrMessageTemplates(): Promise<MessageTemplatesResponse>;
  hrSaveMessageTemplate(key: TemplateKey, input: Omit<MessageTemplate, 'key'>): Promise<MessageTemplatesResponse>;
  hrResetMessageTemplate(key: TemplateKey): Promise<MessageTemplatesResponse>;
  /** "Đã soạn thư": HR opened a filled template in Gmail / a mail app, or copied it (plain, or designed for Outlook). */
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
