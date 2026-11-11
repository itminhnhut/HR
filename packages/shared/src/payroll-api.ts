import { z } from 'zod';
import type {
  PayrollCellExplains,
  PayrollCellKey,
  PayrollPersonSetting,
  ReviewItem,
  SettingRow,
  TaxMethod,
} from './payroll/index.js';
import { KPI_PERCENT_MAX } from './payroll/inputs.js';
import { PAYROLL_CASH_KINDS, type PayrollCashKind } from './payroll-profile.js';
import type { RegionTone } from './timesheet.js';

/** What the payroll API shares with the web, apart from the engine (spec-luong.md 2 (1), 10.2, 11.9). */

/** The groups of the payroll log, as the address filter `?nhom=` names them. */
export const PAYROLL_LOG_AREAS = ['bang-luong', 'ho-so', 'cau-hinh', 'tai-xem', 'quyen', 'cham-cong'] as const;
export type PayrollLogArea = (typeof PAYROLL_LOG_AREAS)[number];

/** What the signed-in HR may do in Lương. Someone without Xem, sửa gets 403 instead. */
export interface PayrollAccessDto {
  canPayroll: true;
  canApprovePayroll: boolean;
}

/** One HR account and its payroll rights, for the Tài khoản HR page. */
export interface PayrollRightsDto {
  userId: string;
  email: string;
  name: string | null;
  canPayroll: boolean;
  canApprovePayroll: boolean;
  isMe: boolean;
}

export const payrollRightsSchema = z
  .object({ canPayroll: z.boolean(), canApprovePayroll: z.boolean() })
  .refine((v) => v.canPayroll || !v.canApprovePayroll, {
    path: ['canApprovePayroll'],
    message: 'Duyệt lương cần có quyền Xem, sửa lương.',
  });
export type PayrollRightsInput = z.input<typeof payrollRightsSchema>;

export interface PayrollLogLineDto {
  id: string;
  area: PayrollLogArea;
  actor: string;
  action: string;
  detail: string;
  /** The payroll month it touches, "YYYY-MM". */
  month: string | null;
  at: string;
}

/** `?loai=duyet` of the log: the steps that freeze, reopen or pay a month. */
export const PAYROLL_LOG_APPROVAL_ACTIONS = ['Duyệt', 'Mở lại', 'Đã chuyển khoản'] as const;

export interface PayrollLogPageDto {
  lines: PayrollLogLineDto[];
  hasMore: boolean;
  /** Everyone who has written a line, whatever the filter: the choices of "Người làm". */
  actors: string[];
}

/** A payroll month: Chờ chốt công, Nháp, Đã duyệt, Đã chuyển khoản (spec-luong.md 10.2). */
export const PAYROLL_PERIOD_STATUSES = ['waiting', 'draft', 'approved', 'paid'] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];

/**
 * Items of the check before the first payroll month (spec-luong.md 17.2). `lan-chot-ky-cong`: a close of a timesheet
 * period made before closes were kept (4.21), e.g. by a script under an HR name. The others are facts about one
 * person; `ngay` (dates joined, official, left) is confirmed in Chấm công and only read here.
 */
export const PAYROLL_PERSON_CHECK_ITEMS = [
  'loai-hd',
  'thu-viec',
  'ngay',
  'cam-ket-thue',
  'nguoi-phu-thuoc',
  'doan-vien',
  'khoan-32',
  'muc-dien-thoai-trang-phuc',
  'so-du-dau-nam',
] as const;
export type PayrollPersonCheckItem = (typeof PAYROLL_PERSON_CHECK_ITEMS)[number];
export const PAYROLL_FIRST_MONTH_ITEMS = ['lan-chot-ky-cong', ...PAYROLL_PERSON_CHECK_ITEMS] as const;
export type PayrollFirstMonthItem = (typeof PAYROLL_FIRST_MONTH_ITEMS)[number];

