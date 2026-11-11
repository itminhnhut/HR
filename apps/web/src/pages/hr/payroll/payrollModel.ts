import { matchesQuery, periodMonthOf, type PayrollCellKey, type PayrollConfigArea } from '@careers/shared';
import type { PayrollLineDto } from '../../../api';
import { componentNumbers } from './excel/columns';

/** The payroll grid without React: its columns in HR's file order, its rows, links and filters (spec 11.2, 4.1, 4.4). */

export type PayrollBandId = 'info' | 'more' | 'A' | 'B' | 'B2' | 'B3' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type PayrollColumnKind = 'money' | 'days' | 'hours' | 'percent' | 'info';

export interface PayrollColumnSpec {
  id: string;
  /** The column number of HR's file, "(26)"; null for a column the file does not number. */
  no: string | null;
  label: string;
  /** The column's whole name in HR's file, when the heading shortens it: shown on hover. */
  title?: string;
  kind: PayrollColumnKind;
  value: (line: PayrollLineDto) => number;
  /** The cell whose formula, typed value and own settings this column shows. */
  cell?: PayrollCellKey;
  /** Comes from the timesheet closing: the value opens the person's cell there (spec 4.4). */
  toTimesheet?: boolean;
  /** Typed in Hồ sơ lương: the value opens the person's pay levels (group A). */
  toProfile?: 'levels';
  /** A month input HR types in the grid while the month is not approved (spec 2 (4), 5.3). */
  input?: PayrollInputField;
  isStrong?: boolean;
}

/** The month inputs the grid edits: four numbers inline, two lists in a small editor. */
export type PayrollInputField = 'kpiPercent' | 'overtimeHours' | 'restDays' | 'holidayDays' | 'otherIncome' | 'cash';

export interface PayrollBand {
  id: PayrollBandId;
  label: string;
  /** Band colours; red is kept for errors (spec 4.16). */
  tone: string;
  /** Background of the band's cells. */
  tint: string;
  columns: PayrollColumnSpec[];
}

/** The month's insurance rates, as fractions: the headings of (28)–(30), (43)–(46) carry them as HR's file does. */
export interface PayrollRates {
  employee: { social: number; health: number; unemployment: number };
  company: { social: number; health: number; unemployment: number };
  unionFund: number;
  /** The progressive tax table of the month, lowest bracket first: (39) reads it. */
  brackets?: readonly { upTo: number | null }[];
}

/** (39): the bracket the person's (38) reaches, only when the month's tax is progressive (as the Excel file). */
export function taxBracketOf(line: PayrollLineDto, brackets: PayrollRates['brackets']): number {
  const assessable = line.cells.assessable;
  if (!brackets || line.sheet?.taxMethod !== 'progressive' || assessable <= 0) return 0;
  return brackets.findIndex((b) => b.upTo === null || assessable <= b.upTo) + 1;
}

const PERCENT = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 });

/** "BHXH (8%)"; the bare name while the month's rates are not read yet. */
const rated = (name: string, rate: number | undefined) =>
  rate === undefined ? name : `${name} (${PERCENT.format(rate)})`;

const info = (id: string, label: string, no: string | null = null, title?: string): PayrollColumnSpec => ({
  id,
  no,
  label,
  kind: 'info',
  value: () => 0,
  ...(title ? { title } : {}),
});

const of = (
  no: string,
  cell: PayrollCellKey,
  label: string,
  kind: PayrollColumnKind = 'money',
  extra: Partial<PayrollColumnSpec> = {},
): PayrollColumnSpec => ({
  id: cell,
  no,
  label,
  kind,
  cell,
  value: (line) => line.cells[cell] ?? 0,
  ...extra,
});

