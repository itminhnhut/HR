import { DEFAULT_COMPONENTS, type PayComponent, type SettingRow } from '../src/payroll/index.js';

/**
 * Anonymous inputs of the payroll test catalogue (docs/test-cases-luong.md, section K). Every amount is illustrative,
 * none comes from HR's file. Lives outside `src` so it never ships.
 */

/**
 * "Hồ sơ K": every component paid by the day and × the probation rate; salary and position insured (attendance not, by
 * default); "Xăng xe + ĐT" one component exempt in full (17.3 K2).
 */
export const PROFILE_K: Readonly<Record<string, number>> = {
  luong: 8_000_000,
  'trach-nhiem': 1_500_000,
  com: 1_100_000,
  'xang-dt': 2_000_000,
  'trang-phuc': 350_000,
  'nha-o': 8_500_000,
  'chuyen-can': 1_000_000,
};

export const KPI_K = 10_500_000;

/** L-K1-17: a probation person on a high income. */
export const PROFILE_HIGH: Readonly<Record<string, number>> = {
  luong: 21_000_000,
  com: 1_100_000,
  'xang-dt': 2_000_000,
  'nha-o': 10_300_000,
  'chuyen-can': 1_000_000,
};

/**
 * A company that pays fuel and phone apart (spec 5.9): "Xăng xe" taxable, "Điện thoại" exempt up to the level in the
 * contract or rules, in place of the default "Xăng xe + ĐT", from `from`.
 */
export function splitFuelPhoneRows(from: string): SettingRow[] {
  const components = DEFAULT_COMPONENTS.flatMap((c): PayComponent[] =>
    c.id === 'xang-dt'
      ? [
          { ...c, id: 'xang', name: 'Xăng xe', tax: { kind: 'taxable' } },
          { ...c, id: 'dien-thoai', name: 'Điện thoại', tax: { kind: 'cap', cap: 'regulated' } },
        ]
      : [c],
  );
  return [
    {
      key: 'khoan.danh-sach',
      employeeId: null,
      from,
      value: components,
      source: 'Công ty trả xăng xe, điện thoại riêng',
    },
  ];
}
