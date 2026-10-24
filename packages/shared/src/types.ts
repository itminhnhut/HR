import type { EffectiveStatus, StoredState } from './job-status.js';

export type JobState = StoredState;
export type EmploymentType = 'full_time' | 'part_time' | 'internship';
export type ApplicationStatus = 'new' | 'seen' | 'interview' | 'rejected';

/** What the candidate sees about their own application (BA board: "HR thấy / ứng viên thấy"). */
export type CandidateStage = 'sent' | 'seen' | 'interview' | 'closed';

export interface SalaryFields {
  /** VND per month. Both null means "Thỏa thuận". */
  salaryMin: number | null;
  salaryMax: number | null;
}

/** One card on the public job board. */
export interface JobCardDto extends SalaryFields {
  id: string;
  slug: string;
  title: string;
  department: string;
  employmentType: EmploymentType;
  /** Where the job is, short: the office label or the job's own address. */
  place: string;
  deadline: string; // YYYY-MM-DD
  status: EffectiveStatus;
  publishedAt: string | null;
  /** Short perk line shown on the card. */
  perks: string;
}

export interface JobDetailDto extends JobCardDto {
  /** null: the company office (map and directions are shown). */
  address: string | null;
  workingHours: string | null;
  experience: string | null;
  education: string | null;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  /** One text per ROADMAP_MILESTONES entry; empty when the job has no roadmap. */
  roadmap: string[];
}

export interface JobListResponse {
  jobs: JobCardDto[];
}

export interface JobPageResponse {
  job: JobDetailDto;
  similar: JobCardDto[];
}

/** Full editable job for the HR form. Multi-line fields are plain text, one item per line. */
export interface HrJobDto extends SalaryFields {
  id: string;
  slug: string;
  title: string;
  department: string;
  employmentType: EmploymentType;
  address: string | null;
  workingHours: string | null;
  experience: string | null;
  education: string | null;
  responsibilities: string;
  requirements: string;
  benefits: string[];
  roadmap: string[];
  deadline: string;
  state: JobState;
  status: EffectiveStatus;
}

/** Defaults for a new job plus what earlier jobs used, for suggestions. */
export interface JobTemplateResponse {
  template: import('./job-template.js').JobTemplate;
  departments: string[];
  /** Benefits typed by hand on earlier jobs. */
  extraBenefits: string[];
}

export interface HrJobRowDto extends SalaryFields {
  id: string;
  slug: string;
  title: string;
  department: string;
  deadline: string;
  status: EffectiveStatus;
  totalApplications: number;
  newApplications: number;
}

export interface HrJobsResponse {
  jobs: HrJobRowDto[];
  newApplications: number;
  /** Applications of jobs that ended more than 30 days ago: HR deletes them. */
  dueForDeletion: number;
}

export interface ApplicationRowDto {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  phone: string;
  status: ApplicationStatus;
  createdAt: string;
  hasCv: boolean;
  /** First line of the HR note, for the list. */
  noteLine: string | null;
  interviewAt: string | null;
}

export interface ApplicationDetailDto extends ApplicationRowDto {
  email: string | null;
  message: string | null;
  cvFileName: string | null;
  cvLink: string | null;
  note: string | null;
  noteUpdatedAt: string | null;
  noteUpdatedBy: string | null;
  /** The same person's other applications (same phone), newest first. */
  otherApplications: { id: string; jobTitle: string; status: ApplicationStatus; createdAt: string }[];
}

export interface ApplicationsResponse {
  applications: ApplicationRowDto[];
  counts: Record<ApplicationStatus | 'all', number>;
  jobs: { id: string; title: string }[];
}

/** One HR account in "Tài khoản HR". */
export interface HrUserDto {
  id: string;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
  isMe: boolean;
}

/** Shown once: the temporary password of a new or reset account. */
export interface TempPasswordResponse {
  user: HrUserDto;
  password: string;
}

export interface DashboardDto {
  newApplications: number;
  /** "Mới" for more than 3 days. */
  waitingOver3Days: number;
  /** Applications per Vietnam day, oldest first, 30 entries. */
  perDay: { day: string; count: number }[];
  /** Per job, for the chart filter: same 30 days. */
  perJobPerDay: { jobId: string; jobTitle: string; counts: number[] }[];
  interviews: { id: string; fullName: string; jobTitle: string; interviewAt: string | null; noteLine: string | null }[];
  /** Live jobs ending within 3 days and jobs that expired in the last 14 days. */
  endingJobs: { id: string; title: string; deadline: string; status: EffectiveStatus }[];
  dueForDeletion: number;
}

export interface SubscriberDto {
  id: string;
  phone: string;
  department: string;
  fromJobTitle: string | null;
  createdAt: string;
}

export interface ApiError {
  error: string;
  fieldErrors?: Record<string, string>;
}

export interface ApplyResponse {
  ok: true;
  firstName: string;
  phone: string;
  /** BR-07: same phone applied to the same job within 30 days. */
  updatedExisting: boolean;
  previousDate: string | null;
}

export interface HrMe {
  id: string;
  email: string;
  name: string | null;
}

export interface CandidateMe {
  /** Verified Google email: the account identity. Applications sent with this email show up. */
  email: string;
  /** Typed by the candidate, not verified. Pre-fills the form and receives job alerts. */
  phone: string | null;
  name: string | null;
  cvFileName: string | null;
  alertDepartments: string[];
}

export interface CandidateApplicationDto {
  id: string;
  jobSlug: string;
  jobTitle: string;
  salary: string;
  place: string;
  createdAt: string;
  stage: CandidateStage;
}

export interface CandidateOverview {
  me: CandidateMe;
  applications: CandidateApplicationDto[];
}

/** One application in the public phone lookup: deliberately no name, email, CV or HR notes. */
export interface LookupItemDto {
  jobTitle: string;
  jobSlug: string;
  /** Vietnam date the application was (last) sent, YYYY-MM-DD. */
  appliedOn: string;
  stage: CandidateStage;
}

export interface LookupResponse {
  applications: LookupItemDto[];
}
