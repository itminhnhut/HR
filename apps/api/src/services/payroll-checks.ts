import {
  fieldErrors,
  payrollFirstMonthCheckSchema,
  type HrMe,
  type PayrollFirstMonthCheckDto,
  type PayrollPersonCheckItem,
} from '@careers/shared';
import { and, asc, eq, isNull, type SQL } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { payrollFirstMonthChecks, timesheetClosings } from '../db/schema.js';
import { invalid, notFound } from '../lib/http-error.js';
import { writePayrollLog } from './payroll-log.js';
import { personOf } from './payroll-profile-store.js';
import { personWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Danh sách kiểm trước tháng lương đầu (spec-luong.md 17.2): the close of a timesheet period made before closes were
 * kept (4.21), and each person's facts. Rà soát of the first month stays red for an item until HR has checked it here.
 */

type Check = typeof payrollFirstMonthChecks.$inferSelect;

const dtoOf = (c: Check): PayrollFirstMonthCheckDto => ({
  id: c.id,
  item: c.item,
  employeeId: c.employeeId,
  closingId: c.closingId,
  confirmed: c.confirmed,
  confirmedAt: c.confirmedAt.toISOString(),
  confirmedBy: c.confirmedBy,
});

export async function listFirstMonthChecks(db: Db): Promise<PayrollFirstMonthCheckDto[]> {
  const rows = await db.select().from(payrollFirstMonthChecks).orderBy(asc(payrollFirstMonthChecks.confirmedAt));
  return rows.map(dtoOf);
}

async function closingOf(db: Db, closingId: string | null | undefined) {
  if (!closingId) throw invalid('Chọn lần chốt kỳ công.', { closingId: 'Chọn lần chốt kỳ công.' });
  const [closing] = await db.select().from(timesheetClosings).where(eq(timesheetClosings.id, closingId));
  if (!closing) throw notFound('Không tìm thấy lần chốt kỳ công.');
  return closing;
}

/** The words of each person item, for the log and the checklist (spec 17.2). */
export const PERSON_ITEM_WORDS: Record<PayrollPersonCheckItem, string> = {
  'loai-hd': 'Loại HĐ',
  'thu-viec': 'Số ngày thử việc',
  ngay: 'Ngày vào, nghỉ, chính thức',
  'cam-ket-thue': 'Cam kết thuế',
  'nguoi-phu-thuoc': 'Người phụ thuộc',
  'doan-vien': 'Đoàn viên',
  'khoan-32': 'Khoản (32) định kỳ',
  'muc-dien-thoai-trang-phuc': 'Mức điện thoại, trang phục',
  'so-du-dau-nam': 'Số dư đầu năm',
};

/** What a check is about: a close or a person's item, and how its log line reads. */
interface Target {
  where: SQL | undefined;
  values: { closingId: string } | { employeeId: string };
  area: 'cham-cong' | 'ho-so';
  month: string | null;
  line: (confirmed: boolean) => { action: string; detail: string };
}

const verb = (confirmed: boolean) => (confirmed ? 'Xác nhận' : 'Bỏ xác nhận');

async function closeTarget(db: Db, closingId: string | null | undefined): Promise<Target> {
  const closing = await closingOf(db, closingId);
  return {
    where: and(isNull(payrollFirstMonthChecks.employeeId), eq(payrollFirstMonthChecks.closingId, closing.id)),
    values: { closingId: closing.id },
    area: 'cham-cong',
    month: `${closing.year}-${String(closing.month).padStart(2, '0')}`,
    line: (confirmed) => ({
      action: `${verb(confirmed)} lần chốt kỳ công`,
      detail: `Tháng ${closing.month}/${closing.year}, lần chốt ${closing.closeNo}`,
    }),
  };
}

async function personTarget(
  db: Db,
  item: PayrollPersonCheckItem,
  employeeId: string | null | undefined,
): Promise<Target> {
  if (item === 'ngay')
    throw invalid('Xác nhận ngày vào, nghỉ, chính thức ở Chấm công.', { item: 'Xác nhận ở Chấm công.' });
  if (!employeeId) throw invalid('Chọn nhân viên.', { employeeId: 'Chọn nhân viên.' });
  const person = await personOf(db, employeeId);
  return {
    where: and(eq(payrollFirstMonthChecks.employeeId, person.id), isNull(payrollFirstMonthChecks.closingId)),
    values: { employeeId: person.id },
    area: 'ho-so',
    month: null,
    line: (confirmed) => ({
      action: verb(confirmed),
      detail: `${verb(confirmed)} ${PERSON_ITEM_WORDS[item]} của ${personWords(person)}`,
    }),
  };
}

/** Checked, or taken back. Saving what is already there changes and logs nothing. */
export async function setFirstMonthCheck(
  db: Db,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollFirstMonthCheckDto[]> {
  const parsed = payrollFirstMonthCheckSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại mục kiểm.', fieldErrors(parsed.error));
  const { item, confirmed } = parsed.data;
  const target =
    item === 'lan-chot-ky-cong'
      ? await closeTarget(db, parsed.data.closingId)
      : await personTarget(db, item, parsed.data.employeeId);
  await db.transaction(async (tx) => {
    const where = and(eq(payrollFirstMonthChecks.item, item), target.where);
    const [current] = await tx.select().from(payrollFirstMonthChecks).where(where).for('update');
    if ((current?.confirmed ?? false) === confirmed) return;
    const values = { confirmed, confirmedAt: now, confirmedBy: actorOf(hr) };
    if (current) await tx.update(payrollFirstMonthChecks).set(values).where(eq(payrollFirstMonthChecks.id, current.id));
    else await tx.insert(payrollFirstMonthChecks).values({ ...values, ...target.values, item });
    await writePayrollLog(tx, {
      area: target.area,
      actor: actorOf(hr),
      ...target.line(confirmed),
      month: target.month,
      at: now,
    });
  });
  return listFirstMonthChecks(db);
}
