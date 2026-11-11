import {
  matchesQuery,
  periodMonthOf,
  standardPeriod,
  type EmployeeDto,
  type PayrollChecklistDto,
  type PayrollCommitmentDto,
  type PayrollDependantDto,
  type PayrollListAccountDto,
  type PayrollPersonCheckDto,
  type PayrollPersonCheckItem,
  type PayrollProfileDto,
  type PayrollProfileListDto,
  type PayrollProfilePrefillDto,
  type PayrollRecurringDto,
} from '@careers/shared';
import type { PayrollLineDto } from '../../../../api';

/** Hồ sơ lương (spec-luong.md 11.5, 17.2): the list, its filters, and what a new entry starts from. */

export type ProfileStatus = 'working' | 'left' | 'all';

export interface ProfileFilters {
  query: string;
  depts: string[];
  blocks: string[];
  /** Opens on the people still working; `?tt=nghi|tat-ca`. */
  status: ProfileStatus;
  /** `?thieu=1`: only the people without a profile. */
  onlyMissing: boolean;
}

export const PROFILE_PARAMS = { query: 'tim', depts: 'bp', blocks: 'khoi', status: 'tt', missing: 'thieu', open: 'hs' };
const STATUS_PARAM: Record<ProfileStatus, string | null> = { working: null, left: 'nghi', all: 'tat-ca' };

export function profileFiltersOf(params: URLSearchParams): ProfileFilters {
  const list = (name: string) => (params.get(name) ?? '').split(',').filter(Boolean);
  const tt = params.get(PROFILE_PARAMS.status);
  return {
    query: params.get(PROFILE_PARAMS.query) ?? '',
    depts: list(PROFILE_PARAMS.depts),
    blocks: list(PROFILE_PARAMS.blocks),
    status: tt === 'nghi' ? 'left' : tt === 'tat-ca' ? 'all' : 'working',
    onlyMissing: params.get(PROFILE_PARAMS.missing) === '1',
  };
}

export const statusParam = (status: ProfileStatus) => STATUS_PARAM[status];

/** Filters on beyond the start (đang làm), for "Lọc (2)" and "Xoá lọc". */
export const profileFiltersOn = (f: ProfileFilters) =>
  [!!f.query.trim(), f.depts.length > 0, f.blocks.length > 0, f.status !== 'working', f.onlyMissing].filter(Boolean)
    .length;

export type ProfileListPerson = PayrollProfileListDto['people'][number];

/** One row: the payroll person, what Chấm công knows of them, and the checklist items still open. */
export interface ProfileRow extends ProfileListPerson {
  department: string;
  regionId: string;
  title: string;
  officialOn: string | null;
  open: PayrollPersonCheckDto[];
  /** What the payroll month viewed says of the person at a glance (F20); null without a row in that month. */
  summary: ProfileSummary | null;
}

/** The person's row of the month viewed, in a few words: pay, dependants, tax, recurring (32), bank account. */
export interface ProfileSummary {
  gross: number;
  /** Null on a month approved before the web kept these. */
  dependants: number | null;
  tax: string;
  /** The part of (32) that comes from the recurring items of the profile. */
  recurring: number;
  /** "••••1234", "Thiếu", or "–" when the month does not say. */
  account: string;
}

const TAX_WORDS: Readonly<Record<string, string>> = {
  progressive: 'Luỹ tiến',
  flat10: 'Khấu trừ 10%',
  none: 'Có cam kết',
};

export function summaryOf(line: PayrollLineDto | undefined): ProfileSummary | null {
  if (!line) return null;
  const typed = line.inputs.cash.reduce((sum, c) => sum + (c.kind === 'advance' ? -c.amount : c.amount), 0);
  const method = line.sheet?.taxMethod;
  return {
    gross: line.cells.gross ?? 0,
    dependants: line.sheet?.dependants ?? null,
    tax: method ? (TAX_WORDS[method] ?? '–') : '–',
    recurring: (line.cells.cash ?? 0) - typed,
    account: line.sheet ? (line.sheet.bankAccount ?? 'Thiếu') : '–',
  };
}

/** Department and region come from Chấm công; on the demo (no Chấm công) from the payroll month's lines. */
export function profileRowsOf(
  list: PayrollProfileListDto,
  employees: readonly EmployeeDto[] | undefined,
  lines: readonly PayrollLineDto[],
  checklist: PayrollChecklistDto | undefined,
): ProfileRow[] {
  return list.people.map((p) => {
    const e = employees?.find((x) => x.id === p.employeeId);
    const line = lines.find((l) => l.employeeId === p.employeeId);
    const checks = checklist?.people.find((c) => c.employeeId === p.employeeId)?.items ?? [];
    return {
      ...p,
      department: e?.department ?? line?.department ?? '',
      regionId: e?.regionId ?? line?.regionId ?? '',
      title: e?.title ?? '',
      officialOn: e?.officialOn ?? null,
      open: checks.filter((i) => !i.confirmed),
      summary: summaryOf(line),
    };
  });
}

