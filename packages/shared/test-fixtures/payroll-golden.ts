/**
 * The anonymous golden month of docs/test-cases-luong.md, section K3 (bản 08/11/2026 sau khi chốt mục 17; chốt 09/11: chuyên cần ngoài lương BH (K3), "Xăng xe + ĐT" miễn thuế toàn bộ (K2)): twelve made-up people NV A…NV L,
 * each shaped like one row of HR's October file (contract, region, norm, kind of month), with changed amounts and days.
 * No row matches a real person's numbers. The two tables are copied row for row from the catalogue.
 */

export type GoldenContract = 'khong-thoi-han' | '12-thang' | 'thu-viec';

export interface GoldenPerson {
  id: string;
  contract: GoldenContract;
  region: 'HCM' | 'HN';
  norm: number;
  days: number;
  /** Monthly amounts by component id, fuel and phone apart as the catalogue lists them; paid as one "Xăng xe + ĐT". */
  amounts: Readonly<Record<string, number>>;
  /** Khối: BO goes by the formula days ÷ norm (× 90% on probation), KD by what HR types (spec 5.3, file T10). */
  block: 'BO' | 'KD';
  kpiAmount: number;
  /** (19) as HR types it in the default configuration; null: the block's rule (BO: the formula). */
  kpiPercent: number | null;
  /** (19) as HR's file has it. */
  fileKpiPercent: number | null;
  /** The (32) amount: support in the default configuration, a refund in the file's. */
  cash: number;
  joinedOn: string | null;
  leftOn: string | null;
  /** The file's taxable amount without a source (NV L); left out of the default configuration. */
  fileOtherIncome: number;
}

const COMMON = { luong: 6_400_000, com: 1_100_000, 'chuyen-can': 1_000_000 };
const CLOTHING = { 'trang-phuc': 350_000 };

const person = (
  p: Partial<GoldenPerson> & Pick<GoldenPerson, 'id' | 'contract' | 'block' | 'days' | 'amounts'>,
): GoldenPerson => ({
  region: 'HCM',
  norm: 22,
  kpiAmount: 0,
  kpiPercent: null,
  fileKpiPercent: null,
  cash: 0,
  joinedOn: null,
  leftOn: null,
  fileOtherIncome: 0,
  ...p,
  amounts: { ...COMMON, ...p.amounts },
});

export const GOLDEN_PEOPLE: readonly GoldenPerson[] = [
  person({
    id: 'NV A',
    block: 'BO',
    contract: 'khong-thoi-han',
    days: 22,
    amounts: { xang: 2_300_000, 'dien-thoai': 500_000, ...CLOTHING, 'nha-o': 2_200_000 },
    kpiAmount: 5_500_000,
    fileKpiPercent: 1,
  }),
  person({
    id: 'NV B',
    block: 'BO',
    contract: 'khong-thoi-han',
    days: 22,
    amounts: { xang: 2_300_000, 'dien-thoai': 500_000, ...CLOTHING, 'nha-o': 3_500_000 },
    kpiAmount: 6_500_000,
    fileKpiPercent: 1,
  }),
  person({
    id: 'NV C',
    block: 'KD',
    contract: 'khong-thoi-han',
    days: 22,
    amounts: { xang: 1_400_000, 'dien-thoai': 420_000, ...CLOTHING, 'nha-o': 1_700_000 },
    kpiAmount: 3_500_000,
    kpiPercent: 1,
    fileKpiPercent: 1,
  }),
  person({
    id: 'NV D',
    block: 'KD',
    contract: '12-thang',
    days: 22,
    amounts: { xang: 800_000, 'dien-thoai': 420_000, ...CLOTHING },
    kpiAmount: 2_500_000,
    kpiPercent: 1,
    fileKpiPercent: 1,
    cash: 700_000,
  }),
  person({
    id: 'NV E',
    block: 'KD',
    contract: '12-thang',
    days: 8.5,
    amounts: { xang: 2_050_000, 'dien-thoai': 420_000 },
    kpiAmount: 4_500_000,
    kpiPercent: 0,
    fileKpiPercent: 0,
    leftOn: '2026-10-09',
  }),
  person({
    id: 'NV F',
    block: 'KD',
    contract: '12-thang',
    days: 19.5,
    amounts: { xang: 1_000_000, 'dien-thoai': 420_000 },
    kpiAmount: 4_700_000,
    kpiPercent: 0.8,
    fileKpiPercent: 0.8,
    cash: 700_000,
  }),
  person({ id: 'NV G', block: 'BO', contract: 'thu-viec', days: 20, amounts: { 'dien-thoai': 450_000 } }),
  person({
    id: 'NV H',
    block: 'BO',
    contract: 'thu-viec',
    days: 14,
    amounts: { 'dien-thoai': 450_000 },
    kpiAmount: 3_700_000,
    leftOn: '2026-10-15',
  }),
  person({
    id: 'NV I',
    block: 'BO',
    contract: 'thu-viec',
    days: 18.5,
    amounts: { xang: 1_500_000, 'dien-thoai': 500_000, ...CLOTHING },
    kpiAmount: 6_100_000,
  }),
  person({
    id: 'NV J',
    block: 'KD',
    contract: 'thu-viec',
    days: 13,
    amounts: { xang: 1_000_000, 'dien-thoai': 450_000 },
    kpiAmount: 4_500_000,
    kpiPercent: 0,
    fileKpiPercent: 0,
    joinedOn: '2026-10-07',
  }),
  person({
    id: 'NV K',
    block: 'KD',
    contract: 'khong-thoi-han',
    region: 'HN',
    norm: 24,
    days: 24,
    amounts: { xang: 3_150_000, 'dien-thoai': 500_000, ...CLOTHING, 'nha-o': 2_700_000 },
    kpiAmount: 5_500_000,
    kpiPercent: 1,
    fileKpiPercent: 1,
  }),
  person({
    id: 'NV L',
    block: 'KD',
    contract: 'thu-viec',
    region: 'HN',
    norm: 24,
    days: 24,
    amounts: { xang: 1_000_000, 'dien-thoai': 420_000 },
    kpiAmount: 4_700_000,
    kpiPercent: 0.8,
    fileKpiPercent: 0.8,
    fileOtherIncome: 350_000,
  }),
];

