import type { PayrollCellKey, PayrollLeavePayoutDto, PayrollLineYearDto, PayrollYearPartDto } from '@careers/shared';

/**
 * Tiền phép chưa nghỉ inside (24) (BLLĐ Đ.113 k3) and the tax year's running numbers, in words HR reads; no React.
 */

const money = (n: number) => n.toLocaleString('vi-VN');
const plain = (n: number) => String(n).replace('.', ',');
const dayWords = (d: string) => d.split('-').reverse().join('/');

/** The formula with the row's numbers, then what the row pays and how it is taxed. */
export function leavePayoutLines(p: PayrollLeavePayoutDto): string[] {
  const basis = p.basisOn ? `lương theo HĐ, mức ngày ${dayWords(p.basisOn)}` : 'lương theo HĐ';
  const formula = `${plain(p.days)} ngày phép chưa nghỉ × ${money(p.base)} (${basis}) ÷ ${plain(p.norm)} công chuẩn = ${money(p.computed)}`;
  if (p.typed === 0) return [formula, `Không trả (HR nhập 0, số tính ${money(p.computed)}).`];
  const who = p.typed === null ? 'tự tính' : `HR nhập, số tính ${money(p.computed)}`;
  const taxed = p.amount - p.exempt;
  const tax = taxed > 0 ? `miễn thuế ${money(p.exempt)}, chịu thuế ${money(taxed)}` : 'miễn thuế cả khoản';
  return [formula, `Trả ${money(p.amount)} (${who}), ${tax}.`];
}

const INPUT_ERROR = 'Tiền phép chưa nghỉ: nhập số đồng từ 0, hoặc để trống để web tự tính.';

/** The box of the month input: empty = as the web computes it (null), 0 = pay nothing, else dong. */
export function leavePayoutInput(text: string): { value: number | null } | { error: string } {
  const bare = text.trim();
  if (!bare) return { value: null };
  const amount = Number(bare.replace(/[.\s,đ]/g, ''));
  return Number.isInteger(amount) && amount >= 0 ? { value: amount } : { error: INPUT_ERROR };
}

export interface YearToDateLine {
  label: string;
  kind: 'money' | 'hours';
  /** The tax year before this pay (the opening balance and the earlier pay months). */
  before: number;
  /** What this row adds. */
  month: number;
  total: number;
}

type Part = keyof PayrollYearPartDto;

/** The running numbers each cell reads: (33) the clothing cap, overtime the 200 hours, (40) the commitment estimate. */
const YEAR_PARTS: Partial<Record<PayrollCellKey, readonly { part: Part; label: string; kind: 'money' | 'hours' }[]>> = {
  exempt: [{ part: 'clothingExempt', label: 'Trang phục đã miễn thuế', kind: 'money' }],
  overtimePay: [{ part: 'overtimeHours', label: 'Giờ làm thêm tính vào trần năm', kind: 'hours' }],
  tax: [
    { part: 'taxable', label: 'Thu nhập chịu thuế', kind: 'money' },
    { part: 'insurance', label: 'BH người lao động đã đóng', kind: 'money' },
    { part: 'tax', label: 'Thuế đã khấu trừ', kind: 'money' },
  ],
};

export function yearToDateOf(cell: PayrollCellKey, year: PayrollLineYearDto | undefined): YearToDateLine[] {
  if (!year) return [];
  return (YEAR_PARTS[cell] ?? []).map(({ part, label, kind }) => ({
    label,
    kind,
    before: year.before[part],
    month: year.month[part],
    total: year.before[part] + year.month[part],
  }));
}
