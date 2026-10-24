import { OFFICE } from './job-template.js';
import type { ApplicationStatus, EmploymentType, SalaryFields } from './types.js';

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  internship: 'Thực tập',
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'Mới',
  seen: 'Đã xem',
  interview: 'Hẹn phỏng vấn',
  rejected: 'Chưa phù hợp',
};

export function hasSalary(job: SalaryFields): boolean {
  return job.salaryMin != null || job.salaryMax != null;
}

const MILLION = 1_000_000;

/** 7_500_000 -> "7,5"; 15_000_000 -> "15" */
export function formatMillions(vnd: number): string {
  const millions = Math.round((vnd / MILLION) * 10) / 10;
  return String(millions).replace('.', ',');
}

/** "15 – 20 triệu", "7,5 triệu", "Từ 10 triệu", "Thỏa thuận" */
export function formatSalary(job: SalaryFields): string {
  const { salaryMin: min, salaryMax: max } = job;
  if (min != null && max != null) {
    return min === max ? `${formatMillions(min)} triệu` : `${formatMillions(min)} – ${formatMillions(max)} triệu`;
  }
  if (min != null) return `Từ ${formatMillions(min)} triệu`;
  if (max != null) return `Đến ${formatMillions(max)} triệu`;
  return 'Thỏa thuận';
}

/** 15000000 -> "15.000.000" */
export function groupThousands(vnd: number): string {
  return String(vnd).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

/** Short place for cards: the office, or the job's own address. */
export function placeLabel(address: string | null): string {
  return address?.trim() || OFFICE.label;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecentlyPublished(publishedAt: string | null, now: Date = new Date()): boolean {
  return !!publishedAt && now.getTime() - new Date(publishedAt).getTime() < WEEK_MS;
}

export function postedAgoLabel(publishedAt: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(publishedAt).getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? 'Mới đăng hôm nay' : `Mới đăng ${days} ngày trước`;
}

export function lastName(fullName: string): string {
  return fullName.trim().split(/\s+/).pop() ?? fullName;
}

export const CANDIDATE_STAGE_LABEL: Record<import('./types.js').CandidateStage, string> = {
  sent: 'Đã gửi',
  seen: 'HR đã xem',
  interview: 'Mời phỏng vấn',
  closed: 'Đã đóng',
};

/**
 * What the candidate sees (never "trượt"). A job that closed while the
 * application was still unprocessed shows as closed too.
 */
export function candidateStage(status: ApplicationStatus, jobClosed: boolean): import('./types.js').CandidateStage {
  if (status === 'rejected') return 'closed';
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