export const GOLDEN_COLUMNS = [
  'gross',
  'dailyRate',
  'kpiPercent',
  'kpiBonus',
  'otherIncome',
  'income',
  'socialBase',
  'social',
  'health',
  'unemployment',
  'cash',
  'exempt',
  'taxable',
  'insuranceDeduction',
  'assessable',
  'tax',
  'totalDeductions',
  'netPay',
  'companySocial',
  'companyHealth',
  'companyUnemployment',
  'unionFund',
  'companyTotal',
  'totalCost',
] as const;
export type GoldenColumn = (typeof GOLDEN_COLUMNS)[number];

export interface GoldenRow {
  id: string;
  person: string;
  /** Empty cells (the total row's (18), (19)) are left out. */
  cells: Partial<Record<GoldenColumn, number>>;
}

/** "19.350.000" → 19350000; "81,8182%" → 0.818182; "152.656.523 ≠" → 152656523. */
const valueOf = (cell: string): number | null => {
  const text = cell.replace('≠', '').trim();
  if (text === '') return null;
  if (text.endsWith('%')) return Number((Number(text.slice(0, -1).replace(',', '.')) / 100).toFixed(6));
  return Number(text.replace(/\./g, ''));
};

const parse = (table: string): GoldenRow[] =>
  table
    .trim()
    .split('\n')
    .map((line) => {
      const [id = '', name = '', ...rest] = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      const entries = GOLDEN_COLUMNS.map((key, i) => [key, valueOf(rest[i] ?? '')] as const);
      return { id, person: name, cells: Object.fromEntries(entries.filter(([, v]) => v !== null)) };
    });