export const payrollFirstMonthCheckSchema = z.object({
  item: z.enum(PAYROLL_FIRST_MONTH_ITEMS, { message: 'Không có mục kiểm này.' }),
  employeeId: z.string().uuid().nullish(),
  closingId: z.string().uuid().nullish(),
  confirmed: z.boolean(),
});
export type PayrollFirstMonthCheckInput = z.input<typeof payrollFirstMonthCheckSchema>;

export interface PayrollFirstMonthCheckDto {
  id: string;
  item: PayrollFirstMonthItem;
  employeeId: string | null;
  closingId: string | null;
  confirmed: boolean;
  confirmedAt: string;
  confirmedBy: string;
}

/** Red must be checked before approving; yellow is a warning (spec 11.3). */
export type PayrollCheckLevel = 'red' | 'yellow';

/** One fact of one person, as the web uses it now: the default while HR has not entered one (17.2). */
export interface PayrollPersonCheckDto {
  item: PayrollPersonCheckItem;
  /** In words, e.g. "HĐ thử việc (mặc định theo loại NV Thử việc)". */
  value: string;
  isDefault: boolean;
  confirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  /** Null once confirmed. */
  level: PayrollCheckLevel | null;
}

export interface PayrollChecklistDto {
  /** The first payroll month on the web, "YYYY-MM". */
  month: string;
  people: { employeeId: string; code: string; fullName: string; items: PayrollPersonCheckDto[] }[];
  /** Items not confirmed yet, for "Danh sách kiểm (n mục chưa xác nhận)". */
  unconfirmed: number;
}

/** A cell HR typed over the computed number, for this month only (spec 6.3). */
export interface PayrollOverrideDto {
  cell: PayrollCellKey;
  computed: number;
  typed: number;
  reason: string;
  by: string;
  at: string;
}

/**
 * The figures of one pay that count against a yearly limit or estimate (spec R9, 5.3 (33), 5.5, câu 34): clothing pay
 * exempted (cap a year), overtime hours counted (200 a year), taxable income (34), tax withheld (40) and the
 * employee's insurance (37).
 */
export interface PayrollYearPartDto {
  clothingExempt: number;
  overtimeHours: number;
  taxable: number;
  tax: number;
  insurance: number;
}

export const EMPTY_YEAR_PART: PayrollYearPartDto = {
  clothingExempt: 0,
  overtimeHours: 0,
  taxable: 0,
  tax: 0,
  insurance: 0,
};

/**
 * `before`: the opening balance of the tax year plus the earlier pay months of that year, as the engine read it for
 * this row. `month`: what this row adds; a later month of the year sums it from the approval snapshot.
 */
export interface PayrollLineYearDto {
  before: PayrollYearPartDto;
  month: PayrollYearPartDto;
}

/**
 * Tiền phép chưa nghỉ of someone whose last working day is in the period (spec 5.5, D08; BLLĐ Đ.113 k3): its own line
 * of (24). `computed` = `days` × `base` ÷ `norm`; `typed` is HR's amount over it (null: as computed).
 */
export interface PayrollLeavePayoutDto {
  /** Leave days left at the timesheet close (`leaveClosing`); 0 when the person is not leaving in the period. */
  days: number;
  /** Σ of the components flagged "lương theo HĐ", from the level in force on `basisOn`. */
  base: number;
  /** Công chuẩn of the period before; this period's when the web has no close of it. */
  norm: number;
  /** The day whose level is read: the last day of the period before, or the leaving day when no level was in force. */
  basisOn: string | null;
  computed: number;
  typed: number | null;
  /** What the row pays. */
  amount: number;
  /** The part of it exempt from tax (NĐ 253 Đ.26 k2): within the law's base for the days left; the rest is taxable. */
  exempt: number;
}

/** A line of the payroll log behind an adjustment: what was changed after the approval, by whom and when. */
export interface PayrollRetroCauseDto {
  area: PayrollLogArea;
  action: string;
  detail: string;
  by: string;
  at: string;
}

