import { PAYROLL_LOG_AREAS, PAYROLL_SETTING_DEFS, type PayrollCellKey } from '@careers/shared';
import type { PayrollLogArea, PayrollLogLineDto, PayrollLogQuery } from '../../../../api';

/**
 * Nhật ký lương (spec-luong.md 4.4, 11.9): the filters kept in the address, what they ask the API for, and where a
 * line leads. A line is words only, so the person, the setting and the cell are read back from its words.
 */

/** A group of the log, or "duyet": Duyệt, Mở lại and Đã chuyển khoản alone. */
export type LogGroup = PayrollLogArea | 'duyet';

export const LOG_PARAMS = { group: 'nhom', everyMonth: 'moi-ky', person: 'ma', actor: 'ai', search: 'tim' } as const;

export interface LogFilters {
  group: LogGroup | null;
  /** Off: only the pay month of the page. */
  isEveryMonth: boolean;
  personCode: string;
  actor: string;
  search: string;
}

const isGroup = (value: string | null): value is LogGroup =>
  value === 'duyet' || PAYROLL_LOG_AREAS.some((area) => area === value);

export function logFiltersFrom(params: URLSearchParams): LogFilters {
  const group = params.get(LOG_PARAMS.group);
  return {
    group: isGroup(group) ? group : null,
    isEveryMonth: params.get(LOG_PARAMS.everyMonth) === '1',
    personCode: params.get(LOG_PARAMS.person)?.trim() ?? '',
    actor: params.get(LOG_PARAMS.actor)?.trim() ?? '',
    search: params.get(LOG_PARAMS.search)?.trim() ?? '',
  };
}

export const isLogFiltered = (f: LogFilters) =>
  f.group !== null || f.isEveryMonth || f.personCode !== '' || f.actor !== '' || f.search !== '';

/** Only what is asked for is sent: a filter left alone is not in the request. */
export function logQueryOf(filters: LogFilters, pageMonth: string, offset: number): PayrollLogQuery {
  const { group } = filters;
  return {
    ...(group && group !== 'duyet' ? { area: group } : {}),
    ...(group === 'duyet' ? { isApprovalOnly: true } : {}),
    ...(filters.isEveryMonth ? {} : { month: pageMonth }),
    ...(filters.personCode ? { personCode: filters.personCode } : {}),
    ...(filters.actor ? { actor: filters.actor } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    offset,
  };
}

export interface LogPerson {
  employeeId: string;
  code: string;
  fullName: string;
}

export interface LogLink {
  kind: 'person' | 'month' | 'setting' | 'cell' | 'rights' | 'timesheet';
  label: string;
  to: string;
}

const BASE = '/hr/luong';
export const monthWords = (key: string) => `T${Number(key.slice(5))}/${key.slice(0, 4)}`;

const escaped = (words: string) => words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The code as a whole word: "NV01" is not in "NV010". */
const names = (detail: string, code: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escaped(code)}($|[^\\p{L}\\p{N}])`, 'u').test(detail);

export const personIn = (detail: string, people: readonly LogPerson[]): LogPerson | undefined =>
  people.find((p) => p.code !== '' && names(detail, p.code));

/** What HR typed for the month, by the words the log uses, and the computed cell whose sources show it. */
const TYPED_CELLS: readonly { words: string; label: string; cell: PayrollCellKey }[] = [
  { words: '% KPI', label: '% KPI', cell: 'kpiPercent' },
  { words: 'giờ làm thêm ngày thường', label: 'Lương làm thêm', cell: 'overtimePay' },
  { words: 'công làm thêm ngày nghỉ', label: 'Lương làm thêm', cell: 'overtimePay' },
  { words: 'công làm lễ', label: 'Lương làm thêm', cell: 'overtimePay' },
  { words: 'hỗ trợ / hoàn ứng / tạm ứng', label: 'Hỗ trợ, hoàn ứng, tạm ứng', cell: 'cash' },
];

function cellLink(line: PayrollLogLineDto, person: LogPerson | undefined): LogLink[] {
  if (line.action !== 'Sửa đầu vào tháng' || !person || !line.month) return [];
  const changes = line.detail.slice(line.detail.indexOf(': ') + 2);
  const typed = TYPED_CELLS.find((t) => changes.split('; ').some((change) => change.startsWith(`${t.words} `)));
  const at = `${BASE}?ky=${line.month}`;
  if (!typed) return [{ kind: 'cell', label: 'Dòng lương', to: `${at}&nv=${encodeURIComponent(person.employeeId)}` }];
  const to = `${at}&tinh=${typed.cell}&nguoi=${encodeURIComponent(person.employeeId)}`;
  return [{ kind: 'cell', label: `Ô ${typed.label}`, to }];
}

/** A flag of a pay component or a contract type is written by its key: "khoan.com.thue". */
const FLAG_KEY = /(?:khoan|loai-hd)\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9-]+/;
const LONGEST_LABEL_FIRST = Object.values(PAYROLL_SETTING_DEFS).sort((a, b) => b.label.length - a.label.length);

function settingLink(line: PayrollLogLineDto, pageMonth: string): LogLink[] {
  if (line.area !== 'cau-hinh') return [];
  const to = `${BASE}/cau-hinh?ky=${line.month ?? pageMonth}`;
  const flag = FLAG_KEY.exec(line.detail)?.[0];
  if (flag) return [{ kind: 'setting', label: `Cấu hình: ${flag}`, to: `${to}&khoa=${flag}` }];
  const def = LONGEST_LABEL_FIRST.find((d) => line.detail.includes(d.label));
  if (!def) return [{ kind: 'setting', label: 'Cấu hình', to }];
  return [{ kind: 'setting', label: `Cấu hình: ${def.label}`, to: `${to}&khoa=${def.key}` }];
}

const ABOUT_LEVELS = /^(Thêm|Sửa|Xoá) (hồ sơ|mức) của /;

function personLink(line: PayrollLogLineDto, person: LogPerson | undefined, pageMonth: string): LogLink[] {
  if (!person) return [];
  const levels = line.area === 'ho-so' && ABOUT_LEVELS.test(line.detail) ? '&phan=muc' : '';
  const to = `${BASE}/ho-so?ky=${pageMonth}&hs=${encodeURIComponent(person.employeeId)}${levels}`;
  return [{ kind: 'person', label: `${person.code} ${person.fullName}`, to }];
}

/** Every place a line is about, the closest first: the cell, the setting, the person, then the month. */
export function linksOf(line: PayrollLogLineDto, people: readonly LogPerson[], pageMonth: string): LogLink[] {
  const person = personIn(line.detail, people);
  return [
    ...cellLink(line, person),
    ...settingLink(line, pageMonth),
    ...personLink(line, person, pageMonth),
    ...(line.area === 'quyen' ? [{ kind: 'rights' as const, label: 'Tài khoản HR', to: '/hr/tai-khoan' }] : []),
    ...(line.area === 'cham-cong'
      ? [{ kind: 'timesheet' as const, label: 'Nhật ký Chấm công', to: '/hr/cham-cong/nhat-ky' }]
      : []),
    ...(line.month
      ? [{ kind: 'month' as const, label: `Bảng lương ${monthWords(line.month)}`, to: `${BASE}?ky=${line.month}` }]
      : []),
  ];
}
