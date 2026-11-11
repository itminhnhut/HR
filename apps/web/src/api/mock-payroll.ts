import {
  computeLine,
  DEFAULT_CONTRACT_TYPES,
  EMPTY_MONTH_INPUTS,
  explainLine,
  kpiPercentError,
  payrollConfigFor,
  payrollDates,
  payrollTotals,
  periodMonthOf,
  reviewPayroll,
  sortPayrollRows,
  standardPeriod,
  todayInVietnam,
  type PayrollLine,
  type PayrollLineInput,
  type PayrollMonthInputsDto,
  type ReviewRowInput,
  type SettingRow,
} from '@careers/shared';
import { GOLDEN_PEOPLE, type GoldenPerson } from '../../../../packages/shared/test-fixtures/payroll-golden';
import { GOLDEN_MONTH, goldenInput } from '../../../../packages/shared/test-fixtures/payroll-golden-inputs';
import { DEMO_HR } from './demo-accounts';
import { nextInputs, parseInputs, seededInputs, typedOverrides, withInputs, withProfile } from './mock-payroll-inputs';
import { payrollLogMockApi, writeMockPayrollLog } from './mock-payroll-log';
import { profileMockApi } from './mock-payroll-profiles';
import { settingsMockApi } from './mock-payroll-settings';
import type { MockDb, MockHrUser, MockPayrollMonthState, MockPayrollProfile } from './mock-seed';
import { delay, fail, load, requireHr, save } from './mock-store';
import type {
  PayrollApproveInput,
  PayrollLineDto,
  PayrollMarkPaidInput,
  PayrollMonthDto,
  PayrollMonthInputsInput,
  PayrollMonthInputsResultDto,
  PayrollReopenInput,
} from './types';

/**
 * The demo's Lương: one month, the anonymous golden month of the test catalogue (docs/test-cases-luong.md, K3),
 * computed by the engine itself so every number on screen is real engine output. Two changes on top, both from the
 * catalogue: NV A pays tax on meals from T10 (a setting of their own, L-L03) and HR typed 0% over NV J's computed
 * % KPI (the 0% of HR's file, L-L04). Rà soát is the engine's own (spec 11.3); Duyệt, Mở lại, Đã chuyển khoản and
 * the month inputs HR types are kept in the demo database. Later months wait for the timesheet close.
 */

const FIRST_MONTH = '2026-10';
const MONTHS_AHEAD = 12;

const REGIONS: PayrollMonthDto['regions'] = [
  { id: 'hcm', name: 'Hồ Chí Minh', tone: 'blue' },
  { id: 'hn', name: 'Hà Nội', tone: 'rose' },
];
const CONTRACT_TYPES = DEFAULT_CONTRACT_TYPES.map((t) => ({ id: t.id, name: t.name }));

/** Block of each golden person, from the catalogue's K3 table. */
const BLOCKS: Record<string, 'BO' | 'KD'> = {
  'NV A': 'BO',
  'NV B': 'BO',
  'NV C': 'KD',
  'NV D': 'KD',
  'NV E': 'KD',
  'NV F': 'KD',
  'NV G': 'BO',
  'NV H': 'BO',
  'NV I': 'BO',
  'NV J': 'KD',
  'NV K': 'KD',
  'NV L': 'KD',
};
const DEPARTMENTS = { BO: 'Hành chính', KD: 'Kinh doanh' } as const;

const OWN_SETTINGS: SettingRow[] = [
  {
    key: 'khoan.com.thue',
    employeeId: 'NV A',
    from: FIRST_MONTH,
    value: { kind: 'taxable' },
    source: 'Demo: quyết định riêng',
  },
];

const TYPED_AT = '2026-11-03T02:00:00.000Z';

const keyOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const monthName = (key: string) => `T${Number(key.slice(5))}/${key.slice(0, 4)}`;
const money = (amount: number) => String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

type InputsByPerson = Record<string, PayrollMonthInputsDto>;
type Profiles = Record<string, MockPayrollProfile>;

const employeeIdOf = (person: GoldenPerson) => `nv-${person.id.slice(3).toLowerCase()}`;

