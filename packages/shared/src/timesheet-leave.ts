import { z } from 'zod';
import { ATTENDANCE_CODES, daysBetweenInclusive } from './timesheet.js';

/** The leave form's balance hint, and "Nghỉ công ty": one absence for many people at once. */

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ.');
const MAX_DAYS = 366;
const ORDER = { path: ['to'], message: 'Ngày kết thúc phải sau ngày bắt đầu.' };
const AT_MOST_A_YEAR = { path: ['to'], message: 'Tối đa 1 năm.' };
const isInOrder = (a: { from: string; to: string }) => a.from <= a.to;
const isShortEnough = (a: { from: string; to: string }) => a.from > a.to || daysBetweenInclusive(a.from, a.to) <= MAX_DAYS;

/** What the leave form asks while HR fills it: the days and how they count. */
export const leaveBalanceQuerySchema = z
  .object({ from: isoDay, to: isoDay, code: z.enum(ATTENDANCE_CODES, { message: 'Mã không hợp lệ.' }) })
  .refine(isInOrder, ORDER)
  .refine(isShortEnough, AT_MOST_A_YEAR);

/** Annual leave left today, as the sheet counts it; what is left after the absence; and the days it takes beyond that, unpaid. */
export interface LeaveBalanceDto {
  now: number;
  after: number;
  overdrawn: number;
}

/** Who a company day off is for. The people it came to are stored with it; this says how HR chose them. */
export const batchAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('region'), regionIds: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một khu vực.') }),
  z.object({ kind: z.literal('department'), departments: z.array(z.string().trim().min(1)).min(1, 'Chọn ít nhất một bộ phận.') }),
  z.object({
    kind: z.literal('people'),
    employeeIds: z
      .array(z.string().uuid())
      .min(1, 'Chọn ít nhất một người.')
      .max(500, 'Tối đa 500 người.')
      .refine((ids) => new Set(ids).size === ids.length, 'Mỗi người chỉ chọn một lần.'),
  }),
]);
export type BatchAudience = z.output<typeof batchAudienceSchema>;
export type BatchAudienceKind = BatchAudience['kind'];

/** How a company day off can count. Being late is one person's, never a company's. */
export const BATCH_CODES = ['CL', 'P', 'KL', 'TS', 'OM'] as const;

export const absenceBatchInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Nhập tên đợt nghỉ.').max(120),
    reason: z.string().trim().min(1, 'Chọn lý do nghỉ.'),
    code: z.enum(BATCH_CODES, { message: 'Chọn cách tính.' }),
    from: isoDay,
    to: isoDay,
    /** Empty: it waits, and nothing is written on the sheet until someone has approved. */
    approvedBy: z.string().trim().max(80).optional(),
    note: z.string().trim().max(200).optional(),
    audience: batchAudienceSchema,
    /** The version HR edited, so two saves at once cannot both apply. Only on a change. */
    version: z.number().int().min(1).optional(),
  })
  .refine(isInOrder, ORDER)
  .refine(isShortEnough, AT_MOST_A_YEAR);
export type AbsenceBatchInput = z.input<typeof absenceBatchInputSchema>;

export interface AbsenceBatchDto {
  id: string;
  name: string;
  reason: string;
  label: string;
  code: string;
  from: string;
  to: string;
  approvedBy: string | null;
  note: string;
  audience: BatchAudience;
  /** Everyone it came to: one absence each. */
  employeeIds: string[];
  version: number;
  createdBy: string;
  createdAt: string;
}

/** A save, and the people it left out because none of their working days fall in it (a Saturday their region does not work). */
export interface AbsenceBatchSaveDto extends AbsenceBatchDto {
  skipped: { employeeId: string; fullName: string }[];
}
