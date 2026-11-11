import {
  fieldErrors,
  PAYROLL_FORMULA_VERSION,
  payrollExportSchema,
  type HrMe,
  type PayrollExportDto,
  type PayrollExportKind,
  type PayrollExportMonthDto,
  type PayrollLineDto,
  type PayrollLineSheetDto,
  type PayrollMonthDto,
} from '@careers/shared';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, payrollBankAccounts, timesheetClosings } from '../db/schema.js';
import { HttpError, invalid } from '../lib/http-error.js';
import { openAccount, type PayrollKey } from '../lib/payroll-crypto.js';
import { accountOn, masked } from './payroll-bank.js';
import { writePayrollLog } from './payroll-log.js';
import { monthAsNow, payrollMonthOf, storedOf } from './payroll-month.js';
import { loadRows } from './payroll-settings.js';
import { monthWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Tải Excel bảng lương và phiếu lương (spec-luong.md 12.1, 11.7; L-F01, L-F06, L-F22). The months of one download as
 * `GET /months/:YYYY-MM` answers them (an approved month is its approval, R4), every line with what HR's sheet prints.
 * The payroll workbook alone carries whole account numbers; a payslip prints the last four digits, so nothing is
 * opened for it. Each call writes one line in the payroll log, never with a number.
 */

export interface ExportArgs {
  raw: unknown;
  hr: HrMe;
  now: Date;
  key: PayrollKey | null;
}

type Account = typeof payrollBankAccounts.$inferSelect;

const conflict = (message: string, code: string) => new HttpError(409, message, {}, code);

const SETTINGS_NOTE =
  'Tham số áp dụng đọc theo ngày của tháng tại lúc tải file: bản duyệt giữ số từng dòng, không giữ danh sách cấu hình.';
const oldSnapshotNote = (key: string) =>
  `Chức danh, số người phụ thuộc, ngân hàng của ${monthWords(key)} lấy theo hiện tại: bản duyệt trước 11/11/2026 chưa giữ.`;

const EMPTY_SHEET: PayrollLineSheetDto = {
  title: '',
  dependants: 0,
  taxMethod: null,
  paid: {},
  payslipEmail: null,
  bankName: null,
  bankAccount: null,
};

function checkExportable(key: string, month: PayrollMonthDto) {
  if (month.status === 'waiting')
    throw conflict(`${monthWords(key)} chờ chốt công, chưa có số để tải.`, 'payroll_waiting');
  if (month.lines.length === 0) throw conflict(`${monthWords(key)} chưa có dòng lương nào.`, 'payroll_empty');
}

/**
 * A line of an approval made before the web kept `sheet`: today's values of the person. What was paid of each
 * component is taken only when the row still computes the same income; otherwise it stays unknown (empty).
 */
function sheetFromNow(line: PayrollLineDto, live: PayrollLineDto | undefined): PayrollLineSheetDto {
  if (!live?.sheet) return EMPTY_SHEET;
  const isSame = live.cells.income === line.cells.income && live.cells.netPay === line.cells.netPay;
  return isSame ? live.sheet : { ...live.sheet, paid: {}, taxMethod: null };
}

/** Every line with its `sheet`; the second value says whether today's values had to stand in. */
async function withSheets(db: Db, key: string, month: PayrollMonthDto, now: Date): Promise<[PayrollMonthDto, boolean]> {
  if (month.lines.every((l) => l.sheet)) return [month, false];
  const live = await monthAsNow(db, key, now);
  const lines = month.lines.map((l) =>
    l.sheet
      ? l
      : {
          ...l,
          sheet: sheetFromNow(
            l,
            live.lines.find((x) => x.employeeId === l.employeeId),
          ),
        },
  );
  return [{ ...month, lines }, true];
}

async function closingNoOf(db: Db, month: PayrollMonthDto): Promise<number | null> {
  if (month.closingNo !== undefined) return month.closingNo;
  const stored = await storedOf(db, month.year, month.month);
  if (!stored?.closingId) return null;
  const [closing] = await db
    .select({ closeNo: timesheetClosings.closeNo })
    .from(timesheetClosings)
    .where(eq(timesheetClosings.id, stored.closingId));
  return closing?.closeNo ?? null;
}

/** The account a line names (same bank and last four digits), else the one in force on the pay date. */
function accountFor(sheet: PayrollLineSheetDto, mine: readonly Account[], payDate: string): Account | undefined {
  const named = mine.find((a) => a.bank === sheet.bankName && masked(a.last4) === sheet.bankAccount);
  return named ?? accountOn(mine, payDate);
}

function opened(account: Account, key: PayrollKey | null): string {
  if (!key) throw new HttpError(503, 'Chưa cài khoá mã hoá STK (PAYROLL_KEY).', {}, 'payroll_key_missing');
  if (account.keyVersion !== key.version) {
    throw conflict(`Tài khoản mã hoá bằng khoá phiên bản ${account.keyVersion}.`, 'payroll_key_version');
  }
  return openAccount(account.accountCipher, key);
}

/** The whole account number on every line that has an account, for the payroll workbook only. */
async function withAccounts(db: Db, month: PayrollMonthDto, key: PayrollKey | null): Promise<PayrollMonthDto> {
  const ids = month.lines.filter((l) => l.sheet?.bankAccount).map((l) => l.employeeId);
  if (ids.length === 0) return month;
  const accounts = await db.select().from(payrollBankAccounts).where(inArray(payrollBankAccounts.employeeId, ids));
  const lines = month.lines.map((line) => {
    const { sheet } = line;
    if (!sheet?.bankAccount) return line;
    const mine = accounts.filter((a) => a.employeeId === line.employeeId);
    const account = accountFor(sheet, mine, month.payDate);
    if (!account) return line;
    const whole = { bankName: account.bank, bankAccount: opened(account, key) };
    return { ...line, sheet: { ...sheet, ...whole } };
  });
  return { ...month, lines };
}

/**
 * Email nhận phiếu lương on every line as the person has it now (Chấm công › Nhân viên): an approval kept the
 * address of its day, and the file is for sending today.
 */
async function withEmails(db: Db, month: PayrollMonthDto): Promise<PayrollMonthDto> {
  const ids = month.lines.map((l) => l.employeeId);
  if (ids.length === 0) return month;
  const people = await db
    .select({ id: employees.id, email: employees.email })
    .from(employees)
    .where(inArray(employees.id, ids));
  const emails = new Map(people.map((p) => [p.id, p.email]));
  const lines = month.lines.map((line) =>
    line.sheet ? { ...line, sheet: { ...line.sheet, payslipEmail: emails.get(line.employeeId) ?? null } } : line,
  );
  return { ...month, lines };
}

interface MonthArgs {
  key: string;
  kind: PayrollExportKind;
  chosen: ReadonlySet<string> | null;
  args: ExportArgs;
}

async function exportMonth(db: Db, { key, kind, chosen, args }: MonthArgs): Promise<PayrollExportMonthDto> {
  const whole = await payrollMonthOf(db, key, args.now);
  checkExportable(key, whole);
  const lines = chosen ? whole.lines.filter((l) => chosen.has(l.employeeId)) : whole.lines;
  if (lines.length === 0) {
    throw conflict(`Không có người nào được chọn trong bảng lương ${monthWords(key)}.`, 'payroll_export_nobody');
  }
  const [sheeted, isFromNow] = await withSheets(db, key, { ...whole, lines }, args.now);
  const mailed = await withEmails(db, sheeted);
  const month = kind === 'payroll' ? await withAccounts(db, mailed, args.key) : mailed;
  const isFrozen = whole.status === 'approved' || whole.status === 'paid';
  return {
    month,
    peopleTotal: whole.lines.length,
    closingNo: await closingNoOf(db, whole),
    formulaVersion: whole.formulaVersion ?? PAYROLL_FORMULA_VERSION,
    settings: await loadRows(db),
    notes: [...(isFrozen ? [SETTINGS_NOTE] : []), ...(isFromNow ? [oldSnapshotNote(key)] : [])],
  };
}

const FILE_WORDS: Record<PayrollExportKind, string> = { payroll: 'Tải Excel bảng lương', payslips: 'Tải phiếu lương' };

/** `POST /export`: 422 a bad request, 404 a month out of range, 409 a month without numbers yet. */
export async function exportPayrollMonths(db: Db, args: ExportArgs): Promise<PayrollExportDto> {
  const parsed = payrollExportSchema.safeParse(args.raw ?? {});
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    throw invalid(Object.values(errors)[0] ?? 'Kiểm tra lại yêu cầu tải.', errors);
  }
  const { kind, employeeIds } = parsed.data;
  const keys = [...new Set(parsed.data.months)].sort();
  const chosen = employeeIds ? new Set(employeeIds) : null;
  const months: PayrollExportMonthDto[] = [];
  // One month at a time: each is a whole payroll computation.
  for (const key of keys) months.push(await exportMonth(db, { key, kind, chosen, args }));
  const people = new Set(months.flatMap((m) => m.month.lines.map((l) => l.employeeId))).size;
  const [only] = keys;
  await writePayrollLog(db, {
    area: 'tai-xem',
    actor: actorOf(args.hr),
    action: 'Tải',
    detail: `${FILE_WORDS[kind]} ${keys.map(monthWords).join(', ')} (${people} người)`,
    month: keys.length === 1 && only ? only : null,
    at: args.now,
  });
  return { kind, months };
}
