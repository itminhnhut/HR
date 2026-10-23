/**
 * Job lifecycle rules (see the BA board, BR-01 … BR-06).
 * Pure functions only, so they are unit-tested without a database.
 */

export const VIETNAM_OFFSET = '+07:00'; // Vietnam has no DST.
export const EXPIRING_WINDOW_DAYS = 3; // BR-03
export const GRACE_MINUTES = 60; // edge case: form opened before expiry
export const MAX_OPEN_DAYS = 60; // BR-01
export const EXTEND_DAYS = 14; // BR-04

const DAY_MS = 24 * 60 * 60 * 1000;

export type StoredState = 'draft' | 'published' | 'paused' | 'filled';
export type EffectiveStatus = 'draft' | 'open' | 'expiring' | 'paused' | 'expired' | 'filled';

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
  // BR-19: a paused job whose deadline passes becomes expired.
  if (job.state === 'paused') return remainingMs < 0 ? 'expired' : 'paused';
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

/**
 * A candidate who opened the form before the deadline may still submit
 * within GRACE_MINUTES after it passes.
 */
export function canSubmit(job: JobLike, formOpenedAt: Date, now: Date = new Date()): boolean {
  const status = effectiveStatus(job, now);
  if (acceptsApplications(status)) return true;
  if (status !== 'expired') return false;
  const end = deadlineEnd(job.deadline).getTime();
  return formOpenedAt.getTime() <= end && now.getTime() <= end + GRACE_MINUTES * 60 * 1000;
}

/** BR-04: extend from whichever is later, the old deadline or today. */
export function extendedDeadline(deadline: string, now: Date = new Date()): string {
  const today = todayInVietnam(now);
  const base = deadline > today ? deadline : today;
  return addDays(base, EXTEND_DAYS);
}

/**
 * BR-18: one extension adds EXTEND_DAYS, but the job may not take applications
 * for more than MAX_OPEN_DAYS after it was published. Returns null when no
 * extension is possible (HR must "Đăng lại" instead).
 */
export function extendTarget(deadline: string, publishedOn: string | null, now: Date = new Date()): string | null {
  const wanted = extendedDeadline(deadline, now);
  if (!publishedOn) return wanted;
  const cap = addDays(publishedOn, MAX_OPEN_DAYS);
  const target = wanted > cap ? cap : wanted;
  const today = todayInVietnam(now);
  return target > deadline && target > today ? target : null;
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
  paused: 'Tạm dừng',
  expired: 'Hết hạn',
  filled: 'Đã tuyển đủ',
};