function lineOf(person: GoldenPerson, index: number, typed: InputsByPerson, profiles: Profiles) {
  const employeeId = employeeIdOf(person);
  const inputs = typed[employeeId] ?? EMPTY_MONTH_INPUTS;
  const golden = withProfile(goldenInput(person, { asHrFile: false }), profiles[employeeId], GOLDEN_MONTH);
  const input = withInputs(golden, inputs);
  const config = payrollConfigFor(OWN_SETTINGS, person.id, GOLDEN_MONTH);
  const line = computeLine(input, config);
  const explain = explainLine(input, line, config);
  const block = BLOCKS[person.id] ?? null;
  const dto: PayrollLineDto = {
    employeeId,
    code: `NV${String(index + 1).padStart(2, '0')}`,
    fullName: person.id,
    department: block ? DEPARTMENTS[block] : '',
    regionId: person.region === 'HN' ? 'hn' : 'hcm',
    contractTypeId: person.contract,
    block,
    probation: person.contract === 'thu-viec',
    norm: person.norm,
    amounts: { ...line.amounts },
    kpiAmount: person.kpiAmount,
    cells: {
      ...line.cells,
      overtimeHours: line.overtime.weekdayHours,
      restDays: line.overtime.restDays,
      holidayDays: line.overtime.holidayDays,
    },
    explain: explain.cells,
    overrides: typedOverrides(inputs, line),
    personSettings: explain.personSettings,
    note: explain.note,
    inputs,
  };
  return { line, dto, review: reviewRowOf(person, input, line, { employeeId, restDaysTyped: inputs.restDays }) };
}

/** What Rà soát reads about a golden person: the closing is the person's days, every profile field is filled. */
function reviewRowOf(
  person: GoldenPerson,
  input: PayrollLineInput,
  line: PayrollLine,
  { employeeId, restDaysTyped }: { employeeId: string; restDaysTyped: number | null },
): ReviewRowInput {
  const config = payrollConfigFor(OWN_SETTINGS, person.id, GOLDEN_MONTH);
  return {
    employeeId,
    label: person.id,
    line,
    config,
    closing: { paid: person.days, norm: person.norm, overtime: 0, sundayWorked: 0, leaveClosing: 0, leaveOverdrawn: 0 },
    employment: {
      leftOn: person.leftOn,
      contractTypeId: person.contract,
      block: BLOCKS[person.id] ?? null,
      unconfirmedDates: [],
    },
    profile: { exists: true, gap: null },
    inputs: { restDaysTyped, paidDaysTyped: null, overtimeHoursBefore: 0 },
    person: {
      hasCommitment: input.person.hasCommitment,
      commitmentYear: input.person.hasCommitment ? config.dates.taxYear : null,
      hasBankAccount: true,
    },
    previous: null,
  };
}

function monthShell(
  year: number,
  month: number,
): Omit<PayrollMonthDto, 'status' | 'lines' | 'totals' | 'computedAt' | 'review'> {
  const dates = payrollDates(year, month);
  const components = payrollConfigFor([], null, dates).components.map((c) => ({ id: c.id, name: c.name }));
  return {
    year,
    month,
    monthKey: dates.monthKey,
    period: standardPeriod(year, month),
    payDate: dates.payDate,
    approval: null,
    paidOn: null,
    components,
    regions: REGIONS,
    contractTypes: CONTRACT_TYPES,
  };
}

/** What HR typed in a month; the first month starts with NV J's typed % KPI. */
function inputsOf(db: MockDb, key: string): InputsByPerson {
  const stored = db.payrollInputs?.[key];
  if (stored) return stored;
  return key === FIRST_MONTH ? seededInputs(DEMO_HR.name, TYPED_AT) : {};
}

/**
 * The golden month computed with what HR typed and what the demo profiles hold ((32) "Công ty trả thay BH", signed
 * commitments): every number is the engine's answer to the inputs stored.
 */
