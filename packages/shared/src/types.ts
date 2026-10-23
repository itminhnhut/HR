import type { EffectiveStatus, StoredState } from './job-status.js';

export type JobState = StoredState;
export type EmploymentType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type ApplicationStatus = 'new' | 'seen' | 'interview' | 'passed' | 'rejected';

/** What the candidate sees about their own application (BA board: "HR thấy / ứng viên thấy"). */
export type CandidateStage = 'sent' | 'seen' | 'interview' | 'passed' | 'closed';

export interface SalaryFields {
  salaryMin: number | null;
  salaryMax: number | null;
  /** Extra text after the range, e.g. "hoa hồng". */
  salaryNote: string | null;
}

export interface BenefitGroups {
  income: string[];
  insurance: string[];
  timeOff: string[];
  growth: string[];
  environment: string[];
}

/** One card on the public job board. */
export interface JobCardDto extends SalaryFields {
  id: string;
  slug: string;
  title: string;
  department: string;
  employmentType: EmploymentType;
  remote: boolean;
  city: string;
  deadline: string; // YYYY-MM-DD
  status: EffectiveStatus;
  publishedAt: string | null;
  /** Short perk line shown on the card. */
  perks: string;
}

export interface JobDetailDto extends JobCardDto {
  address: string | null;
  workingHours: string | null;
  level: string | null;
  experience: string | null;
  education: string | null;
  language: string | null;
  headcount: number | null;
  skills: string[];
  summary: string | null;
  teamNote: string | null;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  benefits: BenefitGroups;
  plan: { day30: string | null; day60: string | null; day90: string | null };
}

export interface JobListResponse {
  jobs: JobCardDto[];
  cities: string[];
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
  remote: boolean;
  city: string;
  address: string | null;
  workingHours: string | null;
  level: string | null;
  experience: string | null;
  education: string | null;
  language: string | null;
  headcount: number | null;
  skills: string[];
  summary: string | null;
  teamNote: string | null;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  benefitIncome: string;
  benefitInsurance: string;
  benefitTimeOff: string;
  benefitGrowth: string;
  benefitEnvironment: string;
  plan30: string | null;
  plan60: string | null;
  plan90: string | null;
  deadline: string;
  state: JobState;
  status: EffectiveStatus;
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
  /** Deadline after one "Gia hạn" (BR-04, capped by BR-18). null when not allowed. */
  extendTo: string | null;
}

export interface HrJobsResponse {
  jobs: HrJobRowDto[];
  newApplications: number;
}

export interface ApplicationRowDto {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  phone: string;
  status: ApplicationStatus;
  createdAt: string;
}

export interface ApplicationDetailDto extends ApplicationRowDto {
  email: string | null;
  message: string | null;
  cvFileName: string | null;
  cvLink: string | null;
  note: string | null;
  /** Candidate ticked "Giữ hồ sơ 12 tháng" (BR-09). */
  keepForOtherJobs: boolean;
  thankedAt: string | null;
}

export interface ApplicationsResponse {
  applications: ApplicationRowDto[];
  counts: Record<ApplicationStatus | 'all', number>;
  jobs: { id: string; title: string }[];
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
  email: string;
  name: string | null;
}

export interface CandidateMe {
  phone: string;
  name: string | null;
  email: string | null;
  cvFileName: string | null;
  keepForOtherJobs: boolean;
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
  saved: JobCardDto[];
}
