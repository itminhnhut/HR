import type { PayrollConfig } from './config.js';
import { kpiRuleOf, type ComponentPaid } from './income.js';
import type { PayrollLine, PayrollLineInput } from './line.js';
import { min, roundDong, sum, toNumber } from './rational.js';
import { settingFor } from './settings.js';
import {
  count,
  dong,
  exact,
  fromText,
  pct,
  personalRefs,
  personSettingsOf,
  refOf,
  type PayrollCellKey,
  type PayrollConfigRef,
  type PayrollPersonSetting,
} from './explain-refs.js';

export * from './explain-refs.js';

/**
 * The formula behind each cell of a payroll row, with the row's real numbers (spec 11.2, Q7): "(18) = (6.400.000 +
 * 1.100.000 + 450.000 + 1.000.000) × 90% ÷ 22 = 366.136". Display only: the numbers come from `computeLine`.
 */

export interface PayrollCellExplain {
  formula: string;
  refs: PayrollConfigRef[];
  /** The value comes from the timesheet closing: "Xem ở Bảng công". */
  fromTimesheet?: boolean;
}

export type PayrollCellExplains = Partial<Record<PayrollCellKey, PayrollCellExplain>>;

export interface PayrollLineExplain {
  cells: PayrollCellExplains;
  personSettings: PayrollPersonSetting[];
  /** The Ghi chú column: insurance status, a tax method other than the brackets. */
  note: string;
}

interface Ctx {
  input: PayrollLineInput;
  line: PayrollLine;
  config: PayrollConfig;
}

const cell = (formula: string, refs: (PayrollConfigRef | null)[] = []): PayrollCellExplain => ({
  formula,
  refs: refs.filter((r): r is PayrollConfigRef => r !== null),
});

const lastSegment = ({ input }: Ctx) => input.income.segments[input.income.segments.length - 1];

/** (18): Σ(per-day component × its rate) ÷ norm, of the last segment. */
function dailyRateText(ctx: Ctx): string {
  const { config, line, input } = ctx;
  const segment = lastSegment(ctx);
  if (!segment) return '';
  const paid = config.components.filter((c) => c.perDay && (segment.amounts[c.id] ?? 0) > 0);
  const amountOf = (id: string) => dong(segment.amounts[id] ?? 0);
  const reduced = paid.filter((c) => segment.probation && c.probationRate).map((c) => amountOf(c.id));
  const full = paid.filter((c) => !(segment.probation && c.probationRate)).map((c) => amountOf(c.id));
  const group = (list: string[]) => (list.length > 1 ? `(${list.join(' + ')})` : (list[0] ?? '0'));
  const rate = pct(config.rules.probationRate);
  const parts = [...(reduced.length ? [`${group(reduced)} × ${rate}`] : []), ...full];
  const top = reduced.length && full.length ? `(${parts.join(' + ')})` : parts.length > 1 ? group(parts) : parts[0];
  const tail = input.income.segments.length > 1 ? ' (đoạn cuối kỳ)' : '';
  return `${top ?? '0'} ÷ ${count(input.income.norm)} = ${dong(line.cells.dailyRate)}${tail}`;
}

function kpiPercentText({ line, input, config }: Ctx): string {
  const { income } = line;
  if (input.income.kpiAmount <= 0) return 'Không có KPI';
  if (income.kpiPercentSource === 'typed') return `HR gõ ${pct(line.cells.kpiPercent)}`;
  if (income.kpiPercentSource === 'missing') return 'Chưa gõ % KPI';
  const rate = pct(config.rules.probationRate);
  const word = income.kpiPercentSource === 'suggested' ? 'Gợi ý: ' : '';
  const daysOf = (probation: boolean) =>
    input.income.segments.filter((s) => s.probation === probation).reduce((acc, s) => acc + s.days, 0);
  const [reduced, full] = [daysOf(true), daysOf(false)];
  const days = reduced && full ? `(${count(reduced)} × ${rate} + ${count(full)})` : count(income.paidDays);
  const tail = reduced && !full ? ` × ${rate}` : '';
  return `${word}${days} ÷ ${count(input.income.norm)}${tail} = ${pct(line.cells.kpiPercent)}`;
}