/**
 * Truy lĩnh / truy thu (spec R6 (a), 11.4; step 17): what an approved month would compute differently now, carried to
 * the next open month for one person. `cells`: the month computed again minus its approval, cell by cell, less what
 * approved months in between already carried; only the cells that differ. `computed` is its (42). Carried as it
 * is, every cell of the receiving row moves by `cells`; an amount HR typed (`typed`, 0: left out) goes to (32)
 * alone, outside tax and insurance.
 */
export interface PayrollRetroItemDto {
  employeeId: string;
  code: string;
  fullName: string;
  /** The approved month it comes from, "YYYY-MM", and the approval it is measured against. */
  origin: string;
  originApproval: number | null;
  cells: Partial<Record<PayrollCellKey, number>>;
  computed: number;
  typed: number | null;
  /** HR's reason for the typed amount; empty when not typed. */
  reason: string;
  /** What the receiving row's (42) moves by. */
  amount: number;
  /** False when the person has no computed row in the receiving month: nothing is paid, HR handles it. */
  placed: boolean;
  causes: PayrollRetroCauseDto[];
}

/** An approved month that computes differently now: where the difference goes (spec R6). */
export interface PayrollRetroOutDto {
  /** The next open month, "YYYY-MM". */
  month: string;
  people: number;
  /** Σ of the differences of (42). */
  net: number;
}

/** The version of the payroll formulas a month was computed with, printed on "Tham số áp dụng" (R8). */
export const PAYROLL_FORMULA_VERSION = 'luong-2026.11';

/**
 * What HR's payroll sheet and the payslip print of a person beyond the grid (spec 12.1, 11.7), as the month has it:
 * kept in the approval snapshot from 11/11/2026 on. In `GET /months/:YYYY-MM` the account is masked ("••••1234");
 * only `POST /export` carries the whole number.
 */
export interface PayrollLineSheetDto {
  /** (4) Chức danh, from the timesheet close. */
  title: string;
  /** (7) Số người phụ thuộc on the pay date. */
  dependants: number;
  /** How (40) was withheld; null on a row without a profile. */
  taxMethod: TaxMethod | null;
  /** What was paid of each pay component this month, by component id, in whole dong. */
  paid: Record<string, number>;
  /** The periods of a month split on a new level or the official day (spec 5.6); absent when not split. */
  segments?: { from: string; to: string; amounts: Record<string, number> }[];
  /** (49) Email nhận phiếu lương of the person (Chấm công › Nhân viên); null when none. */
  payslipEmail: string | null;
  /** (51) */
  bankName: string | null;
  /** (50): "••••1234" in the month response, the whole number in the export only; null without an account. */
  bankAccount: string | null;
}

/** One row of the payroll month, in D13 order. Money is whole dong; (19) is a fraction (0,8 for 80%). */
export interface PayrollLineDto {
  employeeId: string;
  code: string;
  fullName: string;
  department: string;
  regionId: string;
  /** Empty for someone in the close without a profile. */
  contractTypeId: string;
  block: 'BO' | 'KD' | null;
  /**
   * The close had no block, so `block` is the person's of today (Chấm công › Nhân viên); absent otherwise. It marks
   * the Khối cell only: it is no longer written into `note`, which goes to the Excel file and the payslip.
   */
  blockFromPerson?: boolean;
  probation: boolean;
  /** Công chuẩn of the person's region for the period. */
  norm: number;
  /** Monthly amount of each pay component (group A), by component id. */
  amounts: Record<string, number>;
  /** KPI 100% (15). */
  kpiAmount: number;
  cells: Record<PayrollCellKey, number>;
  /** The tooltip of each cell: formula with the real numbers, the versions used (Q6, Q7). */
  explain: PayrollCellExplains;
  overrides: PayrollOverrideDto[];
  /** The person's own settings in force this month (spec 4.6). */
  personSettings: PayrollPersonSetting[];
  /** Ghi chú: insurance status, tax method; "Chưa có hồ sơ lương" for a zero row. */
  note: string;
  /** What HR typed for this person this month (spec 2 (4), 5.3 (19), (21)–(24), (32)). */
  inputs: PayrollMonthInputsDto;
  /** Số cộng dồn năm thuế; absent on a zero row and on a snapshot approved before the web kept it. */
  year?: PayrollLineYearDto;
  /** Tiền phép chưa nghỉ in (24); null or absent when the person is not leaving and HR typed none. */
  leavePayout?: PayrollLeavePayoutDto | null;
  /** Σ of the truy lĩnh / truy thu inside this row's (42) (`PayrollMonthDto.retro`); absent or 0: none. */
  retroNet?: number;
  /** Absent on a snapshot approved before the web kept it; `POST /export` then fills it with today's values. */
  sheet?: PayrollLineSheetDto;
}

