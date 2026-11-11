import { fieldErrors, payrollBankSchema, type HrMe, type PayrollBankAccountDto } from '@careers/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { payrollBankAccounts } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { openAccount, sealAccount, type PayrollKey } from '../lib/payroll-crypto.js';
import { isUuid } from '../lib/request.js';
import { writePayrollLog } from './payroll-log.js';
import { personOf, type Employee } from './payroll-profile-store.js';
import { dateWords, personWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Ngân hàng, số tài khoản (spec-luong.md 10.2, 11.5; L-B24). The number is sealed with PAYROLL_KEY and never leaves
 * the API whole, except on "Hiện đủ", which is logged. Logs and answers carry the last four digits only.
 */

type Account = typeof payrollBankAccounts.$inferSelect;

/** "••••1234": how an account number is written everywhere but the payroll workbook. */
export const masked = (last4: string) => `••••${last4}`;

/** The account in force on `day`: the newest one changed on or before it (R1); undefined when none was. */
export function accountOn<T extends { changedOn: string }>(accounts: readonly T[], day: string): T | undefined {
  return accounts
    .filter((a) => a.changedOn <= day)
    .reduce<T | undefined>((best, a) => (!best || a.changedOn > best.changedOn ? a : best), undefined);
}

export const bankDtoOf = (a: Account): PayrollBankAccountDto => ({
  id: a.id,
  bank: a.bank,
  last4: a.last4,
  changedOn: a.changedOn,
});

function keyOf(key: PayrollKey | null): PayrollKey {
  if (!key) throw new HttpError(503, 'Chưa cài khoá mã hoá STK (PAYROLL_KEY).', {}, 'payroll_key_missing');
  return key;
}

export async function bankAccountsOf(db: Pick<Db, 'select'>, employeeId: string): Promise<PayrollBankAccountDto[]> {
  const rows = await db
    .select()
    .from(payrollBankAccounts)
    .where(eq(payrollBankAccounts.employeeId, employeeId))
    .orderBy(desc(payrollBankAccounts.changedOn));
  return rows.map(bankDtoOf);
}

async function log(
  db: Pick<Db, 'insert'>,
  hr: HrMe,
  now: Date,
  area: 'ho-so' | 'tai-xem',
  action: string,
  detail: string,
) {
  await writePayrollLog(db, { area, actor: actorOf(hr), action, detail, month: null, at: now });
}

/** A new account from the day it changed; the older ones stay for the months before (R1). */
export async function addBankAccount(
  db: Db,
  employeeId: string,
  raw: unknown,
  hr: HrMe,
  now: Date,
  key: PayrollKey | null,
): Promise<PayrollBankAccountDto> {
  const person = await personOf(db, employeeId);
  const parsed = payrollBankSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    throw invalid(Object.values(errors)[0] ?? 'Kiểm tra lại tài khoản.', errors);
  }
  const sealer = keyOf(key);
  const { bank, accountNumber, changedOn } = parsed.data;
  return db.transaction(async (tx) => {
    const t = payrollBankAccounts;
    const [taken] = await tx
      .select()
      .from(t)
      .where(and(eq(t.employeeId, person.id), eq(t.changedOn, changedOn)));
    if (taken) throw new HttpError(409, `Đã có tài khoản đổi ngày ${dateWords(changedOn)}.`, {}, 'payroll_bank_taken');
    const [row] = await tx
      .insert(t)
      .values({
        employeeId: person.id,
        bank,
        accountCipher: sealAccount(accountNumber, sealer),
        keyVersion: sealer.version,
        last4: accountNumber.slice(-4),
        changedOn,
        createdBy: actorOf(hr),
      })
      .returning();
    if (!row) throw notFound('Không lưu được tài khoản.');
    const detail = `Thêm STK của ${personWords(person)}: ${bank} ${masked(row.last4)}, từ ${dateWords(changedOn)}`;
    await log(tx, hr, now, 'ho-so', 'Thêm', detail);
    return bankDtoOf(row);
  });
}

async function accountOf(db: Pick<Db, 'select'>, person: Employee, id: string): Promise<Account> {
  const [row] = isUuid(id) ? await db.select().from(payrollBankAccounts).where(eq(payrollBankAccounts.id, id)) : [];
  if (!row || row.employeeId !== person.id) throw notFound('Không tìm thấy tài khoản.');
  return row;
}

export async function deleteBankAccount(db: Db, employeeId: string, id: string, hr: HrMe, now: Date): Promise<void> {
  const person = await personOf(db, employeeId);
  const row = await accountOf(db, person, id);
  await db.transaction(async (tx) => {
    await tx.delete(payrollBankAccounts).where(eq(payrollBankAccounts.id, row.id));
    const detail = `Xoá STK của ${personWords(person)}: ${row.bank} ${masked(row.last4)}, từ ${dateWords(row.changedOn)}`;
    await log(tx, hr, now, 'ho-so', 'Xoá', detail);
  });
}

/** "Hiện đủ": the whole number, once, with a line in the log that it was seen. */
export async function revealBankAccount(
  db: Db,
  employeeId: string,
  id: string,
  hr: HrMe,
  now: Date,
  key: PayrollKey | null,
): Promise<{ accountNumber: string }> {
  const person = await personOf(db, employeeId);
  const row = await accountOf(db, person, id);
  const opener = keyOf(key);
  if (row.keyVersion !== opener.version) {
    throw new HttpError(409, `Tài khoản mã hoá bằng khoá phiên bản ${row.keyVersion}.`, {}, 'payroll_key_version');
  }
  const accountNumber = openAccount(row.accountCipher, opener);
  await log(db, hr, now, 'tai-xem', 'Xem', `Xem đủ STK của ${personWords(person)}: ${masked(row.last4)}`);
  return { accountNumber };
}
