import { z } from 'zod';
import type { kpiLevelFor, ProfileVersion } from './payroll/index.js';
import { PAYROLL_DATE, PAYROLL_MONTH, type PayrollSettingDto } from './payroll-settings.js';
import type { EmployeeBlock, StaffType } from './timesheet.js';

/**
 * Hồ sơ lương (spec-luong.md 10.2, 11.5, 17.2). Pay levels go by the date they take effect, dependants by month,
 * a tax commitment by tax year, the bank account by the day it changed.
 * A level is read by the engine as a `ProfileVersion` ({ from: effectiveOn, amounts }) and its KPI 100% as one of
 * `kpiLevelFor`'s levels; amounts are keyed by the engine's component id (`khoan.danh-sach`).
 */

const money = z.number({ message: 'Nhập số tiền.' }).int('Số tiền là số đồng.').nonnegative('Số tiền không âm.');
const day = z.string().regex(PAYROLL_DATE, 'Chọn ngày.');
const month = z.string().regex(PAYROLL_MONTH, 'Chọn tháng.');
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Mã không hợp lệ.');

/**
 * Spec 17.2: until HR sets a contract type, Thử việc means a separate probation contract and Chính thức an
 * open-ended labour contract (the engine's default contract type ids).
 */
export const PAYROLL_DEFAULT_CONTRACT: Record<StaffType, string> = {
  probation: 'thu-viec',
  official: 'khong-thoi-han',
};

/** A pay level from a date. `fromMonth` "YYYY-MM" saves the first day of that payroll month (26 of the month before). */
export const payrollProfileVersionSchema = z
  .object({
    effectiveOn: day.optional(),
    fromMonth: month.optional(),
    contractTypeId: slug,
    /** Null: the contract type's default. */
    probationDays: z.number().int().min(0).max(365).nullish(),
    /** "Việc quản lý doanh nghiệp": the 180-day probation limit of BLLĐ Đ.25. */
    managesBusiness: z.boolean().default(false),
    unionMember: z.boolean().default(false),
    /** KPI 100%. */
    kpiAmount: money.default(0),
    amounts: z.record(slug, money).default({}),
  })
  .refine((v) => !!v.effectiveOn !== !!v.fromMonth, {
    path: ['effectiveOn'],
    message: 'Chọn ngày hiệu lực hoặc tháng.',
  });
export type PayrollProfileVersionInput = z.input<typeof payrollProfileVersionSchema>;

export interface PayrollProfileVersionDto {
  id: string;
  effectiveOn: string;
  contractTypeId: string;
  probationDays: number | null;
  managesBusiness: boolean;
  unionMember: boolean;
  kpiAmount: number;
  amounts: Record<string, number>;
  createdBy: string;
  createdAt: string;
}

/** A level as the engine's `ProfileVersion`, with the contract type it was on. */
export type PayrollProfileVersion = ProfileVersion & { contractTypeId: string; amounts: Record<string, number> };
/** One KPI 100% level of `kpiLevelFor`. */
export type PayrollKpiLevel = Parameters<typeof kpiLevelFor>[0][number];

type StoredLevel = Pick<PayrollProfileVersionDto, 'effectiveOn' | 'contractTypeId' | 'amounts'>;

export const payrollProfileVersionOf = (level: StoredLevel): PayrollProfileVersion => ({
  from: level.effectiveOn,
  contractTypeId: level.contractTypeId,
  amounts: level.amounts,
});

export const payrollKpiLevelOf = (
  level: Pick<PayrollProfileVersionDto, 'effectiveOn' | 'kpiAmount'>,
): PayrollKpiLevel => ({
  from: level.effectiveOn,
  amount: level.kpiAmount,
});

export interface PayrollProfileVersionSavedDto {
  version: PayrollProfileVersionDto;
  /** E.g. days with work before the first level, or a salary under the regional minimum (L-B03, L-B12). */
  warnings: string[];
  /** The payroll month split in two by this date, when it is not the first day of a period (L-B06). */
  splitsMonth: string | null;
  approvedMonthsTouched: string[];
}

export const payrollDependantSchema = z
  .object({
    fromMonth: month,
    toMonth: month.nullish(),
    count: z.number().int().min(1, 'Ít nhất 1 người.').max(20),
  })
  .refine((v) => !v.toMonth || v.toMonth >= v.fromMonth, { path: ['toMonth'], message: 'Đến tháng trước từ tháng.' });

export interface PayrollDependantDto {
  id: string;
  fromMonth: string;
  toMonth: string | null;
  count: number;
}

export const payrollCommitmentSchema = z
  .object({ year: z.number().int().min(2000).max(2100), signedOn: day })
  .refine((v) => Number(v.signedOn.slice(0, 4)) <= v.year, {
    path: ['signedOn'],
    message: 'Ngày ký sau năm cam kết.',
  });

export interface PayrollCommitmentDto {
  id: string;
  year: number;
  signedOn: string;
}

/** (32) with a typed amount (câu 4): support is taxable and a cost; refund and advance are neither. */
export const PAYROLL_CASH_KINDS = ['support', 'refund', 'advance'] as const;
export type PayrollCashKind = (typeof PAYROLL_CASH_KINDS)[number];

/**
 * "Công ty trả thay BH": the company pays the employee's own insurance back. No typed amount: each month it is that
 * month's (28) + (29) + (30). As HR's October file it is neither taxed nor a cost, until "Tính thuế" is on.
 */