function overtimeText({ line, config }: Ctx): string {
  const { weekdayHours, restDays, holidayDays, sundayInPaid = 0 } = line.overtime;
  if (weekdayHours + restDays + holidayDays + sundayInPaid === 0) return 'Không có làm thêm = 0';
  const daily = exact(line.income.overtimeDailyRate);
  const { overtimeRates: r, hoursPerDay } = config.rules;
  const parts = [
    weekdayHours ? `${count(weekdayHours)} giờ × ${daily} ÷ ${hoursPerDay} × ${pct(r.weekday)}` : '',
    restDays ? `${count(restDays)} công × ${daily} × ${pct(r.restDay)}` : '',
    sundayInPaid ? `${count(sundayInPaid)} công CN × ${daily} × ${pct(r.restDay - 1)}` : '',
    holidayDays ? `${count(holidayDays)} công lễ × ${daily} × ${pct(r.holiday)}` : '',
  ].filter(Boolean);
  return `${parts.join(' + ')} = ${dong(line.cells.overtimePay)}`;
}

function incomeText({ line, input }: Ctx): string {
  const { income, cells } = line;
  const fixed = roundDong(sum(income.componentPaid.filter((e) => !e.component.perDay).map((e) => e.paid)));
  const dayPart =
    input.income.segments.length > 1
      ? `Lương ngày công ${dong(roundDong(income.dayPay))}`
      : `Tròn(${exact(income.dailyRate)} × ${count(income.paidDays)}${fixed ? ` + ${dong(fixed)}` : ''})`;
  const rest = [cells.kpiBonus, cells.otherIncome, cells.overtimePay].map(dong).join(' + ');
  return `${dayPart} + ${rest} = ${dong(cells.income)}`;
}

function incomeCells(ctx: Ctx): PayrollCellExplains {
  const { line, input, config } = ctx;
  const { cells, income } = line;
  const segment = lastSegment(ctx);
  const amounts = config.components.map((c) => segment?.amounts[c.id] ?? 0).filter((a) => a > 0);
  const kpi = config.rules.grossWithKpi && input.income.kpiAmount > 0 ? [input.income.kpiAmount] : [];
  const probation = segment?.probation ? refOf(config, 'quy-tac.ty-le-thu-viec', pct(config.rules.probationRate)) : null;
  const catalogue = settingFor(config.rows, 'khoan.danh-sach', null, config.dates.monthKey);
  const components: PayrollConfigRef = {
    key: 'khoan.danh-sach',
    label: 'Khoản lương',
    value: `${config.components.length} khoản`,
    from: fromText(catalogue.from),
    source: catalogue.source,
    area: 'khoan-luong',
    isPersonal: false,
  };
  const others = (input.income.otherIncome ?? []).map((o) => `${o.reason ?? 'Thu nhập khác'} ${dong(o.amount)}`);
  const leave = leavePayoutText(ctx);
  return {
    gross: cell(`${[...amounts, ...kpi].map(dong).join(' + ')} = ${dong(cells.gross)}`, [components]),
    paidDays: { ...cell(`${count(income.paidDays)} công hưởng lương, từ bản chốt Chấm công`), fromTimesheet: true },
    dailyRate: cell(dailyRateText(ctx), [probation, components]),
    kpiPercent: cell(kpiPercentText(ctx), [refOf(config, 'quy-tac.kpi-theo-khoi', kpiRuleOf(input.income.block, config) === 'formula' ? 'theo công thức' : 'HR gõ'), probation]),
    kpiBonus: cell(`KPI ${dong(input.income.kpiAmount)} × ${pct(cells.kpiPercent)} = ${dong(cells.kpiBonus)}`),
    otherIncome: cell(otherIncomeText(others, leave, dong(cells.otherIncome))),
    overtimeHours: cell(`HR gõ ${count(line.overtime.weekdayHours)} giờ`),
    restDays: { ...cell(`${count(line.overtime.restDays)} công làm ngày nghỉ, từ bản chốt Chấm công`), fromTimesheet: true },
    holidayDays: { ...cell(`${count(line.overtime.holidayDays)} công làm lễ, từ bản chốt Chấm công`), fromTimesheet: true },
    overtimePay: cell(overtimeText(ctx), [refOf(config, 'quy-tac.he-so-lam-them', '150% · 200% · 300%'), refOf(config, 'quy-tac.gio-mot-ngay', `${config.rules.hoursPerDay} giờ`)]),
    income: cell(incomeText(ctx)),
  };
}