function groupA(components: readonly { id: string; name: string }[]): PayrollColumnSpec[] {
  // HR's numbers; a component the file never had takes a letter after the one before it: (14a), (14b) (F27).
  const numbers = componentNumbers(components);
  return [
    ...components.map((c, i) => ({
      id: `muc:${c.id}`,
      no: numbers[i] ?? null,
      label: c.name,
      kind: 'money' as const,
      value: (line: PayrollLineDto) => line.amounts[c.id] ?? 0,
      toProfile: 'levels' as const,
    })),
    {
      id: 'kpiAmount',
      no: '15',
      label: 'Thưởng KPI (100%)',
      title: 'Thưởng KPI / Hiệu suất (100%)',
      kind: 'money',
      value: (line) => line.kpiAmount,
      toProfile: 'levels',
    },
    of('16', 'gross', 'Gross thoả thuận', 'money', { toProfile: 'levels' }),
  ];
}

/** B, B2, B3 and C of HR's file: days and evaluation, overtime, other income, then the income they make. */
const groupB = (): PayrollColumnSpec[] => [
  { id: 'norm', no: null, label: 'Công chuẩn', kind: 'days', value: (line) => line.norm, toTimesheet: true },
  of('17', 'paidDays', 'Ngày công thực tế', 'days', { toTimesheet: true }),
  of('18', 'dailyRate', 'Lương 1 ngày'),
  of('19', 'kpiPercent', '% đánh giá KPI', 'percent', { input: 'kpiPercent', title: '% đánh giá KPI / Hiệu suất' }),
  of('20', 'kpiBonus', 'Thưởng hiệu suất'),
];

const groupB2 = (): PayrollColumnSpec[] => [
  of('21', 'overtimeHours', 'Giờ làm thêm', 'hours', { input: 'overtimeHours' }),
  of('22', 'restDays', 'Công ngày nghỉ', 'days', { toTimesheet: true, input: 'restDays' }),
  of('23', 'holidayDays', 'Công ngày lễ', 'days', { toTimesheet: true, input: 'holidayDays' }),
];

const groupC = (): PayrollColumnSpec[] => [
  of('25', 'overtimePay', 'Tiền làm thêm'),
  of('26', 'income', 'Thu nhập thực tế', 'money', { isStrong: true }),
];