export const PAYROLL_INSURANCE_PAID = 'insurance-paid' as const;

/** Khoản (32) định kỳ of a profile: the typed kinds and the insurance paid back. */
export const PAYROLL_RECURRING_KINDS = [...PAYROLL_CASH_KINDS, PAYROLL_INSURANCE_PAID] as const;
export type PayrollRecurringKind = (typeof PAYROLL_RECURRING_KINDS)[number];

export const payrollRecurringSchema = z
  .object({
    kind: z.enum(PAYROLL_RECURRING_KINDS).default('support'),
    amount: money.default(0),
    /** "Tính thuế" of the insurance paid back; the other kinds are taxed by their kind. */
    taxable: z.boolean().default(false),
    fromMonth: month,
    toMonth: month.nullish(),
    note: z.string().trim().max(200).default(''),
  })
  .refine((v) => !v.toMonth || v.toMonth >= v.fromMonth, { path: ['toMonth'], message: 'Đến tháng trước từ tháng.' })
  .refine((v) => v.kind === PAYROLL_INSURANCE_PAID || v.amount >= 1, { path: ['amount'], message: 'Nhập số tiền.' })
  .transform((v) => (v.kind === PAYROLL_INSURANCE_PAID ? { ...v, amount: 0 } : { ...v, taxable: false }));

export interface PayrollRecurringDto {
  id: string;
  kind: PayrollRecurringKind;
  /** 0 for the insurance paid back: the engine computes it each month. */
  amount: number;
  /** "Tính thuế" of the insurance paid back; false on the other kinds. */
  taxable: boolean;
  fromMonth: string;
  toMonth: string | null;
  note: string;
}

/** A bank account number: digits only, spaces ignored. */
export const payrollBankSchema = z.object({
  bank: z.string().trim().min(1, 'Nhập ngân hàng.').max(100),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\d{6,19}$/, 'Số tài khoản gồm 6–19 chữ số.')),
  payslipEmail: z.string().trim().email('Email không hợp lệ.').nullish(),
  changedOn: day,
});
export type PayrollBankInput = z.input<typeof payrollBankSchema>;

/** Never the full number: the last four digits only (spec 10.2, 11.5). */
export interface PayrollBankAccountDto {
  id: string;
  bank: string;
  last4: string;
  payslipEmail: string | null;
  changedOn: string;
}

/** Số dư đầu năm thuế (câu 34, L-E07): every pay in the tax year before the first one on the web, by pay date. */
export const payrollOpeningSchema = z.object({
  taxableIncome: money.default(0),
  taxWithheld: money.default(0),
  overtimeHours: z
    .number()
    .min(0)
    .max(1000)
    .refine((v) => Number.isInteger(v * 2), 'Giờ làm thêm theo nửa giờ.')
    .default(0),
  clothingPaid: money.default(0),
  monthsPaid: z.number().int().min(0).max(13).default(0),
});

export interface PayrollOpeningDto {
  taxYear: number;
  taxableIncome: number;
  taxWithheld: number;
  overtimeHours: number;
  clothingPaid: number;
  monthsPaid: number;
}

export interface PayrollPersonDto {
  employeeId: string;
  code: string;
  fullName: string;
  employment: StaffType;
  block: EmployeeBlock | null;
  joinedOn: string | null;
  leftOn: string | null;
}

export interface PayrollProfileListDto {
  people: (PayrollPersonDto & { hasProfile: boolean; hasOverrides: boolean })[];
  /** "NV13 có trong Chấm công từ 03/11, chưa có hồ sơ" (L-B01). */
  missing: PayrollPersonDto[];
}

export interface PayrollProfileDto {
  person: PayrollPersonDto;
  /** The first day without work: the day after the last day (L-B13). */
  leavingFrom: string | null;
  versions: PayrollProfileVersionDto[];
  dependants: PayrollDependantDto[];
  commitments: PayrollCommitmentDto[];
  recurring: PayrollRecurringDto[];
  /** Newest first. */
  bankAccounts: PayrollBankAccountDto[];
  openings: PayrollOpeningDto[];
  /** This person's own configuration rows (spec 11.5 "cấu hình riêng"). */
  overrides: PayrollSettingDto[];
}

/** What "Tạo hồ sơ" fills in (L-B01): levels from the pay components, from the day they joined. */
export interface PayrollProfilePrefillDto {
  effectiveOn: string | null;
  contractTypeId: string;
  probationDays: number | null;
  amounts: Record<string, number>;
  /** Joined + probation days, a suggestion HR must confirm (câu 33, 35; L-B15). */
  suggestedOfficialOn: string | null;
}

/** What a payroll month reads from the profile, each on its own reference date (R2). */
export interface PayrollProfileMonthDto {
  month: string;
  payDate: string;
  /** The levels in force during the period, as the engine's `ProfileVersion`s. */
  versions: PayrollProfileVersion[];
  kpiLevels: PayrollKpiLevel[];
  /** On day 1 of the insurance month (L-B22). */
  unionMember: boolean;
  /** On the pay date (L-B18, L-B20). */
  dependants: number;
  /** Signed on or before the pay date, for its tax year (L-B21). */
  hasCommitment: boolean;
  /** The day that commitment was signed; null without one. */
  commitmentSignedOn: string | null;
  /** The latest tax year, up to the pay date's, with a signed commitment; null without any. */
  lastCommitmentYear: number | null;
  recurring: PayrollRecurringDto[];
  opening: PayrollOpeningDto | null;
}