function insuranceCells({ line, config }: Ctx): PayrollCellExplains {
  const { insurance, cells } = line;
  const { law } = config;
  const { funds, note, rule } = insurance.status;
  const base = dong(cells.socialBase);
  const unemploymentBase = dong(roundDong(insurance.unemploymentBase));
  const off = `Không đóng${note ? ` · ${note}` : ''} = 0`;
  const paid = (on: boolean, rate: number, of: string, value: number) => (on ? `${pct(rate)} × ${of} = ${dong(value)}` : off);
  const employee = refOf(config, 'luat.bh-nld', `${pct(law.employeeRates.social)} · ${pct(law.employeeRates.health)} · ${pct(law.employeeRates.unemployment)}`);
  const company = refOf(config, 'luat.bh-cty', `${pct(law.companyRates.social)} · ${pct(law.companyRates.health)} · ${pct(law.companyRates.unemployment)}`);
  const parts = config.components.filter((c) => c.insured && (line.amounts[c.id] ?? 0) > 0).map((c) => `${c.name} ${dong(line.amounts[c.id] ?? 0)}`);
  const socialBase =
    rule === 'none'
      ? `${note || 'Không thuộc HĐ đóng BH'} = 0`
      : `Σ khoản tính BH ${dong(insurance.insuredSalary)} (${parts.join(' + ')}) kẹp trong [${dong(insurance.floor)}; ${dong(law.socialCap)}] = ${base}`;
  return {
    socialBase: cell(socialBase, [refOf(config, 'luat.luong-toi-thieu-vung', dong(insurance.floor)), refOf(config, 'luat.luong-co-so', dong(law.baseSalary))]),
    social: cell(paid(funds.social, law.employeeRates.social, base, cells.social), [employee]),
    health: cell(paid(funds.health, law.employeeRates.health, base, cells.health), [employee]),
    unemployment: cell(paid(funds.unemployment, law.employeeRates.unemployment, `lương đóng BHTN ${unemploymentBase}`, cells.unemployment), [employee]),
    unionFee: cell(cells.unionFee ? `${pct(law.unionFee)} × ${base} = ${dong(cells.unionFee)}` : 'Không là đoàn viên hoặc không đóng BHXH = 0', [refOf(config, 'luat.doan-phi', pct(law.unionFee))]),
    companySocial: cell(paid(funds.social, law.companyRates.social, base, cells.companySocial), [company]),
    companyHealth: cell(paid(funds.health, law.companyRates.health, base, cells.companyHealth), [company]),
    companyUnemployment: cell(paid(funds.unemployment, law.companyRates.unemployment, `lương đóng BHTN ${unemploymentBase}`, cells.companyUnemployment), [company]),
    unionFund: cell(cells.unionFund ? `KPCĐ ${pct(law.unionFund)} × ${base} = ${dong(cells.unionFund)}` : 'Không đóng KPCĐ tháng này = 0', [refOf(config, 'luat.kpcd', pct(law.unionFund))]),
    companyTotal: cell(`${[cells.companySocial, cells.companyHealth, cells.companyUnemployment, cells.unionFund].map(dong).join(' + ')} = ${dong(cells.companyTotal)}`),
  };
}

/** One exempt part of (33): what was paid of the component, up to its cap. */
function exemptPart(entry: ComponentPaid, ctx: Ctx): string {
  const { component, amount } = entry;
  const { law } = ctx.config;
  const paid = roundDong(entry.paid);
  const capped = (cap: number, words: string) => `${component.name} ${dong(Math.min(paid, cap))} (${words} ${dong(cap)})`;
  if (component.tax.kind === 'exempt') return `${component.name} ${dong(paid)}`;
  if (component.tax.kind !== 'cap') return '';
  if (component.tax.cap === 'meal') return capped(law.mealCap, 'trần');
  if (component.tax.cap === 'regulated') return capped(component.regulatedCap ?? amount, 'mức quy chế');
  const room = Math.max(0, law.clothingCap - (ctx.input.person.clothingExemptBefore ?? 0));
  return capped(room, 'trần năm còn');
}

