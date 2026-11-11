import { z } from 'zod';

/** What HR types into a month (spec 2 (4)), checked where it enters the system. */

export const KPI_PERCENT_MAX = 2;

/** L-D08: no % for a person without KPI; 0–200% otherwise. */
export function kpiPercentError(percent: number, kpiAmount: number): string | null {
  if (kpiAmount <= 0) return 'Người này không có KPI, ô % khoá.';
  if (!Number.isFinite(percent) || percent < 0 || percent > KPI_PERCENT_MAX) return 'Nhập % trong khoảng 0–200%.';
  return null;
}

/** L-D09: overtime hours go in steps of half an hour. */
export function overtimeHoursError(hours: number): string | null {
  if (!Number.isFinite(hours) || hours < 0) return 'Nhập số giờ từ 0.';
  return Number.isInteger(hours * 2) ? null : 'Nhập giờ theo bước 0,5.';
}

const reason = z.string().trim().min(1, 'Nhập lý do.').max(200);
const amount = z.number().int('Nhập số đồng.').nonnegative('Số âm: dùng truy thu.');

/** L-D11, L-D12, L-D13: other income needs a reason and a tax choice; support, refund and advance are separate. */
export const monthInputSchema = z.object({
  kpiPercent: z.number().min(0).max(KPI_PERCENT_MAX).nullable(),
  overtimeHours: z
    .number()
    .nonnegative()
    .refine((h) => Number.isInteger(h * 2), 'Nhập giờ theo bước 0,5.'),
  restDays: z.number().nonnegative().nullable(),
  otherIncome: z.array(z.object({ amount, taxable: z.boolean(), reason })),
  support: amount,
  refund: amount,
  advance: amount,
});
export type MonthInput = z.infer<typeof monthInputSchema>;
