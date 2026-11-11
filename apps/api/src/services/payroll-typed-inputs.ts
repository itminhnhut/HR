import {
  fieldErrors,
  kpiPercentError,
  payrollMonthInputsSchema,
  type HrMe,
  type PayrollCashItemDto,
  type PayrollMonthInputsDto,
  type PayrollMonthDto,
  type PayrollMonthInputsResultDto,
  type PayrollOtherIncomeDto,
  type PayrollRetroInputDto,
  type PayrollRetroItemDto,
  type PayrollCashKind,
} from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { payrollMonthInputs } from '../db/schema.js';
import { HttpError, invalid } from '../lib/http-error.js';
import { writePayrollLog } from './payroll-log.js';
import { typedInputsOf } from './payroll-month-facts.js';
import { payrollMonthOf } from './payroll-month.js';
import { personOf, type Reader } from './payroll-profile-store.js';
import { moneyWords, monthWords, personWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Đầu vào tháng (spec-luong.md 2 (4), 5.3 (19), (21)–(24), (32); step 15): the numbers only HR knows, typed per person
 * and payroll month while the month is not approved. Each save is one line of the payroll log, old → new per field.
 */

type Values = Required<Omit<PayrollMonthInputsDto, 'updatedBy' | 'updatedAt'>>;
type Field = keyof Values;

const decimal = (n: number) => String(n).replace('.', ',');
const orEmpty = (words: string) => words || 'trống';
const KIND_WORDS: Record<PayrollCashKind, string> = {
  support: 'Hỗ trợ',
  refund: 'Hoàn ứng',
  advance: 'Tạm ứng',
};
const why = (reason: string) => (reason ? ` (${reason})` : '');
const otherWords = (o: PayrollOtherIncomeDto) =>
  `${moneyWords(o.amount)} ${o.taxable ? 'chịu thuế' : 'miễn thuế'}${why(o.reason)}`;
const cashWords = (c: PayrollCashItemDto) => `${KIND_WORDS[c.kind]} ${moneyWords(c.amount)}${why(c.reason)}`;
const retroWords = (r: PayrollRetroInputDto) =>
  `${monthWords(r.origin)} ${r.amount === 0 ? 'bỏ ra' : `gõ ${moneyWords(r.amount)}`}${why(r.reason)}`;
const nullable = (n: number | null, words: (n: number) => string) => (n === null ? 'trống' : words(n));

/** How the log writes each field: its label and its value in words. */
const FIELDS: { [K in Field]: [string, (v: Values[K]) => string] } = {
  kpiPercent: ['% KPI', (v) => nullable(v, (n) => `${decimal(Math.round(n * 10_000) / 100)}%`)],
  overtimeHours: ['giờ làm thêm ngày thường', decimal],
  restDays: ['công làm thêm ngày nghỉ', (v) => nullable(v, decimal)],
  holidayDays: ['công làm lễ', (v) => nullable(v, decimal)],
  otherIncome: ['thu nhập khác', (v) => orEmpty(v.map(otherWords).join(', '))],
  cash: ['hỗ trợ / hoàn ứng / tạm ứng', (v) => orEmpty(v.map(cashWords).join(', '))],
  leavePayout: ['tiền phép chưa nghỉ', (v) => (v === null ? 'theo số tính' : moneyWords(v))],
  retro: ['truy lĩnh / truy thu', (v) => (v.length ? v.map(retroWords).join(', ') : 'theo số tính')],
  note: ['ghi chú', (v) => (v ? `"${v}"` : 'trống')],
};

function changeOf<K extends Field>(field: K, before: Values, after: Values): string | null {
  if (JSON.stringify(before[field]) === JSON.stringify(after[field])) return null;
  const [label, words] = FIELDS[field];
  return `${label} ${words(before[field])} → ${words(after[field])}`;
}

function parse(raw: unknown) {
  const parsed = payrollMonthInputsSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    throw invalid(Object.values(errors)[0] ?? 'Kiểm tra lại.', errors);
  }
  return parsed.data;
}

async function storedOf(db: Reader, year: number, month: number, employeeId: string) {
  const [row] = await db
    .select()
    .from(payrollMonthInputs)
    .where(
      and(
        eq(payrollMonthInputs.year, year),
        eq(payrollMonthInputs.month, month),
        eq(payrollMonthInputs.employeeId, employeeId),
      ),
    );
  return row;
}