/** Columns grouped as HR's file: A (levels) → H; the frozen name columns first (spec 11.2, 12.1). */
export function payrollBands(components: readonly { id: string; name: string }[], rates?: PayrollRates): PayrollBand[] {
  return [
    {
      id: 'info',
      label: 'NHÂN VIÊN',
      tone: 'bg-blue-600 text-white',
      tint: '',
      columns: [info('stt', 'STT', '1'), info('ma', 'Mã NV', '2'), info('ten', 'Họ và tên', '3')],
    },
    {
      id: 'more',
      label: 'THÔNG TIN THÊM',
      tone: 'bg-slate-200 text-slate-700',
      tint: '',
      // The file's order (C05). Its (5) "Bộ phận" holds BO / KD, the block: shown under that number and name, so
      // HR matches it with the file; the department of Chấm công is a column the file does not have.
      columns: [
        info('cd', 'Chức danh', '4'),
        info('khoi', 'Bộ phận (khối)', '5', 'Cột (5) "Bộ phận" của file HR: BO hoặc KD'),
        info('hd', 'Loại HĐ', '6'),
        info('kv', 'Khu vực'),
        info('npt', 'Số NPT', '7'),
        info('bp', 'Phòng ban', null, 'Phòng ban ở Chấm công; file HR không có cột này'),
      ],
    },
    {
      id: 'A',
      label: 'A · ĐỊNH MỨC',
      tone: 'bg-amber-200 text-amber-900',
      tint: 'not-data-selected:bg-amber-50!',
      columns: groupA(components),
    },
    { id: 'B', label: 'B · CHẤM CÔNG & ĐÁNH GIÁ', tone: 'bg-orange-200 text-orange-900', tint: '', columns: groupB() },
    { id: 'B2', label: 'B2 · LÀM THÊM GIỜ', tone: 'bg-yellow-200 text-yellow-900', tint: '', columns: groupB2() },
    {
      id: 'B3',
      label: 'B3 · KHÁC',
      tone: 'bg-lime-200 text-lime-900',
      tint: '',
      columns: [of('24', 'otherIncome', 'Thu nhập khác', 'money', { input: 'otherIncome' })],
    },
    { id: 'C', label: 'C · THU NHẬP', tone: 'bg-violet-200 text-violet-900', tint: '', columns: groupC() },
    {
      id: 'D',
      label: 'D · KHẤU TRỪ NGƯỜI LAO ĐỘNG',
      tone: 'bg-sky-200 text-sky-900',
      tint: '',
      columns: [
        of('27', 'socialBase', 'Lương đóng BH'),
        of('28', 'social', rated('BHXH', rates?.employee.social)),
        of('29', 'health', rated('BHYT', rates?.employee.health)),
        of('30', 'unemployment', rated('BHTN', rates?.employee.unemployment)),
        of('31', 'unionFee', 'Đoàn phí'),
        of('32', 'cash', 'Hỗ trợ / hoàn / tạm ứng', 'money', { input: 'cash' }),
      ],
    },
    {
      id: 'E',
      label: 'E · THUẾ TNCN',
      tone: 'bg-blue-200 text-blue-900',
      tint: '',
      columns: [
        of('33', 'exempt', 'Miễn thuế'),
        of('34', 'taxable', 'Chịu thuế'),
        of('35', 'personalDeduction', 'Giảm trừ bản thân'),
        of('36', 'dependantDeduction', 'Giảm trừ NPT'),
        of('37', 'insuranceDeduction', 'Giảm trừ BH'),
        of('38', 'assessable', 'Tính thuế'),
        {
          id: 'bracket',
          no: '39',
          label: 'Bậc thuế',
          kind: 'info',
          value: (line) => taxBracketOf(line, rates?.brackets),
        },
        of('40', 'tax', 'Thuế TNCN'),
      ],
    },
    {
      id: 'F',
      label: 'F · THANH TOÁN',
      tone: 'bg-green-200 text-green-900',
      tint: 'not-data-selected:bg-green-50!',
      columns: [
        of('41', 'totalDeductions', 'Tổng khấu trừ'),
        of('42', 'netPay', 'Thực nhận', 'money', { isStrong: true }),
      ],
    },
    {
      id: 'G',
      label: 'G · CHI PHÍ CÔNG TY',
      tone: 'bg-teal-200 text-teal-900',
      tint: '',
      columns: [
        of('43', 'companySocial', rated('BHXH Cty', rates?.company.social)),
        of('44', 'companyHealth', rated('BHYT Cty', rates?.company.health)),
        of('45', 'companyUnemployment', rated('BHTN Cty', rates?.company.unemployment)),
        of('46', 'unionFund', rated('KPCĐ', rates?.unionFund)),
        of('47', 'companyTotal', 'Tổng BH + KPCĐ Cty'),
        of('48', 'totalCost', 'Tổng chi phí', 'money', { isStrong: true }),
      ],
    },
    {
      id: 'H',
      label: 'H · GHI CHÚ',
      tone: 'bg-slate-200 text-slate-700',
      tint: '',
      columns: [info('ghiChu', 'Ghi chú')],
    },
  ];
}

export type PayrollGridRow =
  | { id: string; kind: 'group'; label: string; count: number }
  | { id: string; kind: 'line'; line: PayrollLineDto; stt: number }
  | { id: string; kind: 'total'; label: string; count: number };

export interface PayrollNames {
  regions: Record<string, string>;
  contracts: Record<string, string>;
}

const groupKey = (l: PayrollLineDto) => `${l.regionId}|${l.contractTypeId}|${l.block ?? ''}`;

/** People in D13 order, a heading row at each region, contract type and block, then the total row. */
export function gridRowsOf(lines: readonly PayrollLineDto[], names: PayrollNames): PayrollGridRow[] {
  const rows: PayrollGridRow[] = [];
  lines.forEach((line, i) => {
    const key = groupKey(line);
    if (i === 0 || key !== groupKey(lines[i - 1] ?? line)) {
      const label = [
        names.regions[line.regionId] ?? line.regionId,
        names.contracts[line.contractTypeId] ?? line.contractTypeId,
        line.block,
      ]
        .filter(Boolean)
        .join(' · ');
      rows.push({ id: `nhom:${key}`, kind: 'group', label, count: lines.filter((l) => groupKey(l) === key).length });
    }
    rows.push({ id: line.employeeId, kind: 'line', line, stt: i + 1 });
  });
  rows.push({ id: 'tong', kind: 'total', label: `Tổng cộng ${lines.length} người`, count: lines.length });
  return rows;
}

