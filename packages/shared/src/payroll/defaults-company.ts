import { z } from 'zod';
import { LAW_MIN_OVERTIME, LAW_MIN_PROBATION_RATE } from './defaults-law.js';
import { defineSetting } from './setting-core.js';

/**
 * Company settings by payroll month (spec 6.2): pay components, contract types, rules, options D01–D15. Each has a
 * default; HR adds a row for everyone or for one person from a month.
 */

const SPEC = 'spec Lương';
const FROM = '2026-01';
const money = z.number().int().nonnegative();

/**
 * How a component is taxed (spec 5.3 (33), 5.9): all taxable, all exempt, or exempt up to the monthly meal cap, the
 * level in the contract or company rules (`regulated`), or what is left of the yearly clothing cap.
 */
export const componentTaxSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('taxable') }),
  z.object({ kind: z.literal('exempt') }),
  z.object({
    kind: z.literal('cap'),
    cap: z.union([z.literal('meal'), z.literal('regulated'), z.literal('clothing-year')]),
  }),
]);
export type ComponentTax = z.infer<typeof componentTaxSchema>;

export const payComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int(),
  /** "Chia theo ngày": paid as amount × days ÷ norm; off, paid in full (D11). */
  perDay: z.boolean(),
  /** "× tỷ lệ thử việc". */
  probationRate: z.boolean(),
  /** "Tính BH": counts toward the insurance salary (27). */
  insured: z.boolean(),
  /** "Lương theo HĐ": the base of unused leave paid on leaving (spec 5.5, NĐ 145/2020 Đ.67 k3). */
  contractPay: z.boolean(),
  /** "Vào lương làm thêm": in the daily rate overtime is paid on (spec 5.3 (25), câu 20). */
  overtimeBase: z.boolean(),
  tax: componentTaxSchema,
  defaultAmount: money,
  /** The exemption level of a `regulated` component; null: the person's own amount, as the contract states it. */
  regulatedCap: money.nullable(),
  /** "Ngừng từ tháng". */
  stoppedFrom: z.string().nullable(),
});
export type PayComponent = z.infer<typeof payComponentSchema>;

const component = (id: string, name: string, order: number, over: Partial<PayComponent> = {}): PayComponent => ({
  id,
  name,
  order,
  perDay: true,
  probationRate: true,
  insured: false,
  contractPay: false,
  overtimeBase: true,
  tax: { kind: 'taxable' },
  defaultAmount: 0,
  regulatedCap: null,
  stoppedFrom: null,
  ...over,
});

/** Insurance salary and contract pay: salary and position allowance (spec 5.9, NĐ 158/2025 Đ.7 k1). */
const CONTRACT_PAY = { insured: true, contractPay: true } as const;

/**
 * Attendance pay is contract pay but not insured by default (spec 17.3 K3, chốt 09/11/2026): it is paid pro rata to
 * the days worked, so it "varies with the work" that NĐ 158/2025 Đ.7 leaves out, and HR's October file insures the
 * time pay only. HR turns "tính BH" back on for everyone or one person with `khoan.chuyen-can.tinh-bh`.
 */
const ATTENDANCE_PAY = { insured: false, contractPay: true } as const;

/**
 * Spec 5.9 (bản 08/11 sau khi chốt mục 17). Default amounts only prefill a new profile; the amounts here are the
 * illustrative ones of the test catalogue.
 *
 * Fuel and phone are one component exempt in full, as HR's October file pays them (spec 17.3 K2, chốt 09/11/2026: "như
 * file"). A company paying them apart replaces it in `khoan.danh-sach` with a taxable "Xăng xe" and an "Điện thoại"
 * exempt up to the contract level (`{ kind: 'cap', cap: 'regulated' }`).
 */
