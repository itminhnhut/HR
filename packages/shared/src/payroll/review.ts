import { ROW_CHECKS, type ReviewItem, type ReviewRowInput } from './review-checks.js';

export {
  leavePayDeadline,
  type ReviewCell,
  type ReviewItem,
  type ReviewLevel,
  type ReviewRowInput,
} from './review-checks.js';

/** Rà soát of one payroll month (spec 11.3): warnings, red ones first; it never blocks (spec 4.8). */

export interface ReviewMonthInput {
  rows: readonly ReviewRowInput[];
  /** R9: the month before is still a draft. */
  previousMonthDraft: boolean;
  /** R6: retroactive changes waiting for HR to choose (a), (b) or (c). */
  retroPending: number;
  /** T11/2026 here: the first month paid on the web (spec 4.21). */
  firstWebMonth: boolean;
  /** HR confirmed the timesheet closing this first month uses. */
  closingConfirmed: boolean;
  /** Items of the checklist before the first month (spec 17.2) not confirmed yet. */
  checklistPending?: number;
  /**
   * Earlier pay months of the same tax year not approved: "MM" and whether the yearly figures read its draft, found
   * no payroll yet (the timesheet is not closed), or read an approval kept before the yearly figures were (R9).
   */
  yearOpenMonths?: readonly { month: string; state: 'draft' | 'waiting' | 'partial' }[];
  /** R6 (a): the approved months, "MM", this month receives truy lĩnh / truy thu from. */
  retroFrom?: readonly string[];
}

const YEAR_OPEN_WORDS = {
  draft: 'chưa duyệt — số cộng dồn năm đang lấy bản nháp',
  waiting: 'chưa có bảng lương — số cộng dồn năm chưa gồm tháng này',
  partial: 'duyệt trước khi web ghi số cộng dồn — trang phục đã miễn và ngày làm thêm của tháng này chưa được cộng',
} as const;

function monthItems(month: ReviewMonthInput): ReviewItem[] {
  const item = (level: ReviewItem['level'], code: string, message: string): ReviewItem => ({
    level,
    code,
    employeeId: null,
    cell: null,
    message,
  });
  const unionFundOff = month.rows[0]?.config.options.unionFund === 'off';
  const onContract = month.rows.filter(
    ({ line }) => line?.tax.method === 'none' && line.tax.commitmentSource === 'contract',
  ).length;
  return [
    ...(unionFundOff
      ? [
          item(
            'yellow',
            'union-fund-off',
            'KPCĐ đang tắt: Luật Công đoàn 2024 Đ.29 quy định doanh nghiệp đóng 2% quỹ lương đóng BHXH',
          ),
        ]
      : []),
    ...(onContract > 0
      ? [
          item(
            'yellow',
            'contract-commitment',
            `${onContract} người không bị khấu trừ 10% nhờ cam kết thuế kèm hợp đồng — cam kết chỉ hợp lệ khi thu nhập ước tính cả năm sau giảm trừ gia cảnh chưa đến mức phải nộp thuế và người đó có mã số thuế (NĐ 253/2026 Đ.50 k2)`,
          ),
        ]
      : []),
    ...(month.firstWebMonth && !month.closingConfirmed
      ? [item('red', 'closing-unconfirmed', 'Tháng đầu trên web: xác nhận lại lần chốt kỳ công')]
      : []),
    ...(month.firstWebMonth && (month.checklistPending ?? 0) > 0
      ? [
          item(
            'red',
            'checklist-pending',
            `Danh sách kiểm trước tháng lương đầu còn ${month.checklistPending} mục chưa xác nhận`,
          ),
        ]
      : []),
    ...(month.previousMonthDraft
      ? [item('yellow', 'previous-month-draft', 'Tháng trước còn nháp; số cộng dồn năm dùng nháp')]
      : []),
    ...(month.yearOpenMonths ?? []).map((m) =>
      item('yellow', 'year-open-month', `Tháng ${m.month} ${YEAR_OPEN_WORDS[m.state]}`),
    ),
    ...(month.retroFrom ?? []).map((m) => item('yellow', 'retro-carried', `Có truy lĩnh/truy thu từ tháng ${m}`)),
    ...(month.retroPending > 0
      ? [item('yellow', 'retro-pending', `Có ${month.retroPending} hồi tố chưa chọn cách`)]
      : []),
  ];
}

export function reviewPayroll(month: ReviewMonthInput): ReviewItem[] {
  const rows = month.rows.flatMap((row) => {
    // The first month on the web has no approved month before it to compare with (L-D33).
    const input = month.firstWebMonth ? { ...row, previous: null } : row;
    return ROW_CHECKS.flatMap((check) => check(input).map((item) => ({ ...item, employeeId: row.employeeId })));
  });
  const all = [...rows, ...monthItems(month)];
  return [...all.filter((i) => i.level === 'red'), ...all.filter((i) => i.level === 'yellow')];
}

/** Duyệt asks for "Đã xem" while a red warning is left (spec 4.8, 11.4). */
export const needsAcknowledgement = (items: readonly ReviewItem[]): boolean => items.some((i) => i.level === 'red');
