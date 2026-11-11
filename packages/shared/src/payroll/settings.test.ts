import { describe, expect, it } from 'vitest';
import { componentsFor, LAW_SETTINGS, lawParamsFor, payrollDates, settingFor, type SettingRow } from './index.js';

/**
 * Versioned settings: a default, a row for everyone from a month, a row for one person from a month.
 * Cases: docs/test-cases-luong.md, L-A03, L-A04, L-L01, L-L02.
 */

describe('law parameters by their reference date (spec R2)', () => {
  it('L-A03: should take the insurance cap from the base salary in force on day 1 of the insurance month', () => {
    // Arrange: base salary 2.340.000, then 2.530.000 from 01/07/2026 (the built-in defaults)
    const june = payrollDates(2026, 6);
    const july = payrollDates(2026, 7);

    // Act
    const forJune = lawParamsFor([], june);
    const forJuly = lawParamsFor([], july);

    // Assert: June 46,8 tr; July 50,6 tr for the whole period 26/06–25/07, no split
    expect(june.insuranceMonth).toBe('2026-06');
    expect(july.insuranceMonth).toBe('2026-07');
    expect(forJune.socialCap).toBe(46_800_000);
    expect(forJuly.socialCap).toBe(50_600_000);
  });

  it('L-A04: should take the meal cap and the 10% threshold in force on the pay date', () => {
    // Arrange: T5 is paid 05/06, T6 is paid 05/07
    const may = payrollDates(2026, 5);
    const june = payrollDates(2026, 6);

    // Act
    const forMay = lawParamsFor([], may);
    const forJune = lawParamsFor([], june);

    // Assert: T5 old values, T6 new values because it is paid after 01/07
    expect(may.payDate).toBe('2026-06-05');
    expect(june.payDate).toBe('2026-07-05');
    expect([forMay.mealCap, forMay.flatThreshold]).toEqual([730_000, 2_000_000]);
    expect([forJune.mealCap, forJune.flatThreshold]).toEqual([1_200_000, 5_000_000]);
  });

  it('L-J03: should put T12 paid on 05/01 into the next tax year while its insurance month stays December', () => {
    // Act
    const dates = payrollDates(2026, 12);

    // Assert
    expect(dates).toMatchObject({ insuranceMonth: '2026-12', payDate: '2027-01-05', taxYear: 2027 });
  });

  it('should move the tax parameters with a pay date HR changed before approval', () => {
    // Arrange: T6 paid on 30/06 instead of 05/07 (L-A05)
    const dates = payrollDates(2026, 6, '2026-06-30');

    // Act
    const params = lawParamsFor([], dates);

    // Assert
    expect(params.mealCap).toBe(730_000);
  });

  it('should refuse to guess when two live rows share a key, a scope and a date', () => {
    // Arrange
    const rows: SettingRow[] = [
      {
        key: 'luat.giam-tru',
        employeeId: null,
        from: '2026-01-01',
        value: { personal: 15_500_000, dependant: 6_200_000 },
      },
      {
        key: 'luat.giam-tru',
        employeeId: null,
        from: '2026-01-01',
        value: { personal: 11_000_000, dependant: 4_400_000 },
      },
    ];

    // Act / Assert
    expect(() => lawParamsFor(rows, payrollDates(2026, 10))).toThrow(/luat.giam-tru/);
  });

  it('should skip a row that a correction replaced', () => {
    // Arrange: a typo fixed with "Sửa lỗi" (R5)
    const rows: SettingRow[] = [
      { id: 'a', key: 'luat.luong-co-so', employeeId: null, from: '2026-07-01', value: 2_350_000, supersededBy: 'b' },
      { id: 'b', key: 'luat.luong-co-so', employeeId: null, from: '2026-07-01', value: 2_530_000 },
    ];

    // Act
    const params = lawParamsFor(rows, payrollDates(2026, 10));

    // Assert
    expect(params.baseSalary).toBe(2_530_000);
  });
});

