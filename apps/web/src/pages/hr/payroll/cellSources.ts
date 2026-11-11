import type { PayrollCellKey } from '@careers/shared';
import type { PayrollLineDto } from '../../../api';

/**
 * Where each computed number of Bảng lương comes from (the user's rule "auto + link + CRUD"): the settings it reads
 * (Cấu hình keys, edited for everyone or this person) and the parts of the person's Hồ sơ lương behind it. A click on
 * the number opens them over the grid (`?tinh=<cell>&nguoi=<employeeId>`), never on another tab.
 */

/** Parts of Hồ sơ lương a number reads: pay levels (and contract type), dependants, tax commitments, (32) items. */
export type ProfilePart = 'muc' | 'npt' | 'cam-ket' | 'dinh-ky';

export interface CellSource {
  /** Setting keys in the order HR reads them; a key the month does not list is skipped. */
  settings: (line: PayrollLineDto, componentIds: readonly string[]) => string[];
  profile: ProfilePart[];
  /** Insurance cells: say how the 14-day rule decides whether the month pays. */
  hasRule14?: boolean;
}

const perComponent = (ids: readonly string[], ...flags: string[]) =>
  ids.flatMap((id) => flags.map((flag) => `khoan.${id}.${flag}`));
const contract = (line: PayrollLineDto, flag: string) => `loai-hd.${line.contractTypeId}.${flag}`;

const RULE_14 = ['quy-tac.dem-ngay-bh', 'tuy-chon.d07', 'tuy-chon.d15'];

const insurance = (rates: string, extra: readonly string[] = []): CellSource => ({
  settings: (line) => [rates, ...extra, contract(line, 'dong-bh'), ...RULE_14],
  profile: ['muc'],
  hasRule14: true,
});

const tax = (extra: readonly string[] = []): CellSource => ({
  settings: (_line, ids) => [
    ...perComponent(ids, 'thue', 'muc-quy-che'),
    'luat.tran-tien-an',
    'luat.tran-trang-phuc',
    'tuy-chon.d05',
    'tuy-chon.d08',
    ...extra,
  ],
  profile: ['muc'],
});

/** % KPI: by block (BO by the formula, KD typed), then the probation rate and the month-of-promotion option. */
const KPI_RULES = [
  'quy-tac.kpi-theo-khoi',
  'quy-tac.kpi-chinh-thuc-theo-ngay',
  'quy-tac.ty-le-thu-viec',
  'tuy-chon.d06',
];

const formulaOnly: CellSource = { settings: () => [], profile: [] };

export const CELL_SOURCES: Partial<Record<PayrollCellKey, CellSource>> = {
  dailyRate: {
    settings: (_line, ids) => [...perComponent(ids, 'chia-theo-ngay', 'thu-viec'), 'quy-tac.ty-le-thu-viec'],
    profile: ['muc'],
  },
  kpiPercent: { settings: () => KPI_RULES, profile: ['muc'] },
  kpiBonus: { settings: () => KPI_RULES, profile: ['muc'] },
  overtimePay: {
    settings: (_line, ids) => [
      'quy-tac.he-so-lam-them',
      'quy-tac.gio-mot-ngay',
      'tuy-chon.d12',
      ...perComponent(ids, 'vao-lam-them'),
    ],
    profile: ['muc'],
  },
  income: formulaOnly,
  socialBase: {
    settings: (line, ids) => [
      ...perComponent(ids, 'tinh-bh'),
      'luat.luong-toi-thieu-vung',
      'luat.luong-co-so',
      'luat.he-so-tran',
      contract(line, 'dong-bh'),
    ],
    profile: ['muc'],
  },
  social: insurance('luat.bh-nld'),
  health: insurance('luat.bh-nld', ['tuy-chon.d04']),
  unemployment: insurance('luat.bh-nld'),
  unionFee: { settings: () => ['luat.doan-phi'], profile: ['muc'] },
  cash: { settings: () => [], profile: ['dinh-ky'] },
  exempt: tax(),
  taxable: tax(),
  personalDeduction: { settings: () => ['luat.giam-tru'], profile: [] },
  dependantDeduction: { settings: () => ['luat.giam-tru'], profile: ['npt'] },
  insuranceDeduction: { settings: () => ['luat.bh-nld'], profile: [] },
  assessable: { settings: () => ['luat.giam-tru'], profile: ['npt'] },
  tax: {
    settings: (line) => [
      contract(line, 'cach-thue'),
      // "Cam kết theo hợp đồng": turned off here for everyone, one person or several.
      contract(line, 'cam-ket-kem-hd'),
      'luat.bieu-thue',
      'luat.khau-tru-10',
      'tuy-chon.d02',
      'tuy-chon.d09',
      'tuy-chon.d10',
    ],
    profile: ['cam-ket', 'muc'],
  },
  totalDeductions: formulaOnly,
  netPay: formulaOnly,
  companySocial: insurance('luat.bh-cty'),
  companyHealth: insurance('luat.bh-cty', ['tuy-chon.d04']),
  companyUnemployment: insurance('luat.bh-cty'),
  unionFund: insurance('luat.kpcd', ['tuy-chon.d03']),
  companyTotal: formulaOnly,
  totalCost: formulaOnly,
};

export const sourceOf = (cell: PayrollCellKey | undefined): CellSource | undefined =>
  cell ? CELL_SOURCES[cell] : undefined;

/** The keys a cell reads, once each, in order. */
export function settingKeysOf(cell: PayrollCellKey, line: PayrollLineDto, componentIds: readonly string[]): string[] {
  return [...new Set(CELL_SOURCES[cell]?.settings(line, componentIds) ?? [])];
}

/** The grid's address with one cell's sources open over it: tab, month, filters and scroll stay. */
export function cellSearch(search: string, employeeId: string, cell: PayrollCellKey): string {
  const next = new URLSearchParams(search);
  next.delete('hs');
  next.delete('phan');
  next.set('tinh', cell);
  next.set('nguoi', employeeId);
  return `?${next.toString()}`;
}

export const isCellKey = (value: string | null): value is PayrollCellKey =>
  value !== null && Object.keys(CELL_SOURCES).includes(value);

/** BH-1 in words: the month pays insurance only when the person works (is paid) 14 days or more of it. */
export const RULE_14_WORDS =
  'Quy tắc 14 ngày: tháng có từ 14 ngày làm việc không hưởng lương trở lên thì không đóng BHXH, BHTN (BHYT theo D04); ' +
  'tháng vào hoặc nghỉ giữa tháng đếm theo cấu hình "Đếm 14 ngày" và "Ngày làm việc cho quy tắc 14 ngày".';