export const DEFAULT_COMPONENTS: readonly PayComponent[] = [
  component('luong', 'Lương thời gian', 1, CONTRACT_PAY),
  component('trach-nhiem', 'PC trách nhiệm', 2, CONTRACT_PAY),
  component('com', 'Tiền cơm', 3, { tax: { kind: 'cap', cap: 'meal' }, defaultAmount: 1_100_000 }),
  component('xang-dt', 'Xăng xe + ĐT', 4, { tax: { kind: 'exempt' } }),
  component('trang-phuc', 'Trang phục', 5, { tax: { kind: 'cap', cap: 'clothing-year' }, defaultAmount: 350_000 }),
  component('nha-o', 'Nhà ở / Sinh hoạt', 6),
  component('chuyen-can', 'Chuyên cần', 7, { ...ATTENDANCE_PAY, defaultAmount: 1_000_000 }),
];

export const contractTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  insured: z.boolean(),
  taxMethod: z.union([z.literal('progressive'), z.literal('flat10')]),
  /** HĐ dưới 3 tháng (or no contract): the 10% withholding of NĐ 253 Đ.50 k2. */
  shortTerm: z.boolean(),
  probationDays: z.number().int().nonnegative(),
  /**
   * "Cam kết thuế kèm hợp đồng": the contract carries the person's tax commitment, so nothing is withheld without HR
   * typing one (HR's October file; NĐ 253 Đ.50 k2). Left out: on for a short-term type, off for the others.
   */
  commitmentIncluded: z.boolean().optional(),
});
export type ContractType = z.infer<typeof contractTypeSchema>;

/** A type withheld 10% unless there is a commitment: under 3 months, or taxed flat (NĐ 253 Đ.50 k2). */
export const isShortTermContract = (t: Pick<ContractType, 'shortTerm' | 'taxMethod'>): boolean =>
  t.shortTerm || t.taxMethod === 'flat10';

/** Whether a person on this contract counts as having a tax commitment without a signed one on file. */
export const contractCommitment = (t: ContractType): boolean => t.commitmentIncluded ?? isShortTermContract(t);

/** Câu 9, 32, 33: probation on its own contract, without insurance; 12-month contracts like open-ended ones. */
export const DEFAULT_CONTRACT_TYPES: readonly ContractType[] = [
  {
    id: 'khong-thoi-han',
    name: 'HĐLĐ không xác định thời hạn',
    insured: true,
    taxMethod: 'progressive',
    shortTerm: false,
    probationDays: 60,
  },
  {
    id: '12-thang',
    name: 'HĐLĐ 12 tháng',
    insured: true,
    taxMethod: 'progressive',
    shortTerm: false,
    probationDays: 60,
  },
  {
    id: 'thu-viec',
    name: 'HĐ thử việc',
    insured: false,
    taxMethod: 'flat10',
    shortTerm: true,
    probationDays: 60,
    commitmentIncluded: true,
  },
];

/**
 * (19) when HR typed nothing (spec 5.3): `formula` is Σ(days × rate) ÷ norm, the rate 90% on probation days and 100%
 * on official ones; `typed` leaves it to HR's evaluation and the row is flagged until it is typed.
 */
export const kpiRuleSchema = z.enum(['formula', 'typed']);
export type KpiRule = z.infer<typeof kpiRuleSchema>;

const choice = <T extends string>(
  key: string,
  label: string,
  values: readonly [T, ...T[]],
  perPerson: boolean,
  source: string,
) =>
  defineSetting<T>({
    key,
    label,
    scope: 'month',
    perPerson,
    schema: z.enum(values),
    defaults: [{ from: FROM, value: values[0], source }],
  });

