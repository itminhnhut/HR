import {
  PAYROLL_DEFAULT_CONTRACT,
  PAYROLL_PERSON_CHECK_ITEMS,
  STAFF_TYPE_LABEL,
  type PayrollChecklistDto,
  type PayrollPersonCheckDto,
  type PayrollPersonCheckItem,
  type PayrollProfileVersionDto,
} from '@careers/shared';
import { asc, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  employees,
  payrollDependants,
  payrollFirstMonthChecks,
  payrollOpening,
  payrollRecurringItems,
  payrollTaxCommitments,
} from '../db/schema.js';
import { firstMonth, probationDaysOf } from './payroll-catalogue.js';
import { periodOfMonth } from './payroll-months.js';
import { recurringKindWords } from './payroll-profile-facts.js';
import { levelOn, versionsOf, type Employee } from './payroll-profile-store.js';
import { loadRows } from './payroll-settings.js';
import { payDateOf, payDayFor, type Row } from './payroll-versions.js';
import { dateWords, moneyWords, valueWords } from './payroll-words.js';

/**
 * Danh sách kiểm trước tháng lương đầu (spec-luong.md 17.2, 11.5; L-B28): for each person in the first payroll month,
 * every fact with the value the web runs on (HR's, or the default) and whether HR confirmed it. Unconfirmed items are
 * red (spec 11.3), but the commitment and khoản (32), which 17.2 marks yellow.
 */

const YELLOW = new Set<PayrollPersonCheckItem>(['cam-ket-thue', 'khoan-32']);
/**
 * The levels the contract must state for the exemption (câu 2, 17.3 K2): the default "Xăng xe + ĐT", or "Điện thoại"
 * where a company pays fuel and phone apart, and Trang phục.
 */
const PHONE_CLOTHING = ['xang-dt', 'dien-thoai', 'trang-phuc'];

interface Facts {
  rows: readonly Row[];
  month: string;
  period: { from: string; to: string };
  payDate: string;
  levels: PayrollProfileVersionDto[];
  dependants: (typeof payrollDependants.$inferSelect)[];
  commitments: (typeof payrollTaxCommitments.$inferSelect)[];
  recurring: (typeof payrollRecurringItems.$inferSelect)[];
  openings: (typeof payrollOpening.$inferSelect)[];
}

type Value = Pick<PayrollPersonCheckDto, 'value' | 'isDefault'>;

function contractValue(p: Employee, f: Facts): Value {
  const level = levelOn(f.levels, f.period.to);
  if (level) return { value: level.contractTypeId, isDefault: false };
  const id = PAYROLL_DEFAULT_CONTRACT[p.employment];
  return { value: `${id} (mặc định theo loại NV ${STAFF_TYPE_LABEL[p.employment]})`, isDefault: true };
}

function probationValue(p: Employee, f: Facts): Value {
  const level = levelOn(f.levels, f.period.to);
  const contract = level?.contractTypeId ?? PAYROLL_DEFAULT_CONTRACT[p.employment];
  const days = level?.probationDays ?? probationDaysOf(f.rows, contract, p.id, f.month);
  const manager = level?.managesBusiness ? ', việc quản lý doanh nghiệp' : '';
  return {
    value: `${days} ngày${manager}`,
    isDefault: !level || (level.probationDays === null && !level.managesBusiness),
  };
}

function datesValue(p: Employee): Value {
  const parts = [
    p.joinedOn ? `Vào ${dateWords(p.joinedOn)}` : null,
    p.officialOn ? `chính thức ${dateWords(p.officialOn)}` : null,
    p.leftOn ? `nghỉ ${dateWords(p.leftOn)}` : null,
  ].filter((w): w is string => w !== null);
  return { value: parts.join(', ') || 'Chưa có ngày', isDefault: false };
}

const datesConfirmed = (p: Employee) =>
  (!p.joinedOn || p.joinedOnConfirmed) && (!p.officialOn || p.officialOnConfirmed) && (!p.leftOn || p.leftOnConfirmed);

const taxYearOf = (f: Facts) => Number(f.payDate.slice(0, 4));
const inMonth = (from: string, to: string | null, at: string) => from <= at && (!to || at <= to);

function commitmentValue(f: Facts): Value {
  const c = f.commitments.find((x) => x.year === taxYearOf(f));
  if (!c) return { value: `Chưa có cam kết năm ${taxYearOf(f)}`, isDefault: true };
  return { value: `Ký ${dateWords(c.signedOn)}`, isDefault: false };
}

function dependantsValue(f: Facts): Value {
  const payMonth = f.payDate.slice(0, 7);
  const count = f.dependants.filter((d) => inMonth(d.fromMonth, d.toMonth, payMonth)).reduce((s, d) => s + d.count, 0);
  return { value: String(count), isDefault: f.dependants.length === 0 };
}

function unionValue(f: Facts): Value {
  const level = levelOn(f.levels, `${f.month}-01`);
  return { value: valueWords(level?.unionMember ?? false), isDefault: !level };
}

