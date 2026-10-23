import type { ApplicationStatus, EmploymentType, SalaryFields } from './types.js';

export const DEPARTMENTS = ['Kinh doanh', 'Kỹ thuật', 'Marketing', 'Vận hành', 'Nhân sự'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  internship: 'Thực tập',
  contract: 'Hợp đồng',
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'Mới',
  seen: 'Đã xem',
  interview: 'Hẹn phỏng vấn',
  passed: 'Đạt',
  rejected: 'Chưa phù hợp',
};

export function hasSalary(job: SalaryFields): boolean {
  return job.salaryMin != null || job.salaryMax != null;
}

export function formatSalary(job: SalaryFields): string {
  const { salaryMin: min, salaryMax: max, salaryNote: note } = job;
  let range: string;
  if (min != null && max != null) range = min === max ? `${min} triệu` : `${min} – ${max} triệu`;
  else if (min != null) range = `Từ ${min} triệu`;
  else if (max != null) range = `Đến ${max} triệu`;
  else return 'Thỏa thuận';
  return note ? `${range} + ${note}` : range;
}

/** 2026-11-30 -> 30/11/2026 */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** ISO timestamp -> dd/mm/yyyy in Vietnam time */
export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Split a multi-line field into bullet items. */
export function toLines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean);
}

export function locationLabel(job: { city: string; remote: boolean }): string {
  return job.remote ? `${job.city}, từ xa` : job.city;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecentlyPublished(publishedAt: string | null, now: Date = new Date()): boolean {
  return !!publishedAt && now.getTime() - new Date(publishedAt).getTime() < WEEK_MS;
}

export function postedAgoLabel(publishedAt: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(publishedAt).getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? 'Mới đăng hôm nay' : `Mới đăng ${days} ngày trước`;
}

/** First two benefit lines, for the job card. */
export function perksSummary(benefits: string): string {
  return toLines(benefits).slice(0, 2).join(', ');
}

export function lastName(fullName: string): string {
  return fullName.trim().split(/\s+/).pop() ?? fullName;
}

export const CANDIDATE_STAGE_LABEL: Record<import('./types.js').CandidateStage, string> = {
  sent: 'Đã gửi',
  seen: 'HR đã xem',
  interview: 'Mời phỏng vấn',
  passed: 'Đạt',
  closed: 'Đã đóng',
};

/**
 * What the candidate sees (never "trượt"). A job that closed while the
 * application was still unprocessed shows as closed too.
 */
export function candidateStage(status: ApplicationStatus, jobClosed: boolean): import('./types.js').CandidateStage {
  if (status === 'rejected') return 'closed';
  if (status === 'passed') return 'passed';
  if (status === 'interview') return 'interview';
  if (jobClosed) return 'closed';
  return status === 'seen' ? 'seen' : 'sent';
}

/** Lowercase, strip Vietnamese tones, đ → d. Used for accent-insensitive search. */
export function foldVietnamese(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Every word of the query must appear somewhere in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = foldVietnamese(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = foldVietnamese(haystack);
  return words.every((w) => text.includes(w));
}

const BIAS_TERMS = [
  'nam giới',
  'nữ giới',
  'ưu tiên nam',
  'ưu tiên nữ',
  'tuyển nam',
  'tuyển nữ',
  'chỉ nhận nam',
  'chỉ nhận nữ',
  'nữ',
  'tuổi',
  'ngoại hình',
  'độc thân',
  'chưa lập gia đình',
  'chưa có con',
  'chiều cao',
  'cao từ',
];

/**
 * BR-15: returns the first wording that may read as discrimination by gender,
 * age, looks or marital status, or null. Whole words only, so "nữa" and
 * "Việt Nam" do not match.
 */
export function findBiasTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of BIAS_TERMS) {
    const re = new RegExp(`(^|[^\\p{L}])${term}(?=$|[^\\p{L}])`, 'u');
    if (re.test(lower)) return term;
  }
  return null;
}