export const hasLeftBy = (p: { leftOn: string | null }, today: string) => !!p.leftOn && p.leftOn <= today;

/**
 * "Đang làm" keeps someone who has left but still has a row in the payroll month viewed (F20): HR is paying them
 * this month, so their profile must be at hand. "Đã nghỉ" is everyone who has left.
 */
const isOfStatus = (r: ProfileRow, status: 'working' | 'left', today: string) => {
  const hasLeft = hasLeftBy(r, today);
  return status === 'left' ? hasLeft : !hasLeft || r.summary !== null;
};

export function filterProfiles(rows: readonly ProfileRow[], f: ProfileFilters, today: string): ProfileRow[] {
  const picked = (list: readonly string[], value: string) => list.length === 0 || list.includes(value);
  return rows.filter(
    (r) =>
      picked(f.depts, r.department) &&
      picked(f.blocks, r.block ?? '') &&
      (f.status === 'all' || isOfStatus(r, f.status, today)) &&
      (!f.onlyMissing || !r.hasProfile) &&
      matchesQuery(`${r.fullName} ${r.code} ${r.title}`, f.query),
  );
}

/** 26/11/2026. */
export const showDay = (day: string | null) => (day ? day.split('-').reverse().join('/') : '–');

/**
 * "Tài khoản" of a row in the list: the account on file today, whatever the month viewed was paid with. One that only
 * starts later reads "Từ 12/11" (it is there, not missing); null is "Thiếu". Without the fact (an older API) the row
 * falls back to what the month viewed says.
 */
export function accountWords(
  account: PayrollListAccountDto | null | undefined,
  fromMonth: string | undefined,
): { text: string; isMissing: boolean } {
  if (account === undefined) return { text: fromMonth ?? '–', isMissing: fromMonth === 'Thiếu' };
  if (account === null) return { text: 'Thiếu', isMissing: true };
  if (account.isInForce) return { text: `••••${account.last4}`, isMissing: false };
  return { text: `Từ ${showDay(account.changedOn).slice(0, 5)}`, isMissing: false };
}

/**
 * "Từ ngày" a new account starts with. A month is paid into the account in force on its pay date, so a person's first
 * account goes back to the day they joined (else their first level): every month then has it. A later account is a
 * change, dated today.
 */
export function bankStartOf(
  profile: Pick<PayrollProfileDto, 'person' | 'versions' | 'bankAccounts'>,
  today: string,
): { changedOn: string; isFirst: boolean } {
  if (profile.bankAccounts.length > 0) return { changedOn: today, isFirst: false };
  const firstLevel = profile.versions.map((v) => v.effectiveOn).sort()[0];
  const earliest = profile.person.joinedOn ?? firstLevel ?? today;
  return { changedOn: earliest < today ? earliest : today, isFirst: true };
}

/** One line under the form: from which pay dates the account is used, and what the months before have. */
export function bankAppliesWords(changedOn: string, start: { changedOn: string; isFirst: boolean }): string {
  if (!changedOn) return 'Chọn ngày bắt đầu dùng tài khoản này.';
  const from = `Tài khoản này dùng cho mọi kỳ lương có ngày trả lương từ ${showDay(changedOn)} trở đi.`;
  if (!start.isFirst) return `${from} Các kỳ trả trước ngày đó giữ tài khoản cũ.`;
  if (changedOn <= start.changedOn)
    return `${from} Tài khoản đầu tiên: điền sẵn ngày vào làm để tháng lương nào cũng có tài khoản.`;
  return `${from} Các kỳ trả trước ngày đó sẽ thiếu tài khoản.`;
}
/** T12/2026. */
export const monthWords = (month: string) => `T${Number(month.slice(5))}/${month.slice(0, 4)}`;
const pad = (n: number) => String(n).padStart(2, '0');
export const payrollMonthOf = (day: string) => {
  const { year, month } = periodMonthOf(day);
  return `${year}-${pad(month)}`;
};
export const nextMonth = (month: string) => {
  const [y = 2026, m = 1] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
};
export const periodStart = (month: string) => {
  const [y = 2026, m = 1] = month.split('-').map(Number);
  return standardPeriod(y, m).from;
};