/** `GET /api/hr/payroll/months/:YYYY-MM` (spec 10.2, 11.2): the month as the engine computes it. */
export interface PayrollMonthDto {
  year: number;
  month: number;
  /** "YYYY-MM", the `?ky=` of the address. */
  monthKey: string;
  period: { from: string; to: string };
  payDate: string;
  status: PayrollPeriodStatus;
  /** Last "Tính lại" of a draft: a draft is computed whenever it is opened (R3). */
  computedAt: string | null;
  approval: { no: number; at: string; by: string } | null;
  paidOn: string | null;
  /** Pay components of this month, in column order (group A). */
  components: { id: string; name: string }[];
  regions: { id: string; name: string; tone: RegionTone }[];
  /** `stopped`: "Ngừng dùng" by this month — kept for the people on it, not offered for a new pay level. */
  contractTypes: { id: string; name: string; stopped?: boolean }[];
  lines: PayrollLineDto[];
  /** The total row (D01): Σ of the cells in the month's rounding. */
  totals: Partial<Record<PayrollCellKey, number>>;
  /** Rà soát (spec 11.3): the engine's warnings for the month, red first; empty while waiting. */
  review: ReviewItem[];
  /** Truy lĩnh / truy thu this month receives from approved months; kept in the approval snapshot. */
  retro?: PayrollRetroItemDto[];
  /** Only on an approved or paid month read now: it computes differently, the difference goes to `month`. */
  retroOut?: PayrollRetroOutDto | null;
  /** Lần chốt kỳ công the month reads; null while waiting, absent on a snapshot approved before the web kept it. */
  closingNo?: number | null;
  /** `PAYROLL_FORMULA_VERSION` when the month was computed; absent on an older snapshot. */
  formulaVersion?: string;
}

/** What a download is: the payroll workbook, or payslips. */
export const PAYROLL_EXPORT_KINDS = ['payroll', 'payslips'] as const;
export type PayrollExportKind = (typeof PAYROLL_EXPORT_KINDS)[number];

/**
 * `POST /api/hr/payroll/export` (spec 12.1, 11.7; L-F06): the months of one download, oldest first in the answer.
 * `employeeIds`: only these people (payslips of some); absent: everyone of each month.
 */
export const payrollExportSchema = z.object({
  months: z
    .array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng dạng YYYY-MM.'))
    .min(1, 'Chọn ít nhất một tháng.')
    .max(12, 'Mỗi lần tải nhiều nhất 12 tháng.'),
  employeeIds: z.array(z.string().uuid()).min(1, 'Chọn ít nhất một người.').optional(),
  kind: z.enum(PAYROLL_EXPORT_KINDS, { message: 'Chọn loại file.' }),
});
export type PayrollExportRequest = z.input<typeof payrollExportSchema>;

/** One month of a download: an approved or paid month is its approval snapshot, a draft is computed now. */
export interface PayrollExportMonthDto {
  /**
   * The month as `GET /months/:YYYY-MM` answers it, with only the people asked for, and on every line `sheet` filled:
   * `sheet.bankAccount` is the WHOLE account number here. `totals` stays the whole month's total row.
   */
  month: PayrollMonthDto;
  /**
   * How many people the whole month has. More than `month.lines` when only some were asked for: the file then says
   * "Đã lọc: n/N người" and totals its own rows, so a partial file is never read as the full payroll.
   */
  peopleTotal: number;
  closingNo: number | null;
  formulaVersion: string;
  /** Every configuration row the month resolves its settings from (`payrollConfigFor(settings, null, dates)`). */
  settings: SettingRow[];
  /** Lines to print on "Tham số áp dụng": e.g. settings read by the month's dates, not kept at the approval. */
  notes: string[];
}