/** Tiền phép chưa nghỉ in (24): the formula with its numbers, or HR's amount; null when the row has none. */
function leavePayoutText({ input, line }: Ctx): { short: string; full: string } | null {
  const payout = input.income.leavePayout;
  const amount = dong(roundDong(line.income.leavePayout));
  const details = typeof payout === 'object' && 'amount' in payout ? payout : null;
  if (!details?.typed && toNumber(line.income.leavePayout) <= 0) return null;
  const short = `Tiền phép chưa nghỉ ${amount}`;
  if (details?.typed) return { short: `Tiền phép chưa nghỉ (HR gõ) ${amount}`, full: `Tiền phép chưa nghỉ, HR gõ = ${amount}` };
  const { basis } = details ?? {};
  if (!basis) return { short, full: `Tiền phép chưa nghỉ = ${amount}` };
  const formula = `${count(basis.days)} ngày × ${dong(basis.base)} ÷ ${count(basis.norm)} công`;
  return { short, full: `Tiền phép chưa nghỉ ${formula} = ${amount}` };
}

function otherIncomeText(others: readonly string[], leave: { short: string; full: string } | null, total: string) {
  if (!leave) return others.length ? `${others.join(' + ')} = ${total}` : 'Không có = 0';
  return others.length ? `${[...others, leave.short].join(' + ')} = ${total}` : leave.full;
}

