/** What happens after the interview, and why an application closed (spec-hiring-outcomes.md). */
export type RejectReasonGroup = 'company' | 'terms' | 'candidate' | 'other';

/** Never shown to the candidate or put in a letter. On purpose no age, gender, marriage or health. */
export const REJECT_REASONS = [
  { key: 'lacks_experience', label: 'Thiếu kinh nghiệm', group: 'company' },
  { key: 'wrong_field', label: 'Sai chuyên môn', group: 'company' },
  { key: 'lacks_qualification', label: 'Thiếu bằng cấp, chứng chỉ', group: 'company' },
  { key: 'skills', label: 'Kỹ năng hoặc ngoại ngữ chưa đạt', group: 'company' },
  { key: 'reviewer_declined', label: 'Sếp không duyệt', group: 'company' },
  { key: 'salary', label: 'Lương không khớp', group: 'terms' },
  { key: 'place_or_time', label: 'Địa điểm hoặc thời gian không phù hợp', group: 'terms' },
  { key: 'unreachable', label: 'Không liên lạc được', group: 'candidate' },
  { key: 'no_show', label: 'Không đến phỏng vấn', group: 'candidate' },
  { key: 'candidate_declined', label: 'Ứng viên từ chối', group: 'candidate' },
  { key: 'other', label: 'Khác', group: 'other' },
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number]['key'];

export const REJECT_REASON_KEYS = REJECT_REASONS.map((r) => r.key) as [RejectReason, ...RejectReason[]];

export const REJECT_NOTE_MAX = 300;

export function rejectReasonLabel(reason: RejectReason): string {
  return REJECT_REASONS.find((r) => r.key === reason)?.label ?? reason;
}

/** The candidate left, so there is nobody to send a thank-you letter of refusal to. */
export function isCandidateSideReason(reason: RejectReason | null): boolean {
  return REJECT_REASONS.some((r) => r.key === reason && r.group === 'candidate');
}

/** The interview time has passed and HR has not written down how it went. */
export function isAwaitingResult(a: { status: string; interviewAt: string | null }, now: Date): boolean {
  return a.status === 'interview' && a.interviewAt !== null && new Date(a.interviewAt) <= now;
}

type Status = 'new' | 'seen' | 'interview' | 'passed' | 'hired' | 'rejected';

/** The candidate has been invited, whatever came of it: from here a reviewer's decision no longer changes anything. */
export const isInvited = (status: Status) => status === 'interview' || status === 'passed' || status === 'hired';

/**
 * The flow of an application, in one place for the screen and the server. Forward: Mới, Đã xem (opening it), Hẹn phỏng
 * vấn, Chờ kết quả (the time passing), Đạt, Nhận việc; "Chưa phù hợp" from anywhere. Back only one step at a time, to
 * correct a mistake. Returns why a change is not allowed, or null.
 */
export function statusChangeProblem(
  app: { status: Status; interviewAt: string | null },
  to: Status,
  now: Date,
): string | null {
  if (to === app.status) return null;
  const hasResult = app.status === 'passed' || app.status === 'hired';
  switch (to) {
    case 'new':
      return app.status === 'seen' ? null : 'Chỉ đánh dấu chưa xem khi hồ sơ đang ở "Đã xem".';
    case 'seen':
      return hasResult ? 'Hồ sơ đã có kết quả, về "Hẹn phỏng vấn" trước.' : null;
    case 'interview':
      return app.status === 'hired' ? 'Về "Đạt" trước.' : null;
    case 'passed':
      if (!app.interviewAt) return 'Chọn giờ phỏng vấn trước khi ghi kết quả.';
      return new Date(app.interviewAt) > now
        ? 'Chưa tới giờ phỏng vấn. Nếu đã phỏng vấn sớm hơn, đổi giờ trước.'
        : null;
    case 'hired':
      return app.status === 'passed' ? null : 'Ghi "Đạt" trước khi ghi "Nhận việc".';
    default:
      return null;
  }
}

/** How far the applications that came in during the period went, per source: ever reached, not where they are now. */
export interface SourceFunnelRow {
  source: string;
  received: number;
  interview: number;
  passed: number;
  hired: number;
  topRejectReason: RejectReason | null;
}

/** The days the reports of the dashboard cover, both included, in Vietnam dates. */
export interface ReportPeriod {
  from: string;
  to: string;
}

export const DEFAULT_REPORT_DAYS = 30;
/** Ten years: a report across years needs no month, and the numbers come from the status log. */
export const MAX_REPORT_DAYS = 3660;
