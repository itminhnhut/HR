import {
  addDays,
  todayInVietnam,
  composeWorkingHours,
  EDUCATION_OPTIONS,
  EXPERIENCE_OPTIONS,
  formatSalary,
  NO_REQUIREMENT,
  parseWorkingHours,
  SALARY_MAX_VND,
  SALARY_MIN_VND,
  SALARY_STEP_VND,
  standardBenefits,
  type EmploymentType,
  type HrJobDto,
  type JobInput,
  type JobTemplate,
} from '@careers/shared';

export const DEFAULT_OPEN_DAYS = 30;

export type Mode = 'new' | 'edit';
export type Errors = Partial<Record<keyof JobInput | 'form', string>>;

/** "Khác": the value was typed by hand. */
export const OTHER = 'Khác';

export interface FormState {
  title: string;
  department: string;
  employmentType: EmploymentType;
  experience: string;
  education: string;
  /** One of WORK_DAYS, or OTHER with the text in workingHoursOther. */
  workDays: string;
  startTime: string;
  endTime: string;
  workingHoursOther: string;
  /** Digits only, VND. */
  salaryMin: string;
  salaryMax: string;
  negotiable: boolean;
  deadline: string;
  responsibilities: string;
  requirements: string;
  benefits: string[];
  roadmap: string[];
  /** null: the company office. */
  address: string | null;
}

export function emptyForm(template: JobTemplate): FormState {
  return {
    title: '',
    department: '',
    employmentType: 'full_time',
    experience: EXPERIENCE_OPTIONS[0],
    education: EDUCATION_OPTIONS[0],
    workDays: template.workDays,
    startTime: template.startTime,
    endTime: template.endTime,
    workingHoursOther: '',
    salaryMin: '',
    salaryMax: '',
    negotiable: false,
    // The usual length; HR picks another with one tap.
    deadline: addDays(todayInVietnam(), DEFAULT_OPEN_DAYS),
    responsibilities: '',
    requirements: '',
    benefits: standardBenefits(template),
    roadmap: template.roadmap,
    address: null,
  };
}

const digits = (v: number | null) => (v == null ? '' : String(v));

function hoursFields(text: string | null, template: JobTemplate) {
  if (!text) return { workDays: template.workDays, startTime: template.startTime, endTime: template.endTime };
  const parts = parseWorkingHours(text);
  if (!parts)
    return { workDays: OTHER, startTime: template.startTime, endTime: template.endTime, workingHoursOther: text };
  return { workDays: parts.days, startTime: parts.start, endTime: parts.end };
}

export function fromJob(job: HrJobDto, template: JobTemplate): FormState {
  return {
    ...emptyForm(template),
    title: job.title,
    department: job.department,
    employmentType: job.employmentType,
    experience: job.experience ?? NO_REQUIREMENT,
    education: job.education ?? NO_REQUIREMENT,
    ...hoursFields(job.workingHours, template),
    salaryMin: digits(job.salaryMin),
    salaryMax: digits(job.salaryMax),
    negotiable: job.salaryMin == null && job.salaryMax == null,
    deadline: job.deadline,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    roadmap: job.roadmap,
    address: job.address,
  };
}

const toVnd = (v: string) => (v === '' ? null : Number(v));

export function workingHoursText(f: FormState): string | null {
  if (f.workDays === OTHER) return f.workingHoursOther.trim() || null;
  return composeWorkingHours(f.workDays, f.startTime, f.endTime);
}

export function toInput(f: FormState, intent: JobInput['intent']): JobInput {
  return {
    title: f.title,
    department: f.department,
    employmentType: f.employmentType,
    address: f.address,
    workingHours: workingHoursText(f),
    experience: f.experience.trim() || null,
    education: f.education.trim() || null,
    salaryMin: f.negotiable ? null : toVnd(f.salaryMin),
    salaryMax: f.negotiable ? null : toVnd(f.salaryMax),
    responsibilities: f.responsibilities,
    requirements: f.requirements,
    benefits: f.benefits,
    roadmap: f.roadmap.some((t) => t.trim()) ? f.roadmap : [],
    deadline: f.deadline,
    intent,
  };
}

// ── Salary ──────────────────────────────────────────────────────────────

/** Keeps digits only, so "15.000.000", "15,000,000" and "15000000" all read the same. */
export const salaryDigits = (typed: string) =>
  typed
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 10);

/** Rounds to 100.000 đ when the box loses focus. */
export function roundSalary(value: string): string {
  // Too small to be a monthly salary: leave it as typed so the "thiếu số 0" message makes sense.
  if (!value || Number(value) < SALARY_MIN_VND) return value;
  return String(Math.round(Number(value) / SALARY_STEP_VND) * SALARY_STEP_VND);
}

/** The message shown when the box loses focus, or null. */
export function salaryProblem(value: string): string | null {
  if (!value) return null;
  const vnd = Number(value);
  if (vnd < SALARY_MIN_VND) return 'Dưới 1.000.000 đ. Có thiếu số 0 không?';
  if (vnd > SALARY_MAX_VND) return 'Tối đa 500.000.000 đ.';
  return null;
}

export function salaryRangeProblem(f: FormState): string | null {
  const min = toVnd(f.salaryMin);
  const max = toVnd(f.salaryMax);
  return min != null && max != null && min > max ? 'Lương "Đến" phải lớn hơn hoặc bằng lương "Từ".' : null;
}

export function salaryPreview(f: FormState): string {
  if (f.negotiable) return 'Thỏa thuận';
  // Amounts still being typed (below 1 triệu) would read as "0 triệu".
  const usable = (v: string) => (salaryProblem(v) ? null : toVnd(v));
  const job = { salaryMin: usable(f.salaryMin), salaryMax: usable(f.salaryMax) };
  return job.salaryMin == null && job.salaryMax == null ? 'Thỏa thuận' : formatSalary(job);
}

export const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