function goldenMonth(typed: InputsByPerson, profiles: Profiles = load().payrollProfiles ?? {}): PayrollMonthDto {
  const built = GOLDEN_PEOPLE.map((p, i) => lineOf(p, i, typed, profiles));
  const rows = built.map(({ dto }) => ({
    ...dto,
    regionOrder: dto.regionId === 'hcm' ? 0 : 1,
    contractTypeId: dto.contractTypeId,
  }));
  const ordered = sortPayrollRows(rows, DEFAULT_CONTRACT_TYPES).map(({ regionOrder: _, ...dto }) => dto);
  const totals = payrollTotals(
    built.map((b) => b.line),
    'cell',
  );
  // The demo month is the first month on the web and nobody confirmed its timesheet closing yet: one red warning.
  const review = reviewPayroll({
    rows: built.map((b) => b.review),
    previousMonthDraft: false,
    retroPending: 0,
    firstWebMonth: true,
    closingConfirmed: false,
  });
  return {
    ...monthShell(GOLDEN_MONTH.year, GOLDEN_MONTH.month),
    status: 'draft',
    computedAt: TYPED_AT,
    lines: ordered,
    totals,
    review,
  };
}

const DRAFT: MockPayrollMonthState = { status: 'draft', approval: null, lastApprovalNo: 0, paidOn: null };

const stateOf = (db: MockDb, key: string): MockPayrollMonthState => db.payrollMonths?.[key] ?? DRAFT;

function withState(db: MockDb, key: string): PayrollMonthDto {
  const { status, approval, paidOn } = stateOf(db, key);
  return { ...goldenMonth(inputsOf(db, key)), status, approval, paidOn };
}

function store(db: MockDb, key: string, next: MockPayrollMonthState): PayrollMonthDto {
  db.payrollMonths = { ...db.payrollMonths, [key]: next };
  save();
  return withState(db, key);
}

/** The signed-in HR with the payroll right (and the approve right when asked), or the API's refusal. */
function payrollUser(db: MockDb, needsApprove: boolean): MockHrUser | null {
  const me = requireHr(db);
  if (me.canPayroll === false) return null;
  return needsApprove && me.canApprovePayroll === false ? null : me;
}

/** The month an action can touch: only the demo's computed month has lines to approve. */
async function actionMonth(year: number, month: number, needsApprove: boolean) {
  const db = load();
  const me = payrollUser(db, needsApprove);
  if (!me) return fail(403, needsApprove ? 'Bạn không có quyền duyệt lương.' : 'Bạn không có quyền xem lương.');
  const key = keyOf(year, month);
  if (key !== FIRST_MONTH) return fail(409, `${monthName(key)} chưa chốt công, chưa có bảng lương để làm việc này.`);
  return { db, me, key, state: stateOf(db, key) };
}

/** The last month the demo answers: a year after the current period. */
function lastMonth(): string {
  const { year, month } = periodMonthOf(todayInVietnam());
  const ahead = year * 12 + (month - 1) + MONTHS_AHEAD;
  return keyOf(Math.floor(ahead / 12), (ahead % 12) + 1);
}