function exemptText(ctx: Ctx): string {
  const { line } = ctx;
  const paid = line.income.componentPaid.filter((e) => e.component.tax.kind !== 'taxable' && toNumber(e.paid) > 0);
  const hours = line.tax.overtimeHours;
  const parts = [
    ...paid.map((e) => exemptPart(e, ctx)),
    hours.total > 0 ? `làm thêm trong ${count(hours.exempt)}/${count(hours.total)} giờ` : '',
    toNumber(line.income.otherExempt) > 0 ? `thu nhập khác miễn thuế ${dong(roundDong(line.income.otherExempt))}` : '',
    toNumber(line.income.leavePayout) > 0 ? `tiền phép chưa nghỉ ${dong(roundDong(min(line.income.leavePayout, line.income.leavePayoutExempt)))}` : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(' + ')} = ${dong(line.cells.exempt)}` : 'Không có khoản miễn thuế = 0';
}

const taxedInsurancePaid = (line: PayrollLine): number => (line.insurancePaid?.taxable ? line.insurancePaid.amount : 0);

/** "Công ty trả thay BH" inside (32): the three insurance cells it is the sum of, and whether it is taxed. */
function insurancePaidText({ cells, insurancePaid }: PayrollLine): string {
  if (!insurancePaid) return '';
  const parts = [cells.social, cells.health, cells.unemployment].map(dong).join(' + ');
  const tax = insurancePaid.taxable ? 'tính thuế' : 'chưa tính thuế';
  return ` + Công ty trả thay BH [(28) + (29) + (30) = ${parts} = ${dong(insurancePaid.amount)}, ${tax}]`;
}

/** (40): the brackets slice by slice, 10% of the D02 base, or nothing, with the reason. */
function taxText({ line, input, config }: Ctx): string {
  const { tax, cells } = line;
  const { law } = config;
  if (tax.method === 'none') return `Không khấu trừ · ${tax.methodReason} = 0`;
  if (tax.method === 'flat10') {
    const support = (input.cash?.support ?? 0) + taxedInsurancePaid(line);
    const base = config.options.flatBase === 'taxable' ? cells.taxable : cells.income + (config.options.flatBase === 'income' ? 0 : support);
    if (cells.tax === 0) return `Dưới ngưỡng ${dong(law.flatThreshold)} một lần chi = 0 · ${tax.methodReason}`;
    return `${pct(law.flatRate)} × ${dong(base)} = ${dong(cells.tax)} · ${tax.methodReason}`;
  }
  let floor = 0;
  const slices: string[] = [];
  for (const { upTo, rate } of law.brackets) {
    if (cells.assessable <= floor) break;
    const top = upTo === null ? cells.assessable : Math.min(cells.assessable, upTo);
    slices.push(`${dong(top - floor)} × ${pct(rate)}`);
    floor = upTo ?? cells.assessable;
  }
  return `Lũy tiến trên (38) ${dong(cells.assessable)}: ${slices.join(' + ') || '0'} = ${dong(cells.tax)}`;
}

function taxCells(ctx: Ctx): PayrollCellExplains {
  const { line, input, config } = ctx;
  const { cells } = line;
  const { law } = config;
  const support = input.cash?.support ?? 0;
  const refund = input.cash?.refund ?? 0;
  const advance = input.cash?.advance ?? 0;
  const taxedPaid = taxedInsurancePaid(line);
  const paidPart = taxedPaid ? ` + Công ty trả thay BH ${dong(taxedPaid)}` : '';
  const deductions = refOf(config, 'luat.giam-tru', `${dong(law.deductions.personal)} · NPT ${dong(law.deductions.dependant)}`);
  const methodRef =
    line.tax.method === 'progressive'
      ? refOf(config, 'luat.bieu-thue', `${law.brackets.length} bậc`)
      : refOf(config, line.tax.method === 'none' ? 'tuy-chon.d09' : 'luat.khau-tru-10', line.tax.method === 'none' ? 'không khấu trừ khi có cam kết' : `${pct(law.flatRate)} từ ${dong(law.flatThreshold)}`);
  const clothing = line.income.componentPaid.some((e) => e.component.tax.kind === 'cap' && e.component.tax.cap === 'clothing-year' && toNumber(e.paid) > 0);
  return {
    cash: cell(`Hỗ trợ ${dong(support)} + Hoàn ứng ${dong(refund)} − Tạm ứng ${dong(advance)}${insurancePaidText(line)} = ${dong(cells.cash)}`),
    exempt: cell(exemptText(ctx), [refOf(config, 'luat.tran-tien-an', dong(law.mealCap)), clothing ? refOf(config, 'luat.tran-trang-phuc', dong(law.clothingCap)) : null]),
    taxable: cell(`${dong(cells.income)} + Hỗ trợ ${dong(support)}${paidPart} − ${dong(cells.exempt)} = ${dong(cells.taxable)}`),
    personalDeduction: cell(`Giảm trừ bản thân = ${dong(cells.personalDeduction)}`, [deductions]),
    dependantDeduction: cell(`${input.person.dependants} người phụ thuộc × ${dong(law.deductions.dependant)} = ${dong(cells.dependantDeduction)}`, [deductions]),
    insuranceDeduction: cell(`${[cells.social, cells.health, cells.unemployment].map(dong).join(' + ')} = ${dong(cells.insuranceDeduction)}`),
    assessable: cell(`MAX(0; ${dong(cells.taxable)} − ${dong(cells.personalDeduction)} − ${dong(cells.dependantDeduction)} − ${dong(cells.insuranceDeduction)}) = ${dong(cells.assessable)}`),
    tax: cell(taxText(ctx), [methodRef]),
    totalDeductions: cell(`${[cells.social, cells.health, cells.unemployment, cells.unionFee, cells.tax].map(dong).join(' + ')} = ${dong(cells.totalDeductions)}`),
    netPay: cell(`${dong(cells.income)} − ${dong(cells.totalDeductions)} + ${dong(cells.cash)} = ${dong(cells.netPay)}`),
    totalCost: cell(`${dong(cells.income)} + Hỗ trợ ${dong(support)}${paidPart} + ${dong(cells.companyTotal)} = ${dong(cells.totalCost)}`),
  };
}

const withPersonal = (cells: PayrollCellExplains, settings: readonly PayrollPersonSetting[]): PayrollCellExplains =>
  Object.fromEntries(
    Object.entries(cells).map(([key, value]) => [
      key,
      value && { ...value, refs: [...personalRefs(settings, key as PayrollCellKey), ...value.refs] },
    ]),
  );

/** Every cell's formula and versions, the person's own settings, and the row's note. */
export function explainLine(input: PayrollLineInput, line: PayrollLine, config: PayrollConfig): PayrollLineExplain {
  const ctx: Ctx = { input, line, config };
  const personSettings = personSettingsOf(config);
  const cells = { ...incomeCells(ctx), ...insuranceCells(ctx), ...taxCells(ctx) };
  const method = line.tax.method === 'progressive' ? '' : line.tax.methodReason;
  const note = [line.insurance.status.note, method].filter(Boolean).join(' · ');
  return { cells: withPersonal(cells, personSettings), personSettings, note };
}
