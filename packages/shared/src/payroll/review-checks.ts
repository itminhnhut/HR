import { isWeekend, nextDay } from '../timesheet.js';
import { componentsFor, contractTypesFor } from './components.js';
import type { PayrollConfig } from './config.js';
import { isShortTermContract } from './defaults-company.js';
import { restDayPrefill } from './prefill.js';
import type { PayrollLine, PAYROLL_COLUMNS } from './line.js';
import { toNumber } from './rational.js';

/** The checks of Rà soát, one small function per warning (spec 11.3). */

export type ReviewLevel = 'red' | 'yellow';
export type ReviewCell = keyof typeof PAYROLL_COLUMNS;

export interface ReviewItem {
  level: ReviewLevel;
  code: string;
  /** Null for a warning about the whole month. */
  employeeId: string | null;
  /** The cell the row links to (spec 4.4); null when the source is elsewhere. */
  cell: ReviewCell | null;
  message: string;
}

/** What Rà soát reads about one person besides the computed row. */
export interface ReviewRowInput {
  employeeId: string;
  /** Code and name as shown in messages, e.g. "NV A". */
  label: string;
  /** Null when the person has days in the closing but no profile: a zero row. */
  line: PayrollLine | null;
  config: PayrollConfig;
  closing: {
    paid: number;
    norm: number;
    overtime: number;
    sundayWorked: number;
    leaveClosing: number;
    leaveOverdrawn: number;
  };
  employment: {
    leftOn: string | null;
    contractTypeId: string | null;
    /** The default official contract's name when the person went official on a probation level only. */
    defaultedContract?: string | null;
    block: string | null;
    unconfirmedDates: readonly string[];
    /** Probation days of the person's contract and the most BLLĐ Đ.25 allows for the job. */
    probation?: { days: number; limit: number } | null;
    /** The contract type id of the person's level when the month's config does not know it: a zero row. */
    unknownContract?: string | null;
  };
  profile: { exists: boolean; gap: { from: string; to: string } | null };
  inputs: {
    restDaysTyped: number | null;
    paidDaysTyped: number | null;
    overtimeHoursBefore: number;
    /** Tiền phép chưa nghỉ HR typed over the computed amount; null or absent when not typed. */
    leavePayoutTyped?: { computed: number; typed: number } | null;
    /** Truy lĩnh / truy thu HR typed over or left out (typed 0), by the month "MM/YYYY" they come from. */
    retroTyped?: readonly { origin: string; computed: number; typed: number }[];
    /** Months "MM/YYYY" whose amount HR typed over a computed difference that is gone: left out, not paid. */
    retroStale?: readonly string[];
  };
  /**
   * `hasCommitment`: a signed commitment for this month's tax year. `commitmentYear`: the latest tax year, up to this
   * month's, the person signed one for; null without any.
   */
  /** `hasPayslipEmail`: an address to mail the payslip to; left out where nobody asks (no warning). */
  person: { hasCommitment: boolean; commitmentYear: number | null; hasBankAccount: boolean; hasPayslipEmail?: boolean };
  /** Net pay of the last approved month and what is known to have changed; null for the first month on the web. */
  previous: { netPay: number; causes: readonly string[] } | null;
}

type Check = (row: ReviewRowInput) => Omit<ReviewItem, 'employeeId'>[];

const dong = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const decimal = (n: number) => String(Number(n.toFixed(2))).replace('.', ',');
const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const ddmmyyyy = (day: string) => `${ddmm(day)}/${day.slice(0, 4)}`;
const red = (code: string, cell: ReviewCell | null, message: string) => ({
  level: 'red' as const,
  code,
  cell,
  message,
});
const yellow = (code: string, cell: ReviewCell | null, message: string) => ({
  level: 'yellow' as const,
  code,
  cell,
  message,
});

/** The day by which leave owed on leaving must be paid: 14 working days (Mon–Fri) after the leaving day (BLLĐ Đ.48). */
export function leavePayDeadline(leftOn: string, workingDays = 14): string {
  const step = (day: string, left: number): string => {
    if (left === 0) return day;
    const next = nextDay(day);
    return step(next, isWeekend(next) ? left : left - 1);
  };
  return step(leftOn, workingDays);
}