export const payrollMockApi = {
  ...profileMockApi(() => goldenMonth(inputsOf(load(), FIRST_MONTH)).lines),
  ...settingsMockApi,
  ...payrollLogMockApi,

  async hrPayrollMonth(year: number, month: number): Promise<PayrollMonthDto> {
    const me = requireHr(load());
    if (me.canPayroll === false) return fail(403, 'Bạn không có quyền xem lương.');
    const key = keyOf(year, month);
    const last = lastMonth();
    if (key < FIRST_MONTH || key > last)
      return fail(404, `Có bảng lương từ ${monthName(FIRST_MONTH)} đến ${monthName(last)}.`);
    if (key === FIRST_MONTH) return delay(withState(load(), key));
    return delay({
      ...monthShell(year, month),
      status: 'waiting',
      computedAt: null,
      lines: [],
      totals: {},
      review: [],
    });
  },

  /** Đầu vào tháng of one person: partial, lists replaced whole; 409 once approved or paid, 422 as the API checks. */
  async hrPayrollSaveInputs(
    key: string,
    employeeId: string,
    raw: PayrollMonthInputsInput,
  ): Promise<PayrollMonthInputsResultDto> {
    const db = load();
    const me = payrollUser(db, false);
    if (!me) return fail(403, 'Bạn không có quyền xem lương.');
    if (!/^\d{4}-\d{2}$/.test(key) || key < FIRST_MONTH || key > lastMonth())
      return fail(404, 'Không có kỳ lương này.');
    if (!GOLDEN_PEOPLE.some((p) => employeeIdOf(p) === employeeId)) return fail(404, 'Không có người này.');
    const { status } = stateOf(db, key);
    if (status === 'approved' || status === 'paid') {
      const words = `${monthName(key)} đã duyệt, chỉ xem. Muốn sửa: Mở lại hoặc truy lĩnh / truy thu ở tháng sau.`;
      return fail(409, words, {}, 'payroll_month_locked');
    }
    const patch = parseInputs(raw);
    const typed = inputsOf(db, key);
    const row = key === FIRST_MONTH ? goldenMonth(typed).lines.find((l) => l.employeeId === employeeId) : undefined;
    const kpiError =
      patch.kpiPercent === undefined || patch.kpiPercent === null || !row
        ? null
        : kpiPercentError(patch.kpiPercent, row.kpiAmount);
    if (kpiError) return fail(422, kpiError, { kpiPercent: kpiError });
    const before = typed[employeeId] ?? EMPTY_MONTH_INPUTS;
    const inputs = nextInputs(before, patch, me.name ?? me.email, new Date().toISOString());
    const next = { ...typed, [employeeId]: inputs };
    db.payrollInputs = { ...db.payrollInputs, [key]: next };
    save();
    const line =
      key === FIRST_MONTH ? (goldenMonth(next).lines.find((l) => l.employeeId === employeeId) ?? null) : null;
    return delay({ inputs, line });
  },

  async hrPayrollApprove(year: number, month: number, input: PayrollApproveInput): Promise<PayrollMonthDto> {
    const { db, me, key, state } = await actionMonth(year, month, true);
    if (state.status !== 'draft') return fail(409, `${monthName(key)} đã duyệt, không duyệt lại được.`);
    const hasRed = goldenMonth(inputsOf(db, key)).review.some((i) => i.level === 'red');
    if (hasRed && !input.acknowledgedRed) return fail(422, 'Tích "Đã xem cảnh báo đỏ" trước khi duyệt.');
    const no = state.lastApprovalNo + 1;
    const approval = { no, at: new Date().toISOString(), by: me.name ?? me.email };
    const { lines, totals } = goldenMonth(inputsOf(db, key));
    const detail = `Duyệt lần ${no}: ${lines.length} người, thực nhận ${money(totals.netPay ?? 0)}`;
    writeMockPayrollLog(db, me, { area: 'bang-luong', action: 'Duyệt', detail, month: key });
    return delay(store(db, key, { status: 'approved', approval, lastApprovalNo: no, paidOn: null }));
  },

  async hrPayrollReopen(year: number, month: number, input: PayrollReopenInput): Promise<PayrollMonthDto> {
    const { db, me, key, state } = await actionMonth(year, month, true);
    if (state.status === 'paid')
      return fail(409, `${monthName(key)} đã chuyển khoản, không mở lại được. Dùng truy lĩnh / truy thu ở tháng sau.`);
    if (state.status !== 'approved') return fail(409, `${monthName(key)} chưa duyệt, không có gì để mở lại.`);
    if (!input.reason.trim()) return fail(422, 'Ghi lý do mở lại.', { reason: 'Ghi lý do mở lại.' });
    const detail = `Mở lại bản duyệt lần ${state.approval?.no ?? '?'}, lý do: ${input.reason.trim()}`;
    writeMockPayrollLog(db, me, { area: 'bang-luong', action: 'Mở lại', detail, month: key });
    return delay(store(db, key, { ...state, status: 'draft', approval: null }));
  },

  async hrPayrollMarkPaid(year: number, month: number, input: PayrollMarkPaidInput): Promise<PayrollMonthDto> {
    const { db, me, key, state } = await actionMonth(year, month, false);
    if (state.status !== 'approved') return fail(409, `Chỉ đánh dấu đã chuyển khoản cho tháng đã duyệt.`);
    const isDay = /^\d{4}-\d{2}-\d{2}$/.test(input.paidOn) && !Number.isNaN(Date.parse(input.paidOn));
    if (!isDay) return fail(422, 'Chọn ngày chuyển khoản.', { paidOn: 'Chọn ngày chuyển khoản.' });
    const paidDay = input.paidOn.split('-').reverse().join('/');
    const detail = `Bản duyệt lần ${state.approval?.no ?? '?'}, chuyển khoản ngày ${paidDay}`;
    writeMockPayrollLog(db, me, { area: 'bang-luong', action: 'Đã chuyển khoản', detail, month: key });
    return delay(store(db, key, { ...state, status: 'paid', paidOn: input.paidOn }));
  },
};
