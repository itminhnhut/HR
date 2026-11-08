import { nextDay, type AbsenceRowDto, type EmployeeDto } from '@careers/shared';

/** Who of one department is away on a day: a warning in the leave form, a mark in the list. Never a block. */

export interface AwayNotice {
  from: string;
  to: string;
  department: string;
  names: string[];
}

const dayMonth = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

export const awayWords = (n: AwayNotice) =>
  `Ngày ${n.from === n.to ? dayMonth(n.from) : `${dayMonth(n.from)}–${dayMonth(n.to)}`}: ${n.department} đã có ${n.names.length} người nghỉ: ${n.names.join(', ')}`;

/** Away for a day means a line covering it, approved or waiting. Being late is not being away. */
const isAway = (r: AbsenceRowDto, day: string) => r.code !== 'M' && r.from <= day && day <= r.to;

function daysOf(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 366; day = nextDay(day)) days.push(day);
  return days;
}

/** The people of a department away on a day, each once, by name. */
function awayOn(rows: readonly AbsenceRowDto[], departmentOf: ReadonlyMap<string, string>, department: string, day: string, skip: (r: AbsenceRowDto) => boolean) {
  const names = new Map<string, string>();
  for (const r of rows) if (!skip(r) && isAway(r, day) && departmentOf.get(r.employeeId) === department) names.set(r.employeeId, r.fullName);
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'vi'));
}

/** For the chosen people's departments: who else is away on each day of the dates, days in a row with the same people joined. */
export function awayNotices(args: { rows: readonly AbsenceRowDto[]; people: readonly EmployeeDto[]; chosenIds: readonly string[]; from: string; to: string; ignoreId?: string | null }): AwayNotice[] {
  const { rows, people, chosenIds, from, to, ignoreId } = args;
  if (!from || !to || from > to) return [];
  const departmentOf = new Map(people.map((p) => [p.id, p.department]));
  const departments = [...new Set(chosenIds.map((id) => departmentOf.get(id) ?? ''))].filter(Boolean);
  const skip = (r: AbsenceRowDto) => chosenIds.includes(r.employeeId) || r.id === ignoreId;
  const notices: AwayNotice[] = [];
  for (const department of departments) {
    for (const day of daysOf(from, to)) {
      const names = awayOn(rows, departmentOf, department, day, skip);
      const last = notices.at(-1);
      if (names.length === 0) continue;
      if (last && last.department === department && nextDay(last.to) === day && last.names.join('|') === names.join('|')) notices[notices.length - 1] = { ...last, to: day };
      else notices.push({ from: day, to: day, department, names });
    }
  }
  return notices;
}

/** Departments with two or more people away on some day of a line's dates: the most on one day, and that day. */
export function crowdedDepartments(rows: readonly AbsenceRowDto[], people: readonly EmployeeDto[], from: string, to: string): { department: string; count: number; day: string }[] {
  const departmentOf = new Map(people.map((p) => [p.id, p.department]));
  const most = new Map<string, { count: number; day: string }>();
  for (const day of daysOf(from, to)) {
    const departments = new Set(rows.filter((r) => isAway(r, day)).map((r) => departmentOf.get(r.employeeId) ?? '').filter(Boolean));
    for (const department of departments) {
      const count = awayOn(rows, departmentOf, department, day, () => false).length;
      if (count >= 2 && count > (most.get(department)?.count ?? 0)) most.set(department, { count, day });
    }
  }
  return [...most.entries()].map(([department, v]) => ({ department, ...v }));
}
