import type { TimesheetPeriodRange } from '../timesheet.js';
import type { PayrollConfig } from './config.js';
import { DEFAULT_COMPONENTS, type PayComponent } from './defaults-company.js';
import { div, mul, sum, ZERO } from './rational.js';
import type { LeavePayout } from './income.js';

/** Values the web fills in before HR looks: Sunday work, the KPI level, unused leave pay. */

/**
 * D12 (spec 5.3): rest-day work outside (17) = MIN(Sundays worked, overtime days), paid 200%; the other Sundays are
 * already in (17) and get 100% more, so every Sunday is paid 200% in all. "swap-day": those Sundays get nothing more.
 */
export function restDayPrefill(
  totals: { sundayWorked?: number; overtime: number },
  option: PayrollConfig['options']['sundayWork'],
): { restDays: number; sundayInPaid: number } {
  const sundays = totals.sundayWorked ?? 0;
  const restDays = Math.min(sundays, totals.overtime);
  return { restDays, sundayInPaid: option === 'total-200' ? sundays - restDays : 0 };
}

/** The KPI level of the last day of the period, or of the leaving day if earlier (spec 5.6, câu 24). */
export function kpiLevelFor(
  levels: readonly { from: string; amount: number }[],
  period: TimesheetPeriodRange,
  leftOn: string | null,
): number {
  const day = leftOn && leftOn < period.to ? leftOn : period.to;
  const inForce = levels.filter((l) => l.from <= day).sort((a, b) => b.from.localeCompare(a.from));
  return inForce[0]?.amount ?? 0;
}

/** The components the law counts as pay under the contract (BLLĐ Đ.90 k1; TT 10/2020 Đ.3 k5): the default flags. */
const isLawContractPay = (c: PayComponent) => DEFAULT_COMPONENTS.some((d) => d.id === c.id && d.contractPay);

/**
 * Unused leave paid on leaving (BLLĐ Đ.113 k3, NĐ 145/2020 Đ.67 k3, D08): the components flagged "lương theo HĐ" in
 * the profile of the last day of the month before, ÷ that period's norm × the days left. Exempt within the law's
 * base (NĐ 253 Đ.26 k2); a component HR adds to the base makes the excess taxable (Đ.26 k3).
 */
export function leavePayoutOf(args: {
  previousAmounts: Readonly<Record<string, number>>;
  previousNorm: number;
  days: number;
  components: readonly PayComponent[];
}): LeavePayout {
  if (args.days <= 0) return { amount: ZERO, exempt: ZERO };
  const base = (keep: (c: PayComponent) => boolean) =>
    mul(
      div(sum(args.components.filter(keep).map((c) => args.previousAmounts[c.id] ?? 0)), args.previousNorm),
      args.days,
    );
  return { amount: base((c) => c.contractPay), exempt: base((c) => c.contractPay && isLawContractPay(c)) };
}