export interface PayrollExportDto {
  kind: PayrollExportKind;
  months: PayrollExportMonthDto[];
}

/** HR's amount over one adjustment of the month (0: left out); the reason is required. */
export interface PayrollRetroInputDto {
  origin: string;
  amount: number;
  reason: string;
  /**
   * Set by the API on save: typed over a difference the web computed (not added by hand). Once that difference is
   * gone the amount is not paid (no double payment); absent on an amount added by hand, or saved before this was kept.
   */
  overComputed?: boolean;
}

/** (24) Thu nhập khác, one line typed for this month (L-D11): a reason and a tax choice are required. */
export interface PayrollOtherIncomeDto {
  amount: number;
  taxable: boolean;
  reason: string;
}

/** (32) typed for this month only, on top of the recurring items of the profile (câu 4, L-D12, L-D13). */
export interface PayrollCashItemDto {
  kind: PayrollCashKind;
  amount: number;
  reason: string;
}

/**
 * `PUT /api/hr/payroll/months/:YYYY-MM/lines/:employeeId/inputs`, the numbers only HR knows. Null on a computed
 * cell means "as the engine computes it": (19) the formula or nothing, (22) the D12 prefill, (23) the close.
 */
export interface PayrollMonthInputsDto {
  /** (19) as a fraction, 0,8 for 80%. Typed, it replaces the formula (and "missing") of the engine. */
  kpiPercent: number | null;
  /** (21) weekday overtime hours, in steps of half an hour. */
  overtimeHours: number;
  /** (22) rest-day work outside (17), paid 200%. */
  restDays: number | null;
  /** (23) holiday work, already in (17), plus 300%. */
  holidayDays: number | null;
  otherIncome: PayrollOtherIncomeDto[];
  cash: PayrollCashItemDto[];
  /** Tiền phép chưa nghỉ in dong, typed over the computed amount; null or absent: as the web computes it. */
  leavePayout?: number | null;
  /** Truy lĩnh / truy thu typed over or left out, by the month they come from; absent: none. */
  retro?: PayrollRetroInputDto[];
  /** Ghi chú HR, free text; also the reason shown on the cells it typed over. */
  note: string;
  /** Who saved last, null while nothing is typed. */
  updatedBy: string | null;
  updatedAt: string | null;
}

export const EMPTY_MONTH_INPUTS: PayrollMonthInputsDto = {
  kpiPercent: null,
  overtimeHours: 0,
  restDays: null,
  holidayDays: null,
  otherIncome: [],
  cash: [],
  leavePayout: null,
  retro: [],
  note: '',
  updatedBy: null,
  updatedAt: null,
};

const inputAmount = z
  .number({ message: 'Nhập số tiền.' })
  .int('Nhập số đồng.')
  .positive('Nhập số tiền lớn hơn 0. Số âm: dùng truy thu.');
const inputReason = z.string({ message: 'Nhập lý do.' }).trim().min(1, 'Nhập lý do.').max(200);
const inputDays = z.number({ message: 'Nhập số công.' }).min(0, 'Nhập số công từ 0.').max(31, 'Nhập tối đa 31 công.');
const halfSteps = (n: number) => Number.isInteger(n * 2);

/**
 * Partial: a field left out keeps what is stored; null puts a computed cell back to the engine's number. The lists
 * are replaced as a whole. Fields it does not know (e.g. `updatedBy` sent back) are ignored.
 */
