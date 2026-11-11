import { matchesQuery, periodMonthOf, type PayrollCellKey, type PayrollConfigArea } from '@careers/shared';
import type { PayrollLineDto } from '../../../api';

/** The payroll grid without React: its columns in HR's file order, its rows, links and filters (spec 11.2, 4.1, 4.4). */

export type PayrollBandId = 'info' | 'more' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type PayrollColumnKind = 'money' | 'days' | 'hours' | 'percent' | 'info';

export interface PayrollColumnSpec {
  id: string;
  /** The column number of HR's file, "(26)"; null for a column the file does not number. */
  no: string | null;
  label: string;
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

/** The number of each default pay component in HR's file; fuel and phone are split into (11a), (11b) (câu 3). */
const COMPONENT_NO: Record<string, string> = {
  luong: '8',
  'trach-nhiem': '9',
  com: '10',
  xang: '11a',
  'dien-thoai': '11b',
  'xang-dt': '11',
  'trang-phuc': '12',
  'nha-o': '13',
  'chuyen-can': '14',
};

const info = (id: string, label: string): PayrollColumnSpec => ({ id, no: null, label, kind: 'info', value: () => 0 });

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
  return [
    ...components.map((c) => ({
      id: `muc:${c.id}`,
      no: COMPONENT_NO[c.id] ?? null,
      label: c.name,
      kind: 'money' as const,
      value: (line: PayrollLineDto) => line.amounts[c.id] ?? 0,
      toProfile: 'levels' as const,
    })),
    {
      id: 'kpiAmount',
      no: '15',
      label: 'KPI 100%',
      kind: 'money',
      value: (line) => line.kpiAmount,
      toProfile: 'levels',
    },
    of('16', 'gross', 'Gross thoả thuận', 'money', { toProfile: 'levels' }),
  ];
}

const groupB = (): PayrollColumnSpec[] => [
  { id: 'norm', no: null, label: 'Công chuẩn', kind: 'days', value: (line) => line.norm, toTimesheet: true },
  of('17', 'paidDays', 'Công hưởng lương', 'days', { toTimesheet: true }),
  of('18', 'dailyRate', 'Lương 1 ngày'),
  of('19', 'kpiPercent', '% KPI', 'percent', { input: 'kpiPercent' }),
  of('20', 'kpiBonus', 'Thưởng hiệu suất'),
  of('21', 'overtimeHours', 'Giờ làm thêm', 'hours', { input: 'overtimeHours' }),
  of('22', 'restDays', 'Công ngày nghỉ', 'days', { toTimesheet: true, input: 'restDays' }),
  of('23', 'holidayDays', 'Công ngày lễ', 'days', { toTimesheet: true, input: 'holidayDays' }),
  of('24', 'otherIncome', 'Thu nhập khác', 'money', { input: 'otherIncome' }),
  of('25', 'overtimePay', 'Tiền làm thêm'),
  of('26', 'income', 'Thu nhập thực tế', 'money', { isStrong: true }),
];

/** Columns grouped as HR's file: A (levels) → H; the frozen name columns first (spec 11.2, 12.1). */
export function payrollBands(components: readonly { id: string; name: string }[]): PayrollBand[] {
  return [
    {
      id: 'info',
      label: 'NHÂN VIÊN',
      tone: 'bg-blue-600 text-white',
      tint: '',
      columns: [info('stt', 'STT'), info('ma', 'Mã NV'), info('ten', 'Họ và tên')],
    },
    {
      id: 'more',
      label: 'THÔNG TIN THÊM',
      tone: 'bg-slate-200 text-slate-700',
      tint: '',
      columns: [info('bp', 'Bộ phận'), info('kv', 'Khu vực'), info('hd', 'Loại HĐ'), info('khoi', 'Khối')],
    },
    {
      id: 'A',
      label: 'A · ĐỊNH MỨC',
      tone: 'bg-amber-200 text-amber-900',
      tint: 'not-data-selected:bg-amber-50!',
      columns: groupA(components),
    },
    { id: 'B', label: 'B · CÔNG VÀ THU NHẬP', tone: 'bg-orange-200 text-orange-900', tint: '', columns: groupB() },
    {
      id: 'C',
      label: 'C · BẢO HIỂM NGƯỜI LAO ĐỘNG',
      tone: 'bg-sky-200 text-sky-900',
      tint: '',
      columns: [
        of('27', 'socialBase', 'Lương đóng BH'),
        of('28', 'social', 'BHXH'),
        of('29', 'health', 'BHYT'),
        of('30', 'unemployment', 'BHTN'),
        of('31', 'unionFee', 'Đoàn phí'),
      ],
    },
    {
      id: 'D',
      label: 'D · HỖ TRỢ, TẠM ỨNG',
      tone: 'bg-rose-200 text-rose-900',
      tint: '',
      columns: [of('32', 'cash', 'Hỗ trợ / hoàn / tạm ứng', 'money', { input: 'cash' })],
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
        of('40', 'tax', 'Thuế TNCN'),
      ],
    },
    {
      id: 'F',
      label: 'F · THỰC NHẬN',
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
        of('43', 'companySocial', 'BHXH công ty'),
        of('44', 'companyHealth', 'BHYT công ty'),
        of('45', 'companyUnemployment', 'BHTN công ty'),
        of('46', 'unionFund', 'KPCĐ'),
        of('47', 'companyTotal', 'Tổng BH công ty'),
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

/** Each money column's total over the rows shown: the total row follows the filters (spec 11.2). Keyed by column id. */
export function columnTotals(lines: readonly PayrollLineDto[], bands: readonly PayrollBand[]): Record<string, number> {
  const money = bands.flatMap((b) => b.columns).filter((c) => c.kind === 'money');
  return Object.fromEntries(money.map((c) => [c.id, lines.reduce((sum, l) => sum + c.value(l), 0)]));
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

export const isBlockFromPerson = (line: { note: string }) => line.note.includes(BLOCK_FROM_PERSON);

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