// | Mã | Người | (16) | (18) | (19) | (20) | (24) | (26) | (27) | (28) | (29) | (30) | (32) | (33) | (34) | (37) | (38) | (40) | (41) | (42) | (43) | (44) | (45) | (46) | (47) | (48) |
export const DEFAULT_TABLE = `
| L-K3-S01 | NV A | 19.350.000 | 629.545 | 100% | 5.500.000 | 0 | 19.350.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 4.250.000 | 15.100.000 | 672.000 | 0 | 0 | 672.000 | 18.678.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 20.726.000 |
| L-K3-S02 | NV B | 21.650.000 | 688.636 | 100% | 6.500.000 | 0 | 21.650.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 4.250.000 | 17.400.000 | 672.000 | 1.228.000 | 61.400 | 733.400 | 20.916.600 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 23.026.000 |
| L-K3-S03 | NV C | 15.870.000 | 562.273 | 100% | 3.500.000 | 0 | 15.870.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 3.270.000 | 12.600.000 | 672.000 | 0 | 0 | 672.000 | 15.198.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 17.246.000 |
| L-K3-S04 | NV D | 12.570.000 | 457.727 | 100% | 2.500.000 | 0 | 12.570.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 700.000 | 2.670.000 | 10.600.000 | 672.000 | 0 | 0 | 672.000 | 12.598.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 14.646.000 |
| L-K3-S05 | NV E | 15.470.000 | 498.636 | 0% | 0 | 0 | 4.238.409 | 6.400.000 | 0 | 96.000 | 0 | 0 | 1.379.318 | 2.859.091 | 96.000 | 0 | 0 | 96.000 | 4.142.409 | 0 | 192.000 | 0 | 0 | 192.000 | 4.430.409 |
| L-K3-S06 | NV F | 14.620.000 | 450.909 | 80% | 3.760.000 | 0 | 12.552.727 | 6.400.000 | 512.000 | 96.000 | 64.000 | 700.000 | 2.233.636 | 11.019.091 | 672.000 | 0 | 0 | 672.000 | 12.580.727 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 14.628.727 |
| L-K3-S07 | NV G | 8.950.000 | 366.136 | 81,8182% | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 1.268.182 | 6.054.545 | 0 | 0 | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 7.322.727 |
| L-K3-S08 | NV H | 12.650.000 | 366.136 | 57,2727% | 2.119.091 | 0 | 7.245.000 | 0 | 0 | 0 | 0 | 0 | 887.727 | 6.357.273 | 0 | 0 | 724.500 | 724.500 | 6.520.500 | 0 | 0 | 0 | 0 | 0 | 7.245.000 |
| L-K3-S09 | NV I | 16.950.000 | 443.864 | 75,6818% | 4.616.591 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 2.611.023 | 10.217.045 | 0 | 0 | 0 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 12.828.068 |
| L-K3-S10 | NV J | 14.450.000 | 407.045 | 0% | 0 | 0 | 5.291.591 | 0 | 0 | 0 | 0 | 0 | 1.356.136 | 3.935.455 | 0 | 0 | 0 | 0 | 5.291.591 | 0 | 0 | 0 | 0 | 0 | 5.291.591 |
| L-K3-S11 | NV K | 20.700.000 | 633.333 | 100% | 5.500.000 | 0 | 20.700.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 5.100.000 | 15.600.000 | 672.000 | 0 | 0 | 672.000 | 20.028.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 22.076.000 |
| L-K3-S12 | NV L | 14.620.000 | 372.000 | 80% | 3.760.000 | 0 | 12.688.000 | 0 | 0 | 0 | 0 | 0 | 2.268.000 | 10.420.000 | 0 | 0 | 0 | 0 | 12.688.000 | 0 | 0 | 0 | 0 | 0 | 12.688.000 |
| Σ |  | 187.850.000 |  |  | 37.755.682 | 0 | 152.306.522 | 44.800.000 | 3.072.000 | 672.000 | 384.000 | 1.400.000 | 31.544.022 | 122.162.500 | 4.128.000 | 1.228.000 | 785.900 | 4.913.900 | 148.792.622 | 6.720.000 | 1.344.000 | 384.000 | 0 | 8.448.000 | 162.154.522 |
`;