const profileChecks: Check = ({ profile, label, employment }) => [
  ...(profile.exists ? [] : [red('missing-profile', 'income', `${label} có công, chưa có hồ sơ, dòng 0 đồng`)]),
  ...(profile.gap
    ? [red('profile-gap', 'paidDays', `${ddmm(profile.gap.from)}–${ddmm(profile.gap.to)} có công nhưng chưa có mức`)]
    : []),
  ...(employment.contractTypeId ? [] : [red('missing-contract', null, 'Thiếu loại HĐ')]),
  ...(employment.unknownContract
    ? [red('unknown-contract', null, `Loại HĐ của mức lương không còn trong cấu hình: ${employment.unknownContract}`)]
    : []),
  ...(employment.defaultedContract
    ? [
        yellow(
          'default-official-contract',
          null,
          `Chưa chọn loại HĐ chính thức — đang dùng mặc định ${employment.defaultedContract}`,
        ),
      ]
    : []),
  ...(employment.block ? [] : [red('missing-block', null, 'Thiếu khối')]),
  ...employment.unconfirmedDates.map((d) => red('unconfirmed-date', null, `${d} chưa được HR xác nhận`)),
  ...(employment.probation && employment.probation.days > employment.probation.limit
    ? [
        red(
          'probation-too-long',
          null,
          `Thử việc ${employment.probation.days} ngày, vượt ${employment.probation.limit} ngày (BLLĐ Đ.25)`,
        ),
      ]
    : []),
];

const moneyChecks: Check = ({ line, config }) => {
  if (!line) return [];
  const { insurance } = line;
  const timePay = line.amounts['luong'] ?? 0;
  const month = config.dates.insuranceMonth.slice(5);
  return [
    ...(line.cells.netPay < 0 ? [red('negative-net', 'netPay', `Thực nhận âm: ${dong(line.cells.netPay)}`)] : []),
    ...(timePay < insurance.floor
      ? [
          red(
            'below-zone-minimum',
            'socialBase',
            `Lương thời gian ${dong(timePay)} dưới lương tối thiểu vùng ${dong(insurance.floor)}`,
          ),
        ]
      : []),
    ...(insurance.belowFloor
      ? [
          yellow(
            'insurance-floor',
            'socialBase',
            `Σ khoản tính BH ${dong(insurance.insuredSalary)} dưới sàn, đóng trên ${dong(insurance.floor)}`,
          ),
        ]
      : []),
    ...(insurance.status.provisional
      ? [yellow('insurance-provisional', 'socialBase', `BH tháng ${month} tính tạm từ kỳ công chưa chốt`)]
      : []),
  ];
};

const daysChecks: Check = ({ closing, inputs, line, config }) => {
  const prefill = restDayPrefill(closing, config.options.sundayWork).restDays;
  const restDays = inputs.restDaysTyped ?? prefill;
  const leftOver = closing.overtime - restDays;
  const weekdayHours = line?.overtime.weekdayHours ?? 0;
  return [
    ...(closing.paid > closing.norm
      ? [
          yellow(
            'paid-days-over-norm',
            'paidDays',
            `Ngày công ${decimal(closing.paid)} lớn hơn chuẩn ${decimal(closing.norm)}`,
          ),
        ]
      : []),
    ...(inputs.paidDaysTyped !== null && inputs.paidDaysTyped !== closing.paid
      ? [
          yellow(
            'paid-days-override',
            'paidDays',
            `Ngày công gõ ${decimal(inputs.paidDaysTyped)} khác Chấm công ${decimal(closing.paid)}`,
          ),
        ]
      : []),
    ...(inputs.restDaysTyped === null && closing.sundayWorked > prefill
      ? [yellow('sunday-makeup', 'overtimePay', 'CN bù ngày thường')]
      : []),
    ...(inputs.restDaysTyped !== null && inputs.restDaysTyped !== prefill
      ? [
          yellow(
            'override-differs',
            'overtimePay',
            `Công làm thêm ngày nghỉ gõ ${decimal(restDays)} khác số tính ${decimal(prefill)}`,
          ),
        ]
      : []),
    ...(leftOver > 0 && weekdayHours === 0
      ? [yellow('overtime-without-hours', 'overtimePay', `OT ${decimal(leftOver)} ngày chưa có giờ làm thêm`)]
      : []),
  ];
};

const percent = (x: number) => `${decimal(x * 100)}%`;