export const payrollMonthInputsSchema = z
  .object({
    kpiPercent: z
      .number({ message: 'Nhập % KPI.' })
      .min(0, 'Nhập % trong khoảng 0–200%.')
      .max(KPI_PERCENT_MAX, 'Nhập % trong khoảng 0–200%.')
      .nullable(),
    overtimeHours: z
      .number({ message: 'Nhập số giờ.' })
      .min(0, 'Nhập số giờ từ 0.')
      .max(300, 'Nhập tối đa 300 giờ.')
      .refine(halfSteps, 'Nhập giờ theo bước 0,5.'),
    restDays: inputDays.refine(halfSteps, 'Nhập công theo bước 0,5.').nullable(),
    holidayDays: inputDays.refine(halfSteps, 'Nhập công theo bước 0,5.').nullable(),
    otherIncome: z
      .array(
        z.object({
          amount: inputAmount,
          taxable: z.boolean({ message: 'Chọn chịu thuế hay không.' }),
          reason: inputReason,
        }),
      )
      .max(20),
    cash: z
      .array(
        z.object({
          kind: z.enum(PAYROLL_CASH_KINDS, { message: 'Chọn Hỗ trợ, Hoàn ứng hoặc Tạm ứng.' }),
          amount: inputAmount,
          reason: z.string().trim().max(200).default(''),
        }),
      )
      .max(20),
    leavePayout: z
      .number({ message: 'Nhập số tiền.' })
      .int('Nhập số đồng.')
      .min(0, 'Nhập số tiền từ 0.')
      .max(1_000_000_000, 'Nhập tối đa 1 tỷ đồng.')
      .nullable(),
    retro: z
      .array(
        z.object({
          origin: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Chọn tháng gốc.'),
          amount: z
            .number({ message: 'Nhập số tiền.' })
            .int('Nhập số đồng.')
            .min(-1_000_000_000, 'Nhập tối đa 1 tỷ đồng.')
            .max(1_000_000_000, 'Nhập tối đa 1 tỷ đồng.'),
          reason: inputReason,
        }),
      )
      .max(12)
      .refine((list) => new Set(list.map((r) => r.origin)).size === list.length, 'Mỗi tháng gốc một dòng.'),
    note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự.'),
  })
  .partial();
export type PayrollMonthInputsInput = z.input<typeof payrollMonthInputsSchema>;

/** The answer of the PUT: what is stored now and the person's row computed again (null: not in the close yet). */
export interface PayrollMonthInputsResultDto {
  inputs: PayrollMonthInputsDto;
  line: PayrollLineDto | null;
}

/**
 * Bản duyệt lần N (R4): the month as it was approved, kept unchanged. The month's state (status, approval, paid day)
 * is not part of it: an approved or paid month reads its numbers from here and its state from the month.
 */
export type PayrollMonthSnapshot = Omit<PayrollMonthDto, 'status' | 'computedAt' | 'approval' | 'paidOn' | 'retroOut'>;

const isoDay = z
  .string({ message: 'Chọn ngày chuyển khoản.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày chuyển khoản.')
  .refine((d) => {
    const date = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === d;
  }, 'Chọn ngày chuyển khoản.');

/** `POST /months/:YYYY-MM/approve` (spec 11.4): a red warning left needs `acknowledgedRed` ("Đã xem cảnh báo đỏ"). */
export const payrollApproveSchema = z.object({ acknowledgedRed: z.boolean().default(false) });
export type PayrollApproveInput = z.input<typeof payrollApproveSchema>;

/** `POST /months/:YYYY-MM/reopen` (R7): the reason is required. */
export const payrollReopenSchema = z.object({
  reason: z
    .string({ message: 'Ghi lý do mở lại.' })
    .trim()
    .min(1, 'Ghi lý do mở lại.')
    .max(500, 'Lý do tối đa 500 ký tự.'),
});
export type PayrollReopenInput = z.input<typeof payrollReopenSchema>;

/** `POST /months/:YYYY-MM/paid`: the transfer day "YYYY-MM-DD" and an optional note. */
export const payrollMarkPaidSchema = z.object({
  paidOn: isoDay,
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự.').default(''),
});
export type PayrollMarkPaidInput = z.input<typeof payrollMarkPaidSchema>;