export const AS_HR_TABLE = `
| L-K3-F01 | NV A | 19.350.000 | 629.545 | 100% | 5.500.000 | 0 | 19.350.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 4.250.000 | 15.100.000 | 672.000 | 0 | 0 | 672.000 | 18.678.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 20.726.000 |
| L-K3-F02 | NV B | 21.650.000 | 688.636 | 100% | 6.500.000 | 0 | 21.650.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 4.250.000 | 17.400.000 | 672.000 | 1.228.000 | 61.400 | 733.400 | 20.916.600 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 23.026.000 |
| L-K3-F03 | NV C | 15.870.000 | 562.273 | 100% | 3.500.000 | 0 | 15.870.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 3.270.000 | 12.600.000 | 672.000 | 0 | 0 | 672.000 | 15.198.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 17.246.000 |
| L-K3-F04 | NV D | 12.570.000 | 457.727 | 100% | 2.500.000 | 0 | 12.570.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 700.000 | 2.670.000 | 9.900.000 | 672.000 | 0 | 0 | 672.000 | 12.598.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 13.946.000 |
| L-K3-F05 | NV E | 15.470.000 | 498.636 | 0% | 0 | 0 | 4.238.409 | 6.400.000 | 0 | 96.000 | 0 | 0 | 1.379.318 | 2.859.091 | 96.000 | 0 | 0 | 96.000 | 4.142.409 | 0 | 192.000 | 0 | 0 | 192.000 | 4.430.409 |
| L-K3-F06 | NV F | 14.620.000 | 450.909 | 80% | 3.760.000 | 0 | 12.552.727 | 6.400.000 | 512.000 | 96.000 | 64.000 | 700.000 | 2.233.636 | 10.319.091 | 672.000 | 0 | 0 | 672.000 | 12.580.727 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 13.928.727 |
| L-K3-F07 | NV G | 8.950.000 | 366.136 | 81,8182% | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 1.268.182 | 6.054.545 | 0 | 0 | 0 | 0 | 7.322.727 | 0 | 0 | 0 | 0 | 0 | 7.322.727 |
| L-K3-F08 | NV H | 12.650.000 | 366.136 | 57,2727% | 2.119.091 | 0 | 7.245.000 | 0 | 0 | 0 | 0 | 0 | 887.727 | 6.357.273 | 0 | 0 | 724.500 | 724.500 | 6.520.500 | 0 | 0 | 0 | 0 | 0 | 7.245.000 |
| L-K3-F09 | NV I | 16.950.000 | 443.864 | 75,6818% | 4.616.591 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 2.611.023 | 10.217.045 | 0 | 0 | 0 | 0 | 12.828.068 | 0 | 0 | 0 | 0 | 0 | 12.828.068 |
| L-K3-F10 | NV J | 14.450.000 | 407.045 | 0% | 0 | 0 | 5.291.591 | 0 | 0 | 0 | 0 | 0 | 1.356.136 | 3.935.455 | 0 | 0 | 0 | 0 | 5.291.591 | 0 | 0 | 0 | 0 | 0 | 5.291.591 |
| L-K3-F11 | NV K | 20.700.000 | 633.333 | 100% | 5.500.000 | 0 | 20.700.000 | 6.400.000 | 512.000 | 96.000 | 64.000 | 0 | 5.100.000 | 15.600.000 | 672.000 | 0 | 0 | 672.000 | 20.028.000 | 1.120.000 | 192.000 | 64.000 | 0 | 1.376.000 | 22.076.000 |
| L-K3-F12 | NV L | 14.620.000 | 372.000 | 80% | 3.760.000 | 350.000 | 13.038.000 | 0 | 0 | 0 | 0 | 0 | 2.268.000 | 10.770.000 | 0 | 0 | 0 | 0 | 13.038.000 | 0 | 0 | 0 | 0 | 0 | 13.038.000 |
| Σ | | 187.850.000 |  |  | 37.755.682 | 350.000 | 152.656.522 | 44.800.000 | 3.072.000 | 672.000 | 384.000 | 1.400.000 | 31.544.022 | 121.112.500 | 4.128.000 | 1.228.000 | 785.900 | 4.913.900 | 149.142.622 | 6.720.000 | 1.344.000 | 384.000 | 0 | 8.448.000 | 161.104.522 |
| Tròn(Σ đủ) | | 187.850.000 |  |  | 37.755.682 | 350.000 | 152.656.523 ≠ | 44.800.000 | 3.072.000 | 672.000 | 384.000 | 1.400.000 | 31.544.022 | 121.112.501 ≠ | 4.128.000 | 1.228.000 | 785.900 | 4.913.900 | 149.142.623 ≠ | 6.720.000 | 1.344.000 | 384.000 | 0 | 8.448.000 | 161.104.523 ≠ |
`;

/** Rows L-K3-S01…S12 then the Σ row. */
export const DEFAULT_ROWS = parse(DEFAULT_TABLE);
/** Rows L-K3-F01…F12, the Σ row of the cells, then the "Tròn(Σ đủ)" row. */
export const AS_HR_ROWS = parse(AS_HR_TABLE);