/** L-B06: a month saves the first day of its period; a day inside a period splits that month in two. */
export function effectiveHint(mode: 'day' | 'month', value: string): string | null {
  if (!value) return null;
  if (mode === 'month') return `Lưu ngày ${showDay(periodStart(value))} (đầu kỳ ${monthWords(value)}).`;
  const month = payrollMonthOf(value);
  return periodStart(month) === value ? null : `${monthWords(month)} sẽ tách 2 đoạn.`;
}

export interface LevelDraft {
  mode: 'day' | 'month';
  effectiveOn: string;
  fromMonth: string;
  contractTypeId: string;
  probationDays: number | null;
  managesBusiness: boolean;
  unionMember: boolean;
  kpiAmount: number;
  amounts: Record<string, number>;
}

/** Copy forward: a new level starts from the latest one; the first from the prefill (L-B01), from the day they joined. */
export function levelDraft(profile: PayrollProfileDto, prefill: PayrollProfilePrefillDto | undefined): LevelDraft {
  const latest = profile.versions[profile.versions.length - 1];
  if (latest) {
    const { contractTypeId, probationDays, managesBusiness, unionMember, kpiAmount, amounts } = latest;
    const base = { contractTypeId, probationDays, managesBusiness, unionMember, kpiAmount };
    return { ...base, amounts: { ...amounts }, mode: 'month', effectiveOn: '', fromMonth: '' };
  }
  return {
    mode: 'day',
    effectiveOn: prefill?.effectiveOn ?? profile.person.joinedOn ?? '',
    fromMonth: '',
    contractTypeId: prefill?.contractTypeId ?? '',
    probationDays: prefill?.probationDays ?? null,
    managesBusiness: false,
    unionMember: false,
    kpiAmount: 0,
    amounts: { ...prefill?.amounts },
  };
}

/** Copy forward: the next range starts after the last one ends, with the same count. */
export function dependantDraft(rows: readonly PayrollDependantDto[], month: string) {
  const last = [...rows].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth)).pop();
  const from = last?.toMonth ? nextMonth(last.toMonth) : month;
  return { fromMonth: from, toMonth: '', count: last?.count ?? 1 };
}

/** The next tax year without a commitment; the day it was signed only HR knows. */
export function commitmentDraft(rows: readonly PayrollCommitmentDto[], today: string) {
  const year = Number(today.slice(0, 4));
  const taken = new Set(rows.map((r) => r.year));
  const next = taken.has(year) ? Math.max(...taken) + 1 : year;
  return { year: next, signedOn: '' };
}

export function recurringDraft(rows: readonly PayrollRecurringDto[], month: string) {
  const last = rows[rows.length - 1];
  const from = last?.toMonth ? nextMonth(last.toMonth) : month;
  return {
    kind: last?.kind ?? 'support',
    amount: last?.amount ?? 0,
    taxable: last?.taxable ?? false,
    fromMonth: from,
    toMonth: '',
    note: last?.note ?? '',
  };
}

/** Spec 17.2: what each item is called and which part of the drawer HR types it in. */
export const CHECK_ITEMS: Record<PayrollPersonCheckItem, { label: string; section: string }> = {
  'loai-hd': { label: 'Loại HĐ', section: 'ho-so-muc' },
  'thu-viec': { label: 'Số ngày thử việc', section: 'ho-so-muc' },
  ngay: { label: 'Ngày vào, chính thức, nghỉ', section: 'ho-so-cham-cong' },
  'cam-ket-thue': { label: 'Cam kết thuế', section: 'ho-so-cam-ket' },
  'nguoi-phu-thuoc': { label: 'Người phụ thuộc', section: 'ho-so-npt' },
  'doan-vien': { label: 'Đoàn viên', section: 'ho-so-muc' },
  'khoan-32': { label: 'Khoản (32) định kỳ', section: 'ho-so-khoan-32' },
  'muc-dien-thoai-trang-phuc': { label: 'Xăng xe + ĐT, trang phục', section: 'ho-so-muc' },
  'so-du-dau-nam': { label: 'Số dư đầu năm', section: 'ho-so-so-du' },
};

/** A checklist value names contract types and components by their ids ("khong-thoi-han"); HR reads their names. */
export function checkValueWords(
  value: string,
  catalogue: {
    components: readonly { id: string; name: string }[];
    contractTypes: readonly { id: string; name: string }[];
  },
): string {
  const names = new Map([...catalogue.contractTypes, ...catalogue.components].map((x) => [x.id, x.name]));
  return value.replace(/[a-z0-9]+(?:-[a-z0-9]+)*/g, (word) => names.get(word) ?? word);
}
