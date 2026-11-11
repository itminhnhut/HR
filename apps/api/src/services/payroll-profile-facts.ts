import {
  fieldErrors,
  payrollCommitmentSchema,
  payrollDependantSchema,
  payrollOpeningSchema,
  payrollRecurringSchema,
  PAYROLL_INSURANCE_PAID,
  type HrMe,
  type PayrollCommitmentDto,
  type PayrollDependantDto,
  type PayrollOpeningDto,
  type PayrollRecurringDto,
} from '@careers/shared';
import { and, eq, ne } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/index.js';
import { payrollDependants, payrollOpening, payrollRecurringItems, payrollTaxCommitments } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { writePayrollLog } from './payroll-log.js';
import { personOf, type Employee } from './payroll-profile-store.js';
import { dateWords, moneyWords, monthWords, personWords, valueWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Facts about one person besides the levels (spec-luong.md 10.2, 11.5): dependants by month, a tax commitment by tax
 * year, khoản (32) định kỳ by month, opening balances by tax year. Each change is a line of the payroll log.
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    throw invalid(Object.values(errors)[0] ?? 'Kiểm tra lại.', errors);
  }
  return parsed.data;
}

async function log(tx: Pick<Db, 'insert'>, hr: HrMe, now: Date, action: string, detail: string, month: string | null) {
  await writePayrollLog(tx, { area: 'ho-so', actor: actorOf(hr), action, detail, month, at: now });
}

const rangeWords = (from: string, to: string | null | undefined) =>
  to ? `từ ${monthWords(from)} đến ${monthWords(to)}` : `từ ${monthWords(from)}`;

const dependantWords = (d: { count: number; fromMonth: string; toMonth?: string | null }) =>
  `${d.count} người, ${rangeWords(d.fromMonth, d.toMonth)}`;

export const dependantDtoOf = (d: typeof payrollDependants.$inferSelect): PayrollDependantDto => ({
  id: d.id,
  fromMonth: d.fromMonth,
  toMonth: d.toMonth,
  count: d.count,
});

async function own<T extends { employeeId: string }>(rows: Promise<T[]>, person: Employee): Promise<T> {
  const [row] = await rows;
  if (!row || row.employeeId !== person.id) throw notFound('Không tìm thấy dòng này.');
  return row;
}

const idOf = (id: string) => (isUuid(id) ? id : '00000000-0000-0000-0000-000000000000');

