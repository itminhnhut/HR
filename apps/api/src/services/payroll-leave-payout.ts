import {
  leavePayoutOf,
  rat,
  roundDong,
  toNumber,
  type LeavePayout,
  type PayrollConfig,
  type PayrollLeavePayoutDto,
  type PayrollLine,
  type PayrollProfileVersionDto,
  type TimesheetClosingRowDto,
} from '@careers/shared';
import { addDays, levelOn } from './payroll-profile-store.js';

/**
 * Tiền phép chưa nghỉ khi nghỉ việc (spec-luong.md 5.5, D08, câu 18; BLLĐ Đ.113 k3; NĐ 145/2020 Đ.67 k3): someone whose
 * last working day is in the period is paid the leave days left at the timesheet close, on the components flagged
 * "lương theo HĐ" of the level in force on the last day of the period before, ÷ that period's công chuẩn. HR may type
 * the amount over it for the month; the part above what the law exempts is taxable (NĐ 253 Đ.26 k2, k3).
 */

/** What the payout is computed on; null for someone not leaving in the period. */
export interface LeaveBase {
  amounts: Readonly<Record<string, number>>;
  norm: number;
  /** The day whose level is read. */
  basisOn: string;
}

type Leaver = Pick<TimesheetClosingRowDto, 'leftOn' | 'norm'>;

/**
 * The base of someone whose last working day is in the period: the level of the last day of the period before (the
 * level of the leaving day for someone who had none then) and the norm of the period before (`previousNorm`; this
 * period's when the web has no close of it).
 */
export function leaveBaseOf(
  row: Leaver,
  levels: readonly PayrollProfileVersionDto[],
  period: { from: string; to: string },
  previousNorm: number | undefined,
): LeaveBase | null {
  const { leftOn } = row;
  if (!leftOn || leftOn < period.from || leftOn > period.to) return null;
  const dayBefore = addDays(period.from, -1);
  const before = levelOn(levels, dayBefore);
  const level = before ?? levelOn(levels, leftOn);
  if (!level) return null;
  const norm = before && previousNorm ? previousNorm : row.norm;
  return { amounts: level.amounts, norm, basisOn: before ? dayBefore : leftOn };
}

export interface LeaveItem {
  /** What the engine reads as `income.leavePayout`. */
  input: LeavePayout;
  days: number;
  base: number;
  norm: number;
  basisOn: string | null;
  computed: number;
  typed: number | null;
}

interface LeaveItemArgs {
  /** Leave days left at the close. */
  days: number;
  base: LeaveBase | null;
  config: PayrollConfig;
  /** HR's amount for the month; null: as computed. */
  typed: number | null;
}

const NOTHING: LeavePayout = { amount: 0, exempt: 0 };

/** The payout of one row, or null when the person is not leaving in the period and HR typed none. */
export function leaveItemOf({ days, base, config, typed }: LeaveItemArgs): LeaveItem | null {
  if (!base && typed === null) return null;
  const usable = base && base.norm > 0 ? base : null;
  const auto = usable
    ? leavePayoutOf({
        previousAmounts: usable.amounts,
        previousNorm: usable.norm,
        days,
        components: config.components,
      })
    : NOTHING;
  const contractPay = config.components
    .filter((c) => c.contractPay)
    .reduce((total, c) => total + (usable?.amounts[c.id] ?? 0), 0);
  const basis = { days: usable ? days : 0, base: contractPay, norm: usable?.norm ?? 0 };
  const item = { ...basis, basisOn: usable?.basisOn ?? null, computed: roundDong(auto.amount), typed };
  if (typed === null) return { ...item, input: { ...auto, basis } };
  return { ...item, input: { amount: typed, exempt: Math.min(typed, toNumber(rat(auto.exempt))), typed: true } };
}

/** The item as the row shows it: what was paid, and the part of it the month's D08 leaves untaxed. */
export function leavePayoutDtoOf(item: LeaveItem, line: PayrollLine, config: PayrollConfig): PayrollLeavePayoutDto {
  const { input: _input, ...shown } = item;
  const amount = roundDong(line.income.leavePayout);
  const exempt =
    config.options.leavePayout === 'exempt' ? Math.min(amount, roundDong(line.income.leavePayoutExempt)) : 0;
  return { ...shown, amount, exempt };
}