/** Options D01–D15 (spec 9); the first value is the default. D11 is the component's own "chia theo ngày" flag. */
export const OPTION_SETTINGS = {
  'tuy-chon.d01': choice('tuy-chon.d01', 'Làm tròn', ['cell', 'as-hr'], false, 'spec 5.7, câu 25'),
  'tuy-chon.d02': choice(
    'tuy-chon.d02',
    'Cơ sở 10%',
    ['income-plus-support', 'income', 'taxable'],
    true,
    'NĐ 253 Đ.50 k2: mọi khoản thu nhập từ tiền lương của lần chi',
  ),
  'tuy-chon.d03': choice(
    'tuy-chon.d03',
    'KPCĐ',
    ['off', 'when-social'],
    true,
    'Luật Công đoàn 2024 Đ.29: doanh nghiệp đóng 2% quỹ lương đóng BHXH; công ty tạm không tính theo file lương',
  ),
  'tuy-chon.d04': choice(
    'tuy-chon.d04',
    'BHYT tháng không đóng BHXH',
    ['pay-except-sick', 'pay', 'skip'],
    true,
    'Luật BHYT Đ.12 k2 b sửa bởi Luật 51/2024; file T10',
  ),
  'tuy-chon.d05': choice(
    'tuy-chon.d05',
    'Miễn thuế làm thêm',
    ['within-limits', 'taxable'],
    true,
    'NĐ 253 Đ.26 k1, k3',
  ),
  'tuy-chon.d06': choice('tuy-chon.d06', '% KPI tháng lên chính thức', ['suggest', 'manual'], true, SPEC),
  'tuy-chon.d07': choice(
    'tuy-chon.d07',
    'Ngày làm việc cho quy tắc 14 ngày',
    ['mon-fri', 'mon-fri-saturdays'],
    true,
    'câu 17',
  ),
  'tuy-chon.d08': choice(
    'tuy-chon.d08',
    'Tiền phép khi nghỉ việc',
    ['exempt', 'taxable'],
    true,
    'BLLĐ Đ.113 k3, NĐ 253 Đ.26 k2',
  ),
  'tuy-chon.d09': choice(
    'tuy-chon.d09',
    'Cam kết thuế',
    ['no-withholding', 'withhold'],
    true,
    'NĐ 253 Đ.50 k2, câu 11',
  ),
  'tuy-chon.d10': choice(
    'tuy-chon.d10',
    'Trả sau ngày nghỉ việc',
    ['flat10-all', 'flat10-short-only', 'progressive'],
    true,
    'NĐ 253 Đ.50 k2',
  ),
  'tuy-chon.d12': choice(
    'tuy-chon.d12',
    'Làm Chủ nhật',
    ['total-200', 'swap-day'],
    true,
    'BLLĐ Đ.98 k1 b, Đ.107 k1, Đ.111 k2',
  ),
  'tuy-chon.d13': choice('tuy-chon.d13', 'Thứ tự dòng', ['region-contract-block-code'], false, 'câu 26, file T10'),
  'tuy-chon.d14': choice('tuy-chon.d14', 'Người lập tự duyệt', ['allowed', 'blocked'], false, 'câu 28'),
  'tuy-chon.d15': choice(
    'tuy-chon.d15',
    'Vẫn đóng BH tháng có từ 14 ngày không hưởng lương',
    ['no', 'agreed'],
    true,
    'Luật BHXH 2024 Đ.33 k5',
  ),
} as const;