/** Thêm, sửa, xoá người phụ thuộc (L-B18–L-B20). `id` null adds; `raw` null deletes. */
export async function saveDependant(
  db: Db,
  employeeId: string,
  id: string | null,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollDependantDto | null> {
  const person = await personOf(db, employeeId);
  const input = raw === null ? null : parse(payrollDependantSchema, raw);
  const whose = `người phụ thuộc của ${personWords(person)}`;
  return db.transaction(async (tx) => {
    const before = id
      ? await own(
          tx
            .select()
            .from(payrollDependants)
            .where(eq(payrollDependants.id, idOf(id))),
          person,
        )
      : null;
    if (!input) {
      if (!before) throw notFound('Không tìm thấy dòng này.');
      await tx.delete(payrollDependants).where(eq(payrollDependants.id, before.id));
      await log(tx, hr, now, 'Xoá', `Xoá ${whose}: ${dependantWords(before)}`, before.fromMonth);
      return null;
    }
    const values = { fromMonth: input.fromMonth, toMonth: input.toMonth ?? null, count: input.count };
    const [row] = before
      ? await tx.update(payrollDependants).set(values).where(eq(payrollDependants.id, before.id)).returning()
      : await tx
          .insert(payrollDependants)
          .values({ ...values, employeeId: person.id, createdBy: actorOf(hr) })
          .returning();
    if (!row) throw notFound('Không lưu được.');
    const detail = before
      ? `Sửa ${whose}: ${dependantWords(before)} → ${dependantWords(row)}`
      : `Thêm ${whose}: ${dependantWords(row)}`;
    await log(tx, hr, now, before ? 'Sửa' : 'Thêm', detail, row.fromMonth);
    return dependantDtoOf(row);
  });
}

export const commitmentDtoOf = (c: typeof payrollTaxCommitments.$inferSelect): PayrollCommitmentDto => ({
  id: c.id,
  year: c.year,
  signedOn: c.signedOn,
});

const commitmentWords = (c: { year: number; signedOn: string }) => `năm ${c.year}, ký ${dateWords(c.signedOn)}`;

/** Cam kết thuế (L-B21): one per tax year. */
export async function saveCommitment(
  db: Db,
  employeeId: string,
  id: string | null,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollCommitmentDto | null> {
  const person = await personOf(db, employeeId);
  const input = raw === null ? null : parse(payrollCommitmentSchema, raw);
  const whose = `cam kết thuế của ${personWords(person)}`;
  return db.transaction(async (tx) => {
    const t = payrollTaxCommitments;
    const before = id
      ? await own(
          tx
            .select()
            .from(t)
            .where(eq(t.id, idOf(id))),
          person,
        )
      : null;
    if (!input) {
      if (!before) throw notFound('Không tìm thấy dòng này.');
      await tx.delete(t).where(eq(t.id, before.id));
      await log(tx, hr, now, 'Xoá', `Xoá ${whose}: ${commitmentWords(before)}`, null);
      return null;
    }
    const [taken] = await tx
      .select()
      .from(t)
      .where(and(eq(t.employeeId, person.id), eq(t.year, input.year)));
    if (taken && taken.id !== before?.id) {
      throw new HttpError(409, `Đã có cam kết năm ${input.year}.`, {}, 'payroll_commitment_taken');
    }
    const [row] = before
      ? await tx.update(t).set(input).where(eq(t.id, before.id)).returning()
      : await tx
          .insert(t)
          .values({ ...input, employeeId: person.id, createdBy: actorOf(hr) })
          .returning();
    if (!row) throw notFound('Không lưu được.');
    const detail = before
      ? `Sửa ${whose}: ${commitmentWords(before)} → ${commitmentWords(row)}`
      : `Thêm ${whose}: ${commitmentWords(row)}`;
    await log(tx, hr, now, before ? 'Sửa' : 'Thêm', detail, null);
    return commitmentDtoOf(row);
  });
}

export const recurringDtoOf = (r: typeof payrollRecurringItems.$inferSelect): PayrollRecurringDto => ({
  id: r.id,
  kind: r.kind,
  amount: r.amount,
  taxable: r.taxable,
  fromMonth: r.fromMonth,
  toMonth: r.toMonth,
  note: r.note,
});

const KIND_WORDS = { support: 'Hỗ trợ', refund: 'Hoàn ứng', advance: 'Tạm ứng' } as const;

/** "Hỗ trợ 500.000 đ"; the insurance paid back has no amount, only whether it is taxed. */
export const recurringKindWords = (r: Pick<PayrollRecurringDto, 'kind' | 'amount' | 'taxable'>): string =>
  r.kind === PAYROLL_INSURANCE_PAID
    ? `Công ty trả thay BH (${r.taxable ? 'tính thuế' : 'chưa tính thuế'})`
    : `${KIND_WORDS[r.kind]} ${moneyWords(r.amount)}`;

const recurringWords = (r: Omit<PayrollRecurringDto, 'id'>) =>
  `${recurringKindWords(r)}, ${rangeWords(r.fromMonth, r.toMonth)}${r.note ? ` (${r.note})` : ''}`;

type RecurringRow = typeof payrollRecurringItems.$inferSelect;
const overlaps = (a: Pick<RecurringRow, 'fromMonth' | 'toMonth'>, b: Pick<RecurringRow, 'fromMonth' | 'toMonth'>) =>
  (!a.toMonth || b.fromMonth <= a.toMonth) && (!b.toMonth || a.fromMonth <= b.toMonth);

/** The insurance is paid back once a month: two such items never share a month. */
async function refuseSecondInsurancePaid(
  tx: Tx,
  person: Employee,
  values: Pick<RecurringRow, 'kind' | 'fromMonth' | 'toMonth'>,
  ownId: string | undefined,
) {
  if (values.kind !== PAYROLL_INSURANCE_PAID) return;
  const t = payrollRecurringItems;
  const others = await tx
    .select()
    .from(t)
    .where(and(eq(t.employeeId, person.id), eq(t.kind, PAYROLL_INSURANCE_PAID), ...(ownId ? [ne(t.id, ownId)] : [])));
  if (!others.some((o) => overlaps(o, values))) return;
  throw new HttpError(409, 'Đã có khoản công ty trả thay BH trong các tháng này.', {}, 'payroll_insurance_paid_taken');
}

/** Khoản (32) định kỳ (câu 4): support unless HR chose refund or advance. */
export async function saveRecurring(
  db: Db,
  employeeId: string,
  id: string | null,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollRecurringDto | null> {
  const person = await personOf(db, employeeId);
  const input = raw === null ? null : parse(payrollRecurringSchema, raw);
  const whose = `khoản (32) định kỳ của ${personWords(person)}`;
  return db.transaction(async (tx) => {
    const t = payrollRecurringItems;
    const before = id
      ? await own(
          tx
            .select()
            .from(t)
            .where(eq(t.id, idOf(id))),
          person,
        )
      : null;
    if (!input) {
      if (!before) throw notFound('Không tìm thấy dòng này.');
      await tx.delete(t).where(eq(t.id, before.id));
      await log(tx, hr, now, 'Xoá', `Xoá ${whose}: ${recurringWords(before)}`, before.fromMonth);
      return null;
    }
    const values = { ...input, toMonth: input.toMonth ?? null };
    await refuseSecondInsurancePaid(tx, person, values, before?.id);
    const [row] = before
      ? await tx.update(t).set(values).where(eq(t.id, before.id)).returning()
      : await tx
          .insert(t)
          .values({ ...values, employeeId: person.id, createdBy: actorOf(hr) })
          .returning();
    if (!row) throw notFound('Không lưu được.');
    const detail = before
      ? `Sửa ${whose}: ${recurringWords(before)} → ${recurringWords(row)}`
      : `Thêm ${whose}: ${recurringWords(row)}`;
    await log(tx, hr, now, before ? 'Sửa' : 'Thêm', detail, row.fromMonth);
    return recurringDtoOf(row);
  });
}

export const openingDtoOf = (o: typeof payrollOpening.$inferSelect): PayrollOpeningDto => ({
  taxYear: o.taxYear,
  taxableIncome: o.taxableIncome,
  taxWithheld: o.taxWithheld,
  overtimeHours: o.overtimeHours,
  clothingPaid: o.clothingPaid,
  monthsPaid: o.monthsPaid,
});

const OPENING_WORDS = {
  taxableIncome: 'thu nhập chịu thuế',
  taxWithheld: 'thuế đã khấu trừ',
  overtimeHours: 'giờ làm thêm',
  clothingPaid: 'trang phục đã trả',
  monthsPaid: 'số tháng đã trả',
} as const;
type OpeningField = keyof typeof OPENING_WORDS;
const OPENING_FIELDS = Object.keys(OPENING_WORDS) as OpeningField[];

function openingChange(before: PayrollOpeningDto | null, after: Omit<PayrollOpeningDto, 'taxYear'>): string {
  const parts = OPENING_FIELDS.filter((f) => !before || before[f] !== after[f]).map((f) =>
    before
      ? `${OPENING_WORDS[f]} ${valueWords(before[f])} → ${valueWords(after[f])}`
      : `${OPENING_WORDS[f]} ${valueWords(after[f])}`,
  );
  return parts.join(', ') || 'không đổi';
}

function taxYearOf(raw: string): number {
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw invalid('Năm thuế không hợp lệ.');
  return year;
}

/** Số dư đầu năm thuế (câu 34, L-E07). `raw` null deletes. */
export async function saveOpening(
  db: Db,
  employeeId: string,
  yearText: string,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollOpeningDto | null> {
  const person = await personOf(db, employeeId);
  const taxYear = taxYearOf(yearText);
  const input = raw === null ? null : parse(payrollOpeningSchema, raw);
  const head = `số dư đầu năm ${taxYear} của ${personWords(person)}`;
  return db.transaction(async (tx: Tx) => {
    const t = payrollOpening;
    const where = and(eq(t.employeeId, person.id), eq(t.taxYear, taxYear));
    const [found] = await tx.select().from(t).where(where).for('update');
    const before = found ? openingDtoOf(found) : null;
    if (!input) {
      await tx.delete(t).where(where);
      if (before) await log(tx, hr, now, 'Xoá', `Xoá ${head}`, null);
      return null;
    }
    const values = { ...input, updatedBy: actorOf(hr), updatedAt: now };
    const [row] = found
      ? await tx.update(t).set(values).where(where).returning()
      : await tx
          .insert(t)
          .values({ ...values, employeeId: person.id, taxYear })
          .returning();
    if (!row) throw notFound('Không lưu được.');
    await log(
      tx,
      hr,
      now,
      before ? 'Sửa' : 'Thêm',
      `${before ? 'Sửa' : 'Thêm'} ${head}: ${openingChange(before, input)}`,
      null,
    );
    return openingDtoOf(row);
  });
}