const kpiAndOvertimeChecks: Check = ({ line, config, inputs }) => {
  if (!line) return [];
  const { income, tax } = line;
  const typed = toNumber(income.kpiPercent);
  const computed = toNumber(income.kpiPercentComputed);
  const differs = income.kpiPercentSource === 'typed' && income.kpiPercentComputed.n !== 0n && typed !== computed;
  const limits = config.law.overtimeLimits;
  const hours = tax.overtimeHours.total;
  const year = inputs.overtimeHoursBefore + hours;
  return [
    ...(income.kpiPercentSource === 'missing' && income.kpiAmount > 0
      ? [red('kpi-missing', 'kpiPercent', 'Chưa gõ % KPI')]
      : []),
    ...(differs
      ? [yellow('override-differs', 'kpiPercent', `% KPI gõ ${percent(typed)} khác số tính ${percent(computed)}`)]
      : []),
    ...(hours > limits.month
      ? [yellow('overtime-limit', 'overtimePay', `Làm thêm ${decimal(hours)} giờ, vượt ${limits.month} giờ/tháng`)]
      : []),
    ...(year > limits.year
      ? [yellow('overtime-limit', 'overtimePay', `Làm thêm cả năm ${decimal(year)} giờ, vượt ${limits.year} giờ/năm`)]
      : []),
  ];
};

/** Where the sheet and the law part (owner's rule e): never blocking, always with the article. */
const WITHHOLDING_LAW = 'NĐ 253/2026 Đ.50 k2';
const INSURANCE_PAID_UNTAXED =
  'Công ty trả thay BH cho NLĐ nhưng chưa tính thuế — theo NĐ 253/2026 Đ.8 khoản lợi ích do người sử dụng lao động trả thay là thu nhập chịu thuế';

/** The commitment of a short contract: none (10% withheld), one of last year to sign again, one the year outgrows. */
const commitmentChecks: Check = ({ line, config, person, employment }) => {
  if (!line) return [];
  const { tax, cells } = line;
  const { dates, law } = config;
  const contract = config.contractTypes.find((t) => t.id === employment.contractTypeId);
  const paidAfterLeaving = !!employment.leftOn && dates.payDate > employment.leftOn;
  const uncommitted = !!contract && isShortTermContract(contract) && tax.commitmentSource === null;
  const withheld = uncommitted && !paidAfterLeaving && cells.income >= law.flatThreshold;
  // One pay date a month: the first payroll month of a tax year is the one paid in January.
  const firstOfTaxYear = dates.payDate.slice(5, 7) === '01';
  const renew = uncommitted && firstOfTaxYear && person.commitmentYear === dates.taxYear - 1;
  const estimate = tax.commitment;
  return [
    ...(withheld
      ? [
          yellow(
            'probation-no-commitment',
            'tax',
            `Chưa có cam kết thuế — đang khấu trừ 10% (HĐ dưới 3 tháng, chi từ ${dong(law.flatThreshold)}: ${WITHHOLDING_LAW})`,
          ),
        ]
      : []),
    ...(renew ? [yellow('commitment-expired', 'tax', `Cần ký lại cam kết thuế năm ${dates.taxYear}`)] : []),
    ...(estimate?.exceeds
      ? [
          yellow(
            'commitment-exceeds',
            'tax',
            `Thu nhập ước tính cả năm vượt mức được cam kết — nên khấu trừ 10% (ước tính ${dong(estimate.annual)} > ${dong(estimate.limit)}; ${WITHHOLDING_LAW})`,
          ),
        ]
      : []),
  ];
};

const taxChecks: Check = ({ line, config }) => {
  if (!line) return [];
  const paidBack = line.insurancePaid;
  return [
    ...(line.tax.clothing.capReached
      ? [yellow('clothing-cap', 'exempt', `Trang phục chạm trần năm ${dong(config.law.clothingCap)}`)]
      : []),
    ...(paidBack && !paidBack.taxable && paidBack.amount > 0
      ? [yellow('insurance-paid-untaxed', 'cash', INSURANCE_PAID_UNTAXED)]
      : []),
  ];
};

const leavingChecks: Check = ({ closing, employment }) => {
  if (!employment.leftOn) return [];
  return [
    ...(closing.leaveClosing > 0
      ? [
          yellow(
            'leave-left',
            'otherIncome',
            `Còn ${decimal(closing.leaveClosing)} ngày phép khi nghỉ việc, trả trước ${ddmmyyyy(leavePayDeadline(employment.leftOn))}`,
          ),
        ]
      : []),
    ...(closing.leaveOverdrawn > 0
      ? [
          yellow(
            'leave-overdrawn',
            'paidDays',
            `Nghỉ quá phép ${decimal(closing.leaveOverdrawn)} ngày, Chấm công đã không trả`,
          ),
        ]
      : []),
  ];
};