/** (21)–(23): HR's file totals the overtime hours and days too; (17) and (19) have no total. */
const TOTALLED_COUNTS = new Set(['overtimeHours', 'restDays', 'holidayDays']);

/** (18) is a daily rate: adding the people's rates up means nothing, and HR's file leaves that cell empty (F16). */
const NEVER_TOTALLED = new Set(['dailyRate']);

export const isTotalled = (column: Pick<PayrollColumnSpec, 'id' | 'kind'>) =>
  (column.kind === 'money' && !NEVER_TOTALLED.has(column.id)) || TOTALLED_COUNTS.has(column.id);

/**
 * The total of each money column, and of the overtime hours and days, over the rows shown: the total row follows the
 * filters (spec 11.2). Keyed by column id; hours and days are summed in hundredths so 0,1 + 0,2 stays 0,3.
 */
export function columnTotals(lines: readonly PayrollLineDto[], bands: readonly PayrollBand[]): Record<string, number> {
  const columns = bands.flatMap((b) => b.columns).filter(isTotalled);
  const sum = (c: PayrollColumnSpec) => lines.reduce((total, l) => total + c.value(l), 0);
  return Object.fromEntries(columns.map((c) => [c.id, c.kind === 'money' ? sum(c) : Math.round(sum(c) * 100) / 100]));
}

const initial = (word: string) => word.charAt(0).toLocaleUpperCase('vi-VN');

/** "Hồ Chí Minh" → "HCM", "Hà Nội" → "HN": a region chip fits its column; the full name shows on hover. */
export function regionShort(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? words.map(initial).join('') : name;
}

const LONG_CONTRACT = 14;

/** "HĐLĐ không xác định thời hạn" → "HĐLĐ KXĐTH": the leading code, then the initials; a short name stays. */
export function contractShort(name: string): string {
  if (name.length <= LONG_CONTRACT) return name;
  const [head = '', ...rest] = name.trim().split(/\s+/);
  const isCode = head === head.toLocaleUpperCase('vi-VN');
  return isCode ? `${head} ${rest.map(initial).join('')}` : [head, ...rest].map(initial).join('');
}

/** The person's cell on the timesheet: that period, its last day, that person (as the leave list links). */
export const timesheetLink = (month: { monthKey: string; to: string }, employeeId: string) =>
  `/hr/cham-cong?ky=${month.monthKey}&ngay=${month.to}&nv=${encodeURIComponent(employeeId)}`;

/** What a line's note says when the closing had no block and the person's own was used. */
export const BLOCK_FROM_PERSON = 'Khối lấy từ hồ sơ nhân viên';

/** The row's own mark; a month approved before the mark existed still says it in its note. */
export const isBlockFromPerson = (line: { note: string; blockFromPerson?: boolean }) =>
  line.blockFromPerson === true || line.note.includes(BLOCK_FROM_PERSON);

/** The row's note without the remark about Khối: what the Excel file and the payslip print (F19, F22). */
export const printedNote = (note: string) =>
  note
    .split('; ')
    .filter((part) => part && !part.includes(BLOCK_FROM_PERSON))
    .join('; ');

/**
 * Khối is typed on the person in Chấm công → Nhân viên: the link opens that person's form there (`nv`); a person
 * without a block lands on the "Thiếu khối" list (`khoi=none`), so the others still missing are behind the form.
 */
export function blockLink(line: { employeeId: string; block: string | null }): string {
  const person = `nv=${encodeURIComponent(line.employeeId)}`;
  return `/hr/cham-cong/nhan-vien?${line.block ? person : `${person}&khoi=none`}`;
}

/** The Rà soát codes about Khối: fixed on the person, not in the grid. */
export const isBlockReview = (code: string) => code === 'missing-block';

