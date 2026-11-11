import { DEFAULT_COMPONENTS, type PayComponent } from './defaults-company.js';
import type { SettingRow } from './setting-core.js';

/**
 * The configuration of HR's October file, as setting rows from a month (spec 5.9, last paragraph): one "Xăng xe + ĐT"
 * component exempt in full (the default too since 17.3 K2), meal and clothing exempt in full, only the time pay
 * insured, no KPCĐ, 10% on (26), BHYT whatever the reason, Sundays without the extra 100%, rounding "as HR's file",
 * 10% after leaving for short contracts only. Used by the golden month and by the local check against the real file; the default
 * configuration stays the web's.
 */
export function asHrFileSettings(fromMonth: string): SettingRow[] {
  const source = 'Cấu hình file Excel T10 của HR';
  const exempt = { kind: 'exempt' } as const;
  const components = DEFAULT_COMPONENTS.flatMap((c): PayComponent[] => {
    if (c.id === 'xang-dt') return [{ ...c, tax: exempt }];
    if (c.id === 'com' || c.id === 'trang-phuc') return [{ ...c, tax: exempt }];
    if (c.id === 'trach-nhiem' || c.id === 'chuyen-can') return [{ ...c, insured: false }];
    return [c];
  });
  const row = (key: string, value: unknown): SettingRow => ({ key, employeeId: null, from: fromMonth, value, source });
  return [
    row('khoan.danh-sach', components),
    row('tuy-chon.d01', 'as-hr'),
    row('tuy-chon.d02', 'income'),
    row('tuy-chon.d03', 'off'),
    row('tuy-chon.d04', 'pay'),
    row('tuy-chon.d10', 'flat10-short-only'),
    row('tuy-chon.d12', 'swap-day'),
  ];
}