function recurringValue(f: Facts): Value {
  const items = f.recurring.filter((r) => inMonth(r.fromMonth, r.toMonth, f.month));
  const words = items.map(recurringKindWords).join(', ');
  return { value: words || 'Không có', isDefault: items.length === 0 };
}

function phoneClothingValue(f: Facts): Value {
  const level = levelOn(f.levels, f.period.to);
  if (!level) return { value: 'Chưa có hồ sơ', isDefault: true };
  const words = PHONE_CLOTHING.flatMap((id) => {
    const amount = level.amounts[id];
    return amount === undefined ? [] : [`${id} ${moneyWords(amount)}`];
  });
  return { value: words.join(', ') || 'Không có', isDefault: false };
}

function openingValue(f: Facts): Value {
  const o = f.openings.find((x) => x.taxYear === taxYearOf(f));
  if (!o) return { value: '0', isDefault: true };
  const words = `thu nhập chịu thuế ${moneyWords(o.taxableIncome)}, thuế ${moneyWords(o.taxWithheld)}, trang phục ${moneyWords(o.clothingPaid)}`;
  return { value: words, isDefault: false };
}

const VALUES: Record<PayrollPersonCheckItem, (p: Employee, f: Facts) => Value> = {
  'loai-hd': contractValue,
  'thu-viec': probationValue,
  ngay: (p) => datesValue(p),
  'cam-ket-thue': (_p, f) => commitmentValue(f),
  'nguoi-phu-thuoc': (_p, f) => dependantsValue(f),
  'doan-vien': (_p, f) => unionValue(f),
  'khoan-32': (_p, f) => recurringValue(f),
  'muc-dien-thoai-trang-phuc': (_p, f) => phoneClothingValue(f),
  'so-du-dau-nam': (_p, f) => openingValue(f),
};

type Check = typeof payrollFirstMonthChecks.$inferSelect;

function itemsOf(p: Employee, f: Facts, checks: readonly Check[]): PayrollPersonCheckDto[] {
  return PAYROLL_PERSON_CHECK_ITEMS.map((item) => {
    const check = checks.find((c) => c.employeeId === p.id && c.item === item);
    const confirmed = item === 'ngay' ? datesConfirmed(p) : (check?.confirmed ?? false);
    return {
      item,
      ...VALUES[item](p, f),
      confirmed,
      confirmedBy: item === 'ngay' || !check ? null : check.confirmedBy,
      confirmedAt: item === 'ngay' || !check ? null : check.confirmedAt.toISOString(),
      level: confirmed ? null : YELLOW.has(item) ? 'yellow' : 'red',
    };
  });
}

async function factsOfPeople(db: Db, ids: string[]) {
  if (ids.length === 0) return { levels: [], dependants: [], commitments: [], recurring: [], openings: [], checks: [] };
  const [levels, dependants, commitments, recurring, openings, checks] = await Promise.all([
    versionsOf(db, ids),
    db.select().from(payrollDependants).where(inArray(payrollDependants.employeeId, ids)),
    db.select().from(payrollTaxCommitments).where(inArray(payrollTaxCommitments.employeeId, ids)),
    db.select().from(payrollRecurringItems).where(inArray(payrollRecurringItems.employeeId, ids)),
    db.select().from(payrollOpening).where(inArray(payrollOpening.employeeId, ids)),
    db.select().from(payrollFirstMonthChecks).where(inArray(payrollFirstMonthChecks.employeeId, ids)),
  ]);
  return { levels, dependants, commitments, recurring, openings, checks };
}

export async function firstMonthChecklist(db: Db): Promise<PayrollChecklistDto> {
  const rows = await loadRows(db);
  const month = firstMonth(rows);
  const period = periodOfMonth(month);
  const everyone = await db.select().from(employees).orderBy(asc(employees.code));
  const people = everyone.filter(
    (p) => (!p.joinedOn || p.joinedOn <= period.to) && (!p.leftOn || p.leftOn >= period.from),
  );
  const all = await factsOfPeople(
    db,
    people.map((p) => p.id),
  );
  const base = { rows, month, period, payDate: payDateOf(month, payDayFor(rows, month)) };
  const list = people.map((p) => {
    const mine = <T extends { employeeId: string }>(xs: readonly T[]) => xs.filter((x) => x.employeeId === p.id);
    const facts: Facts = {
      ...base,
      levels: all.levels.filter((l) => l.employeeId === p.id).map((l) => l.version),
      dependants: mine(all.dependants),
      commitments: mine(all.commitments),
      recurring: mine(all.recurring),
      openings: mine(all.openings),
    };
    return { employeeId: p.id, code: p.code, fullName: p.fullName, items: itemsOf(p, facts, all.checks) };
  });
  const unconfirmed = list.flatMap((p) => p.items).filter((i) => !i.confirmed).length;
  return { month, people: list, unconfirmed };
}
