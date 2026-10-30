import type { ApplicationRowDto, ReviewState } from '@careers/shared';

/** Small rules of the review screens (spec-boss-review.md), kept apart so they are easy to test. */

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-31T17:00" for <input type="datetime-local">, in the browser's own time zone. */
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The input's value back to an ISO time the API accepts; '' when the box is empty or invalid. */
export function fromLocalInput(value: string): string {
  const d = new Date(value);
  return value && !Number.isNaN(d.getTime()) ? d.toISOString() : '';
}

/** Default reply-by: 17:00 two working days later (Saturday and Sunday skipped). */
export function defaultRespondBy(now: Date): string {
  const d = new Date(now);
  let left = 2;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  d.setHours(17, 0, 0, 0);
  return toLocalInput(d);
}

/** "Duyệt ứng viên · Kế toán" when every application is for one job, else a neutral title. */
export function defaultTitle(rows: Pick<ApplicationRowDto, 'jobTitle'>[]): string {
  const titles = new Set(rows.map((r) => r.jobTitle));
  const [only] = [...titles];
  return titles.size === 1 && only ? `Duyệt ứng viên · ${only}` : 'Duyệt ứng viên';
}

export const reviewLink = (token: string, origin = window.location.origin) => `${origin}/duyet/${token}`;

/** Ready to paste into Zalo: who it is for, what, until when, the link. */
export function zaloMessage(
  batch: { reviewerName: string; title: string; total: number; respondBy: string },
  link: string,
): string {
  const by = shortTime(batch.respondBy);
  return [
    `Gửi ${batch.reviewerName}: ${batch.title} (${batch.total} ứng viên).`,
    `Mở link để xem CV và chọn Duyệt PV / Không / Hỏi HR, mong phản hồi trước ${by}:`,
    link,
    'Link chỉ dành cho anh/chị, vui lòng không chuyển tiếp.',
  ].join('\n');
}

export const STATE_LABEL: Record<ReviewState, string> = {
  open: 'Đang mở',
  expired: 'Hết hạn',
  revoked: 'Đã khoá',
};

/** "17:00, 31/10" in Vietnam time (Intl's vi-VN gives "17:00 31-10"). */
export function shortTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')}, ${part('day')}/${part('month')}`;
}