const historyChecks: Check = ({ line, previous, person }) => {
  const change =
    line && previous && previous.netPay !== 0 ? (line.cells.netPay - previous.netPay) / previous.netPay : 0;
  const causes = previous?.causes.length ? ` · ${previous.causes.join(', ')}` : '';
  const sign = change > 0 ? '+' : '';
  return [
    ...(Math.abs(change) > 0.1
      ? [
          yellow(
            'change-over-10',
            'netPay',
            `Thực nhận lệch ${sign}${Math.round(change * 100)}% so với tháng trước${causes}`,
          ),
        ]
      : []),
    ...(person.hasBankAccount ? [] : [yellow('missing-bank-account', null, 'Thiếu số tài khoản')]),
    ...(person.hasPayslipEmail === false
      ? [yellow('missing-payslip-email', null, 'Thiếu email nhận phiếu lương')]
      : []),
  ];
};

/** Spec 6.1: a person override known to go against the law, such as insurance off on an insured contract. */
const overrideChecks: Check = ({ config, employment }) => {
  const month = config.dates.monthKey;
  const everyoneTypes = contractTypesFor(config.rows, null, month);
  const ownType = config.contractTypes.find((t) => t.id === employment.contractTypeId);
  const baseType = everyoneTypes.find((t) => t.id === employment.contractTypeId);
  const everyonePay = componentsFor(config.rows, null, month).find((c) => c.id === 'luong');
  const ownPay = config.components.find((c) => c.id === 'luong');
  return [
    ...(baseType?.insured && ownType && !ownType.insured
      ? [yellow('unlawful-override', 'socialBase', `Ghi đè riêng tắt đóng BH của ${ownType.name}`)]
      : []),
    ...(everyonePay?.insured && ownPay && !ownPay.insured
      ? [yellow('unlawful-override', 'socialBase', `Ghi đè riêng tắt tính BH của ${ownPay.name}`)]
      : []),
  ];
};

/** Câu 20: overtime must be paid at least on the salary and the pay allowances (BLLĐ Đ.98 k1, NĐ 145/2020 Đ.55). */
const overtimeBaseChecks: Check = ({ config }) =>
  config.components
    .filter((c) => (c.id === 'luong' || c.id === 'trach-nhiem') && !c.overtimeBase)
    .map((c) => red('overtime-base', 'overtimePay', `${c.name} không vào lương làm thêm`));

/** HR's amount over the computed leave payout: under it the person gets less than BLLĐ Đ.113 k3 gives. */
const leavePayoutChecks: Check = ({ inputs }) => {
  const typed = inputs.leavePayoutTyped;
  if (!typed || typed.typed === typed.computed) return [];
  const words =
    typed.typed < typed.computed
      ? `thấp hơn số tính ${dong(typed.computed)} (BLLĐ Đ.113 k3: trả đủ tiền lương cho những ngày chưa nghỉ)`
      : `cao hơn số tính ${dong(typed.computed)}; phần vượt mức luật chịu thuế (NĐ 253 Đ.26 k3)`;
  return [yellow('leave-payout-typed', 'otherIncome', `Tiền phép chưa nghỉ gõ ${dong(typed.typed)} ${words}`)];
};

/**
 * HR's amount in place of a computed truy lĩnh / truy thu: the difference stays unpaid or uncollected. An amount typed
 * over a difference that is gone is not paid at all.
 */
const retroChecks: Check = ({ inputs }) => [
  ...(inputs.retroTyped ?? [])
    .filter((r) => r.typed !== r.computed)
    .map((r) => {
      const typed = r.typed === 0 ? 'HR bỏ ra' : `HR gõ ${dong(r.typed)}`;
      return yellow(
        'retro-typed',
        'netPay',
        `Truy lĩnh / truy thu từ T${r.origin}: ${typed}, số tính ${dong(r.computed)}`,
      );
    }),
  ...(inputs.retroStale ?? []).map((origin) =>
    yellow(
      'retro-typed-stale',
      'netPay',
      `Truy lĩnh / truy thu từ T${origin}: Khoản gõ đè không còn chênh lệch — đã bỏ qua`,
    ),
  ),
];

export const ROW_CHECKS: readonly Check[] = [
  profileChecks,
  moneyChecks,
  daysChecks,
  kpiAndOvertimeChecks,
  commitmentChecks,
  taxChecks,
  leavingChecks,
  leavePayoutChecks,
  retroChecks,
  historyChecks,
  overrideChecks,
  overtimeBaseChecks,
];
