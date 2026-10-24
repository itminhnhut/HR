/**
 * Job lifecycle rules (see the BA board, BR-01 … BR-06).
 * Pure functions only, so they are unit-tested without a database.
 */

export const VIETNAM_OFFSET = '+07:00'; // Vietnam has no DST.
export const EXPIRING_WINDOW_DAYS = 3; // BR-03
export const MAX_OPEN_DAYS = 60; // BR-01

const DAY_MS = 24 * 60 * 60 * 1000;

export type StoredState = 'draft' | 'published' | 'closed';
export type EffectiveStatus = 'draft' | 'open' | 'expiring' | 'expired' | 'closed';

interface JobLike {
  state: StoredState;
  deadline: string; // YYYY-MM-DD, Vietnam local date
}

/** End of the deadline day in Vietnam, 23:59:59.999 (BR-02). */
export function deadlineEnd(deadline: string): Date {
  return new Date(`${deadline}T23:59:59.999${VIETNAM_OFFSET}`);
}

/** Today's date in Vietnam as YYYY-MM-DD. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / DAY_MS);
}

export function effectiveStatus(job: JobLike, now: Date = new Date()): EffectiveStatus {
  const remainingMs = deadlineEnd(job.deadline).getTime() - now.getTime();
  if (job.state !== 'published') return job.state;
  if (remainingMs < 0) return 'expired';
  // BR-03 counts calendar days in Vietnam: deadline 26/10 is "còn 3 ngày" on 23/10.
  if (daysBetween(todayInVietnam(now), job.deadline) <= EXPIRING_WINDOW_DAYS) return 'expiring';
  return 'open';
}

export function acceptsApplications(status: EffectiveStatus): boolean {
  return status === 'open' || status === 'expiring';
}

/** Listed on the public job board and in the sitemap. */
export function isListed(status: EffectiveStatus): boolean {
  return acceptsApplications(status);
}

export function daysLeft(deadline: string, now: Date = new Date()): number {
  return daysBetween(todayInVietnam(now), deadline);
}

export type DeadlineProblem = 'missing' | 'past' | 'too_far' | null;

/** BR-01: required, not in the past, at most MAX_OPEN_DAYS from today. */
export function validateDeadline(deadline: string | undefined, now: Date = new Date()): DeadlineProblem {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return 'missing';
  const today = todayInVietnam(now);
  if (deadline < today) return 'past';
  if (daysBetween(today, deadline) > MAX_OPEN_DAYS) return 'too_far';
  return null;
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  draft: 'Bản nháp',
  open: 'Đang tuyển',
  expiring: 'Sắp hết hạn',
  expired: 'Hết hạn',
  closed: 'Đã đóng',
};

/** Taking no applications any more: past the deadline or closed by HR. */
export function hasEnded(status: EffectiveStatus): boolean {
  return status === 'expired' || status === 'closed';
}

/** Day the job stopped taking applications, or null while it still does (or never did). */
export function endedOn(job: JobLike & { closedOn: string | null }, now: Date = new Date()): string | null {
  const status = effectiveStatus(job, now);
  if (status === 'closed') return job.closedOn;
  return status === 'expired' ? job.deadline : null;
}