/**
 * The grid's own address with a person's Hồ sơ lương open over it, on the pay levels with the month's one marked
 * (`hs`, `phan=muc`): the tab, the month and the filters stay, so closing it is back where HR was.
 */
export function levelsSearch(search: string, employeeId: string): string {
  const next = new URLSearchParams(search);
  next.set('hs', employeeId);
  next.set('phan', 'muc');
  return `?${next.toString()}`;
}

/** Cấu hình at the section and month of the version used (Q6). */
export const configLink = (monthKey: string, ref: { key: string; area: PayrollConfigArea }) =>
  `/hr/luong/cau-hinh?ky=${monthKey}&muc=${ref.area}&khoa=${encodeURIComponent(ref.key)}`;

export type MonthChoice = { ok: true; year: number; month: number } | { ok: false; message: string };

/** `?ky=YYYY-MM`, or the current period; a wrong one is said, never swapped for another month (L-L07). */
export function monthFromParam(param: string | null, today: string): MonthChoice {
  if (param === null || param === '') return { ok: true, ...periodMonthOf(today) };
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(param);
  if (!match) return { ok: false, message: `Kỳ “${param}” không đúng dạng. Kỳ ghi dạng 2026-11 (năm-tháng).` };
  return { ok: true, year: Number(match[1]), month: Number(match[2]) };
}

export const monthKeyOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** Only the typed cells, or only the people with own settings: the counts under the grid (L-L14). */
export type PayrollOnly = 'go-de' | 'rieng' | null;

export interface PayrollFilters {
  people: string[];
  depts: string[];
  regions: string[];
  contracts: string[];
  blocks: string[];
  query: string;
  only?: PayrollOnly;
}

const picked = (list: readonly string[], value: string) => list.length === 0 || list.includes(value);

export function filterLines(lines: readonly PayrollLineDto[], f: PayrollFilters): PayrollLineDto[] {
  return lines.filter(
    (l) =>
      picked(f.people, l.employeeId) &&
      picked(f.depts, l.department) &&
      picked(f.regions, l.regionId) &&
      picked(f.contracts, l.contractTypeId) &&
      picked(f.blocks, l.block ?? '') &&
      matchesQuery(`${l.fullName} ${l.code}`, f.query) &&
      (f.only !== 'go-de' || l.overrides.length > 0) &&
      (f.only !== 'rieng' || l.personSettings.length > 0),
  );
}

/** The address names of the filters (spec 4.1: `?ky=2026-11&kv=…&tim=…`). */
export const FILTER_PARAMS = { people: 'nv', depts: 'bp', regions: 'kv', contracts: 'hd', blocks: 'khoi' } as const;

export function filtersFromParams(params: URLSearchParams): PayrollFilters {
  const list = (name: string) => (params.get(name) ?? '').split(',').filter(Boolean);
  const only = params.get('loc');
  return {
    people: list(FILTER_PARAMS.people),
    depts: list(FILTER_PARAMS.depts),
    regions: list(FILTER_PARAMS.regions),
    contracts: list(FILTER_PARAMS.contracts),
    blocks: list(FILTER_PARAMS.blocks),
    query: params.get('tim') ?? '',
    only: only === 'go-de' || only === 'rieng' ? only : null,
  };
}

export const isFiltered = (f: PayrollFilters) =>
  !!f.query.trim() || !!f.only || [f.people, f.depts, f.regions, f.contracts, f.blocks].some((l) => l.length > 0);

/** 19.350.000; 19,5; 81,82%. */
export function formatValue(kind: PayrollColumnKind, value: number): string {
  if (kind === 'percent') return `${String(Number((value * 100).toFixed(2))).replace('.', ',')}%`;
  if (kind === 'money') return value.toLocaleString('vi-VN');
  return String(value).replace('.', ',');
}

/** What lands in Excel when pasted: digits without the thousands dots, a decimal comma. */
export function copyValue(kind: PayrollColumnKind, value: number): string {
  if (kind === 'percent') return `${String(Number((value * 100).toFixed(4))).replace('.', ',')}%`;
  return String(value).replace('.', ',');
}