/** L-D08: a % only for someone whose row has a KPI; a month still waiting has no row to check yet. */
function checkKpi(values: Values, kpiAmount: number | undefined) {
  if (values.kpiPercent === null || kpiAmount === undefined) return;
  const error = kpiPercentError(values.kpiPercent, kpiAmount);
  if (error) throw invalid(error, { kpiPercent: error });
}

/**
 * Each amount marked when it is typed over a difference the month computes (a computed item has cells; one added
 * by hand has none), or was marked so before: it is never paid as one added by hand once that difference is gone.
 */
function markedRetro(
  typed: readonly PayrollRetroInputDto[],
  before: readonly PayrollRetroInputDto[],
  items: readonly PayrollRetroItemDto[],
): PayrollRetroInputDto[] {
  const isOver = (origin: string) =>
    items.some((i) => i.origin === origin && Object.keys(i.cells).length > 0) ||
    before.some((b) => b.origin === origin && b.overComputed);
  return typed.map(({ overComputed: _o, ...input }) =>
    isOver(input.origin) ? { ...input, overComputed: true } : input,
  );
}

/** 409 once the month is approved or paid: it is only read. */
function checkOpen(month: Pick<PayrollMonthDto, 'status'>, key: string) {
  if (month.status !== 'approved' && month.status !== 'paid') return;
  throw new HttpError(
    409,
    `${monthWords(key)} đã duyệt, chỉ xem. Muốn sửa: Mở lại hoặc truy lĩnh / truy thu ở tháng sau.`,
    {},
    'payroll_month_locked',
  );
}

export interface SaveTypedInputsArgs {
  key: string;
  employeeId: string;
  raw: unknown;
  hr: HrMe;
  now: Date;
}

/** `PUT /months/:YYYY-MM/lines/:employeeId/inputs`: partial; 409 once the month is approved or paid. */
export async function saveTypedInputs(db: Db, args: SaveTypedInputsArgs): Promise<PayrollMonthInputsResultDto> {
  const { key, employeeId, hr, now } = args;
  const patch = parse(args.raw);
  const person = await personOf(db, employeeId);
  const month = await payrollMonthOf(db, key, now);
  checkOpen(month, key);
  const where = { year: month.year, month: month.month, employeeId: person.id };
  await db.transaction(async (tx) => {
    const {
      updatedBy: _by,
      updatedAt: _at,
      ...stored
    } = typedInputsOf(await storedOf(tx, where.year, where.month, where.employeeId));
    const before: Values = { ...stored, leavePayout: stored.leavePayout ?? null, retro: stored.retro ?? [] };
    const mine = (month.retro ?? []).filter((i) => i.employeeId === person.id);
    const retro = patch.retro ? markedRetro(patch.retro, before.retro, mine) : before.retro;
    const after: Values = { ...before, ...patch, retro };
    if (patch.kpiPercent !== undefined) {
      checkKpi(after, month.lines.find((l) => l.employeeId === person.id)?.kpiAmount);
    }
    const changes = (Object.keys(FIELDS) as Field[]).flatMap((f) => changeOf(f, before, after) ?? []);
    if (changes.length === 0) return;
    const row = { ...where, ...after, updatedBy: actorOf(hr), updatedAt: now };
    await tx
      .insert(payrollMonthInputs)
      .values(row)
      .onConflictDoUpdate({
        target: [payrollMonthInputs.year, payrollMonthInputs.month, payrollMonthInputs.employeeId],
        set: { ...after, updatedBy: row.updatedBy, updatedAt: now },
      });
    const detail = `${personWords(person)}: ${changes.join('; ')}`;
    await writePayrollLog(tx, {
      area: 'bang-luong',
      actor: actorOf(hr),
      action: 'Sửa đầu vào tháng',
      detail,
      month: key,
      at: now,
    });
  });
  const inputs = typedInputsOf(await storedOf(db, where.year, where.month, where.employeeId));
  const fresh = await payrollMonthOf(db, key, now);
  return { inputs, line: fresh.lines.find((l) => l.employeeId === person.id) ?? null };
}
