import type { ReviewItem } from '@careers/shared';
import { blockLink, FILTER_PARAMS, isBlockReview } from './payrollModel';

/**
 * Rà soát without React (spec 11.3): where each warning is fixed. A warning about a number opens the person's row
 * on the grid; one about a date, a contract or an account opens the screen that edits it, and the words at the end
 * of the row say which.
 */

export interface ReviewTarget {
  to: string;
  /** "Sửa ở Chấm công": where the click goes, in HR's words. */
  words: string;
}

export interface ReviewContext {
  monthKey: string;
  /** The page's own search: the month and the filters stay when the link stays on Bảng lương. */
  search: string;
  /** The person's block on the month's line (a Khối warning). */
  block: string | null;
}

const AT_TIMESHEET = 'Sửa ở Chấm công';
const AT_PROFILE = 'Sửa ở Hồ sơ lương';
const AT_CONFIG = 'Xem ở Cấu hình';
const AT_GRID = 'Xem trên lưới';

/** Fixed in the person's Hồ sơ lương: the account, the tax commitments. */
const PROFILE_CODES = new Set([
  'missing-bank-account',
  'missing-profile',
  'commitment-expired',
  'commitment-exceeds',
  'probation-no-commitment',
]);
/** Fixed on the person's pay levels (contract type, probation days, the dates of a level). */
const LEVEL_CODES = new Set([
  'default-official-contract',
  'missing-contract',
  'unknown-contract',
  'profile-gap',
  'probation-too-long',
]);

const gridSearch = (search: string, change: (next: URLSearchParams) => void) => {
  const next = new URLSearchParams(search);
  next.delete('rs');
  change(next);
  return `/hr/luong?${next.toString()}`;
};

/** The grid showing only this person, keeping the month. */
const rowLink = (search: string, employeeId: string) =>
  gridSearch(search, (next) => next.set(FILTER_PARAMS.people, employeeId));

/** The person's Hồ sơ lương open over the grid; `isLevels` opens it on the pay levels of the month. */
const profileLink = (search: string, employeeId: string, isLevels: boolean) =>
  gridSearch(search, (next) => {
    next.set('hs', employeeId);
    if (isLevels) next.set('phan', 'muc');
    else next.delete('phan');
  });

const configAt = (monthKey: string, group: string, key?: string) =>
  `/hr/luong/cau-hinh?ky=${monthKey}&muc=${group}${key ? `&khoa=${encodeURIComponent(key)}` : ''}`;

function monthTarget(code: string, monthKey: string): ReviewTarget | null {
  if (code === 'closing-unconfirmed') return { to: `/hr/cham-cong?ky=${monthKey}`, words: 'Mở Chấm công' };
  if (code === 'block-from-person') return { to: '/hr/cham-cong/nhan-vien', words: 'Mở Chấm công' };
  if (code === 'checklist-pending') return { to: `/hr/luong/ho-so?ky=${monthKey}`, words: 'Mở Hồ sơ lương' };
  if (code === 'union-fund-off') return { to: configAt(monthKey, 'bao-hiem', 'tuy-chon.d03'), words: AT_CONFIG };
  if (code === 'contract-commitment') return { to: configAt(monthKey, 'loai-hd'), words: AT_CONFIG };
  return null;
}

/** Where a warning is fixed; null for a month-wide one with nothing to open. */
export function reviewTarget(item: ReviewItem, context: ReviewContext): ReviewTarget | null {
  const { employeeId, code } = item;
  if (!employeeId) return monthTarget(code, context.monthKey);
  if (isBlockReview(code)) return { to: blockLink({ employeeId, block: context.block }), words: AT_TIMESHEET };
  if (code === 'unconfirmed-date' || code === 'missing-payslip-email') {
    return { to: `/hr/cham-cong/nhan-vien?nv=${encodeURIComponent(employeeId)}`, words: AT_TIMESHEET };
  }
  if (LEVEL_CODES.has(code)) return { to: profileLink(context.search, employeeId, true), words: AT_PROFILE };
  if (PROFILE_CODES.has(code)) return { to: profileLink(context.search, employeeId, false), words: AT_PROFILE };
  return { to: rowLink(context.search, employeeId), words: AT_GRID };
}

/** One line of Rà soát: a warning, or the same yellow warning of several people folded into one (F06). */
export type ReviewRow =
  { kind: 'one'; item: ReviewItem } | { kind: 'group'; code: string; message: string; items: ReviewItem[] };

const sameWarning = (a: ReviewItem, b: ReviewItem) => a.code === b.code && a.message === b.message;

/**
 * The warnings as HR reads them: a yellow warning that several people share word for word is one row with the
 * people behind it, where the first of them stood; red ones are never folded.
 */
export function reviewRows(items: readonly ReviewItem[]): ReviewRow[] {
  const canFold = (i: ReviewItem) => i.level === 'yellow' && i.employeeId !== null;
  return items.flatMap<ReviewRow>((item, index) => {
    if (!canFold(item)) return [{ kind: 'one', item }];
    const same = items.filter((other) => canFold(other) && sameWarning(other, item));
    if (same.length < 2) return [{ kind: 'one', item }];
    const isFirst = items.findIndex((other) => canFold(other) && sameWarning(other, item)) === index;
    return isFirst ? [{ kind: 'group', code: item.code, message: item.message, items: same }] : [];
  });
}

/** What to do about a warning, in one small sentence under it (F07); null when the warning says it already. */
const HINTS: Readonly<Record<string, string>> = {
  'insurance-provisional':
    'Không cần làm gì bây giờ. Sau khi chốt kỳ công tháng sau, web tự tính lại; có chênh sẽ vào Truy lĩnh / truy thu.',
  'closing-unconfirmed': 'Mở Chấm công, xem lại bảng công kỳ này rồi tích Đã xem khi Duyệt.',
  'unconfirmed-date': 'Mở Chấm công › Nhân viên, kiểm tra ngày này, tích "Đã kiểm tra, ngày này đúng" rồi Lưu.',
  'missing-bank-account':
    'Thêm ở Hồ sơ lương › Tài khoản. Không ảnh hưởng số tiền, chỉ thiếu trên Excel và phiếu lương.',
  'missing-payslip-email':
    'Nhập ở Chấm công › Nhân viên, ô Email nhận phiếu lương. Không ảnh hưởng số tiền, chỉ là chưa gửi được phiếu lương.',
  'block-from-person':
    'Không cần làm gì nếu khối ở Chấm công › Nhân viên đã đúng. Lần chốt công sau sẽ ghi khối theo từng kỳ.',
  'leave-overdrawn': 'Chỉ để biết: ngày công (17) đã trừ phần này.',
  'union-fund-off': 'Đang làm như file tháng 10. Muốn đổi: Cấu hình › Bảo hiểm.',
  'contract-commitment': 'Đang làm như file tháng 10. Muốn đổi: Cấu hình › Loại HĐ.',
};

export const reviewHint = (code: string): string | null => HINTS[code] ?? null;