describe('one person wins over everyone, from a month (spec 6.1)', () => {
  const rows: SettingRow[] = [
    { key: 'khoan.com.thue', employeeId: 'nv-a', from: '2026-12', value: { kind: 'taxable' } },
    { key: 'khoan.com.thue', employeeId: 'nv-a', from: '2027-03', value: null, stop: true },
  ];
  const mealTaxOf = (personId: string, month: string) =>
    componentsFor(rows, personId, month).find((c) => c.id === 'com')?.tax;

  it('L-L01: should apply a person override only from its month until the month it stops', () => {
    // Act
    const months = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'].map((m) => mealTaxOf('nv-a', m));

    // Assert: T11 default, T12–T2 override, from T3 default again
    expect(months).toEqual([
      { kind: 'cap', cap: 'meal' },
      { kind: 'taxable' },
      { kind: 'taxable' },
      { kind: 'taxable' },
      { kind: 'cap', cap: 'meal' },
    ]);
  });

  it('L-L01: should leave everyone else on the default', () => {
    expect(mealTaxOf('nv-b', '2027-01')).toEqual({ kind: 'cap', cap: 'meal' });
  });

  it('L-L01: should say which row a value came from, so the cell can link to it', () => {
    // Act
    const resolved = settingFor(rows, 'khoan.com.thue', 'nv-a', '2027-01');

    // Assert
    expect(resolved).toMatchObject({ from: '2026-12', employeeId: 'nv-a', isDefault: false });
  });

  it('L-L02: should change everyone from a month while a person override keeps its own value', () => {
    // Arrange
    const rateRows: SettingRow[] = [
      { key: 'quy-tac.ty-le-thu-viec', employeeId: null, from: '2026-12', value: 0.95 },
      { key: 'quy-tac.ty-le-thu-viec', employeeId: 'nv-b', from: '2026-12', value: 0.9 },
    ];
    const rate = (personId: string, month: string) =>
      settingFor(rateRows, 'quy-tac.ty-le-thu-viec', personId, month).value;

    // Act / Assert
    expect([rate('nv-a', '2026-11'), rate('nv-b', '2026-11')]).toEqual([0.9, 0.9]);
    expect([rate('nv-a', '2026-12'), rate('nv-b', '2026-12')]).toEqual([0.95, 0.9]);
  });

  it('L-A24: should refuse a probation rate below the 85% the law allows', () => {
    // Arrange
    const rateRows: SettingRow[] = [{ key: 'quy-tac.ty-le-thu-viec', employeeId: null, from: '2026-12', value: 0.8 }];

    // Act / Assert
    expect(() => settingFor(rateRows, 'quy-tac.ty-le-thu-viec', null, '2026-12')).toThrow(/quy-tac.ty-le-thu-viec/);
  });

  it('should ignore a person row for a setting that cannot be set per person', () => {
    // Arrange: D01 has no per-person override (spec 9)
    const optionRows: SettingRow[] = [{ key: 'tuy-chon.d01', employeeId: 'nv-a', from: '2026-10', value: 'as-hr' }];

    // Act
    const resolved = settingFor(optionRows, 'tuy-chon.d01', 'nv-a', '2026-10');

    // Assert
    expect(resolved.value).toBe('cell');
  });
});

describe('sources of the law defaults (spec 5.8, Q6)', () => {
  it('should cite a legal document for every built-in law value, never the spec', () => {
    // Arrange: the source is shown in the tooltip, the "Tham số áp dụng" sheet and the approval snapshot
    const sources = Object.values(LAW_SETTINGS).flatMap((def) => def.defaults.map((d) => `${def.key}: ${d.source}`));
    const document = /(Luật|BLLĐ|NĐ|NQ|QĐ|TT|VBHN) /;

    // Act
    const withoutDocument = sources.filter((s) => !document.test(s.split(': ')[1] ?? ''));
    const citingSpec = sources.filter((s) => /spec/i.test(s));

    // Assert
    expect(withoutDocument).toEqual([]);
    expect(citingSpec).toEqual([]);
  });

  it('should name NĐ 73/2024 for the base salary in force before 01/07/2026', () => {
    // Act
    const june = lawParamsFor([], payrollDates(2026, 6)).used.find((u) => u.key === 'luat.luong-co-so');

    // Assert
    expect([june?.value, june?.source]).toEqual([2_340_000, 'NĐ 73/2024/NĐ-CP Đ.3']);
  });
});

describe('the progressive tax table (luat.bieu-thue)', () => {
  const schema = LAW_SETTINGS['luat.bieu-thue'].schema;
  const messagesOf = (value: unknown) => schema.safeParse(value).error?.issues.map((i) => i.message) ?? [];

  it('should accept the table of the law in force', () => {
    // Arrange
    const table = LAW_SETTINGS['luat.bieu-thue'].defaults.map((d) => d.value);

    // Act / Assert
    expect(table.every((value) => schema.safeParse(value).success)).toBe(true);
  });

  it('should refuse a table whose last bracket has a top', () => {
    // Act
    const messages = messagesOf([
      { upTo: 10_000_000, rate: 0.05 },
      { upTo: 30_000_000, rate: 0.1 },
    ]);

    // Assert
    expect(messages).toEqual(['Bậc cuối của biểu thuế không có mức trên (để trống).']);
  });

  it('should refuse a table whose tops do not rise bracket by bracket', () => {
    // Act
    const messages = messagesOf([
      { upTo: 30_000_000, rate: 0.05 },
      { upTo: 10_000_000, rate: 0.1 },
      { upTo: null, rate: 0.2 },
    ]);

    // Assert
    expect(messages).toEqual(['Mức trên của các bậc phải tăng dần.']);
  });

  it('should refuse a table with an open bracket before the last', () => {
    // Act
    const messages = messagesOf([
      { upTo: 10_000_000, rate: 0.05 },
      { upTo: null, rate: 0.1 },
      { upTo: null, rate: 0.2 },
    ]);

    // Assert
    expect(messages).toEqual(['Chỉ bậc cuối được để trống mức trên.']);
  });
});