export const RULE_SETTINGS = {
  'quy-tac.ty-le-thu-viec': defineSetting({
    key: 'quy-tac.ty-le-thu-viec',
    label: 'Tỷ lệ lương thử việc',
    scope: 'month',
    perPerson: true,
    schema: z.number().min(LAW_MIN_PROBATION_RATE).max(1),
    defaults: [{ from: FROM, value: 0.9, source: 'BLLĐ Đ.26' }],
  }),
  'quy-tac.gio-mot-ngay': defineSetting({
    key: 'quy-tac.gio-mot-ngay',
    label: 'Giờ một ngày',
    scope: 'month',
    perPerson: true,
    schema: z.number().positive().max(24),
    defaults: [{ from: FROM, value: 8, source: 'câu 20' }],
  }),
  'quy-tac.he-so-lam-them': defineSetting({
    key: 'quy-tac.he-so-lam-them',
    label: 'Hệ số làm thêm',
    scope: 'month',
    perPerson: true,
    schema: z.object({
      weekday: z.number().min(LAW_MIN_OVERTIME.weekday),
      restDay: z.number().min(LAW_MIN_OVERTIME.restDay),
      holiday: z.number().min(LAW_MIN_OVERTIME.holiday),
    }),
    defaults: [{ from: FROM, value: { weekday: 1.5, restDay: 2, holiday: 3 }, source: 'BLLĐ Đ.98' }],
  }),
  'quy-tac.ngay-chi-tra': defineSetting({
    key: 'quy-tac.ngay-chi-tra',
    label: 'Ngày chi trả mặc định (tháng sau)',
    scope: 'month',
    perPerson: false,
    schema: z.number().int().min(1).max(28),
    defaults: [{ from: FROM, value: 5, source: 'câu 27' }],
  }),
  'quy-tac.gio-cong-ngay-nghi': defineSetting({
    key: 'quy-tac.gio-cong-ngay-nghi',
    label: 'Giờ mỗi công làm thêm ngày nghỉ, lễ (cho giới hạn giờ)',
    scope: 'month',
    perPerson: true,
    schema: z.number().positive().max(12),
    defaults: [{ from: FROM, value: 8, source: 'câu 21; NĐ 145/2020 Đ.60 k4' }],
  }),
  'quy-tac.dem-ngay-bh': defineSetting({
    key: 'quy-tac.dem-ngay-bh',
    label: 'Đếm 14 ngày cho tháng vào, nghỉ giữa tháng (BH-1)',
    scope: 'month',
    perPerson: false,
    schema: z.union([z.literal('unpaid-days'), z.literal('insured-days')]),
    defaults: [
      { from: FROM, value: 'unpaid-days' as const, source: 'Luật BHXH 2024 Đ.33 k5; kế toán ký xác nhận (17.3)' },
    ],
  }),
  'quy-tac.kpi-chinh-thuc-theo-ngay': defineSetting({
    key: 'quy-tac.kpi-chinh-thuc-theo-ngay',
    label: 'KPI người chính thức chia theo ngày công',
    scope: 'month',
    perPerson: true,
    schema: z.boolean(),
    defaults: [{ from: FROM, value: false, source: 'câu 6, file T10' }],
  }),
  'quy-tac.gross-gom-kpi': defineSetting({
    key: 'quy-tac.gross-gom-kpi',
    label: 'Gross thoả thuận gồm KPI 100%',
    scope: 'month',
    perPerson: false,
    schema: z.boolean(),
    defaults: [{ from: FROM, value: true, source: 'câu 7' }],
  }),
  'quy-tac.kpi-theo-khoi': defineSetting({
    key: 'quy-tac.kpi-theo-khoi',
    label: '% KPI theo khối khi HR không gõ',
    scope: 'month',
    perPerson: true,
    schema: z.object({ BO: kpiRuleSchema, KD: kpiRuleSchema }),
    defaults: [
      {
        from: FROM,
        value: { BO: 'formula' as const, KD: 'typed' as const },
        source: 'spec 5.3, file T10: khối BO theo công ÷ chuẩn, khối KD do HR đánh giá',
      },
    ],
  }),
} as const;

export const CATALOGUE_SETTINGS = {
  'khoan.danh-sach': defineSetting({
    key: 'khoan.danh-sach',
    label: 'Khoản lương',
    scope: 'month',
    perPerson: false,
    schema: z.array(payComponentSchema),
    defaults: [{ from: FROM, value: [...DEFAULT_COMPONENTS], source: 'spec 5.9' }],
  }),
  'loai-hd.danh-sach': defineSetting({
    key: 'loai-hd.danh-sach',
    label: 'Loại hợp đồng',
    scope: 'month',
    perPerson: false,
    schema: z.array(contractTypeSchema),
    defaults: [{ from: FROM, value: [...DEFAULT_CONTRACT_TYPES], source: 'câu 9, 32, 33' }],
  }),
} as const;
