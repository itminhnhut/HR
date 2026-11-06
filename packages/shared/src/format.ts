import type { ApplicationStatus, EmploymentType, JobSection, SalaryFields, WorkMode } from './types.js';

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  internship: 'Thực tập',
};

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  onsite: 'Tại văn phòng',
  hybrid: 'Kết hợp (Hybrid)',
  remote: 'Từ xa (Remote)',
};

/** "2 người" */
export const openingsLabel = (openings: number) => `${openings} người`;

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'Mới',
  seen: 'Đã xem',
  scheduling: 'Chờ xếp lịch',
  interview: 'Hẹn phỏng vấn',
  passed: 'Đạt',
  hired: 'Nhận việc',
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

const BULLET_MARKER = /^[-•*\s]+/;
/** A line HR started with "•", "-" or "*" (spaces before it allowed). */
const BULLETED = /^\s*[-•*]/;

const stripMarker = (line: string) => line.replace(BULLET_MARKER, '').trim();

/** Split a multi-line field into lines, bullet markers removed. Headings stay in: use toItems for "the items". */
export function toLines(text: string | null | undefined): string[] {
  return (text ?? '').split('\n').map(stripMarker).filter(Boolean);
}

/** True when HR writes the field with bullet markers: lines without one are then headings. */
export const usesBullets = (text: string | null | undefined): boolean =>
  (text ?? '').split('\n').some((line) => BULLETED.test(line) && stripMarker(line) !== '');

/** Adds one line to the groups: a heading opens a new group, an item joins the last one. */
function addLine(sections: JobSection[], line: string): JobSection[] {
  const content = stripMarker(line);
  if (!content) return sections;
  if (!BULLETED.test(line)) return [...sections, { title: content, items: [] }];
  const last = sections.at(-1);
  if (!last) return [{ title: null, items: [content] }];
  return [...sections.slice(0, -1), { ...last, items: [...last.items, content] }];
}

/**
 * Groups a multi-line field under its headings. Once any line starts with a bullet marker, lines without one
 * are group headings ("1. Quản lý đơn hàng") and marked lines are the items. With no marker at all every line
 * is an item of one untitled group, as before headings existed. Empty text has no groups.
 */
export function toSections(text: string | null | undefined): JobSection[] {
  if (!usesBullets(text)) {
    const items = toLines(text);
    return items.length > 0 ? [{ title: null, items }] : [];
  }
  return (text ?? '').split('\n').reduce(addLine, []);
}

/** Every item of a multi-line field, headings left out: what is listed, scored or counted. */
export function toItems(text: string | null | undefined): string[] {
  return toSections(text).flatMap((section) => section.items);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecentlyPublished(publishedAt: string | null, now: Date = new Date()): boolean {
  return !!publishedAt && now.getTime() - new Date(publishedAt).getTime() < WEEK_MS;
}

export function postedAgoLabel(publishedAt: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(publishedAt).getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? 'Mới đăng hôm nay' : `Mới đăng ${days} ngày trước`;
}

/** "Nguyễn Hồ Minh Nhựt (thử)" -> "Nhựt": the given name, ignoring notes in brackets. */
export function lastName(fullName: string): string {
  const name = fullName.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').trim() || fullName.trim();
  return name.split(/\s+/).pop() ?? fullName;
}

export const CANDIDATE_STAGE_LABEL: Record<import('./types.js').CandidateStage, string> = {
  sent: 'Đã gửi',
  seen: 'HR đã xem',
  interview: 'Mời phỏng vấn',
  hired: 'Đã nhận việc',
  closed: 'Đã đóng',
};

/**
 * What the candidate sees (never "trượt"). A job that closed while the
 * application was still unprocessed shows as closed too.
 */
export function candidateStage(status: ApplicationStatus, jobClosed: boolean): import('./types.js').CandidateStage {
  if (status === 'rejected') return 'closed';
  if (status === 'hired') return 'hired';
  // "Đạt" stays HR's to say on the phone first.
  if (status === 'interview' || status === 'passed') return 'interview';
  if (jobClosed) return 'closed';
  // Still agreeing a time: the candidate is told HR has seen it, and nothing is promised yet.
  return status === 'seen' || status === 'scheduling' ? 'seen' : 'sent';
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
