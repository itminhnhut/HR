import { describe, expect, it } from 'vitest';
import { componentDefaults, probationDaysOf, regionalMinimum } from './payroll-catalogue.js';
import { payDateOf, payDayFor, readOn, type Row } from './payroll-versions.js';

/** What a profile reads from Cấu hình when nothing is stored: the payroll engine's defaults. Amounts are fake. */

const NOBODY = '00000000-0000-4000-8000-000000000001';
const REGION = '00000000-0000-4000-8000-000000000002';

const row = (over: Partial<Row> & Pick<Row, 'key' | 'from' | 'value'>): Row => ({
  id: `${over.key}-${over.from}`,
  employeeId: null,
  ...over,
});

describe('payroll catalogue without stored rows', () => {
  it('should prefill the engine’s default component amounts when no component list is stored', () => {
    // Arrange
    const rows: Row[] = [];

    // Act
    const amounts = componentDefaults(rows, NOBODY, '2026-11');

    // Assert
    expect(amounts).toEqual({
      luong: 0,
      'trach-nhiem': 0,
      com: 1_200_000,
      'xang-dt': 0,
      'trang-phuc': 400_000,
      'nha-o': 0,
      'chuyen-can': 1_200_000,
    });
  });

  it('should apply a stored default amount on top of the engine’s component list', () => {
    // Arrange
    const rows = [row({ key: 'khoan.com.muc-mac-dinh', from: '2026-11', value: 1_200_000 })];

    // Act
    const amounts = componentDefaults(rows, NOBODY, '2026-11');

    // Assert
    expect(amounts.com).toBe(1_200_000);
  });

  it('should give 60 probation days for an engine contract type and for an unknown one', () => {
    // Arrange
    const rows: Row[] = [];

    // Act
    const known = probationDaysOf(rows, 'thu-viec', NOBODY, '2026-11');
    const unknown = probationDaysOf(rows, 'khong-co', NOBODY, '2026-11');

    // Assert
    expect([known, unknown]).toEqual([60, 60]);
  });

  it('should read the engine’s regional minimum when none is stored', () => {
    // Arrange
    const rows: Row[] = [];

    // Act
    const minimum = regionalMinimum(rows, { id: NOBODY, regionId: REGION }, '2026-11-01');

    // Assert
    expect(minimum).toEqual({ zone: 'I', amount: 5_310_000 });
  });

  it('should read the zone stored for the person’s region', () => {
    // Arrange
    const rows = [row({ key: `khu-vuc.${REGION}.vung`, from: '2026-01', value: 'III' })];

    // Act
    const minimum = regionalMinimum(rows, { id: NOBODY, regionId: REGION }, '2026-11-01');

    // Assert
    expect(minimum).toEqual({ zone: 'III', amount: 4_140_000 });
  });
});

describe('payroll catalogue before the engine’s defaults start', () => {
  it('should prefill nothing, give 60 probation days and no regional minimum in 2025', () => {
    // Arrange
    const rows: Row[] = [];

    // Act
    const amounts = componentDefaults(rows, NOBODY, '2025-12');
    const days = probationDaysOf(rows, 'thu-viec', NOBODY, '2025-12');
    const minimum = regionalMinimum(rows, { id: NOBODY, regionId: REGION }, '2025-12-01');

    // Assert
    expect([amounts, days, minimum]).toEqual([{}, 60, null]);
  });

  it('should pay on day 5 of the next month in 2025', () => {
    // Arrange
    const rows: Row[] = [];

    // Act
    const payDate = payDateOf('2025-12', payDayFor(rows, '2025-12'));

    // Assert
    expect(payDate).toBe('2026-01-05');
  });
});

describe('payroll dates without stored rows', () => {
  it('should pay on the engine’s default day 5 of the next month', () => {
    // Arrange
    const rows: Row[] = [];

    // Act
    const payDay = payDayFor(rows, '2026-12');

    // Assert
    expect(payDay).toBe(5);
    expect(payDateOf('2026-12', payDay)).toBe('2027-01-05');
  });

  it('should read a tax parameter on the stored pay date and an insurance one on day 1', () => {
    // Arrange
    const rows = [row({ key: 'quy-tac.ngay-chi-tra', from: '2026-01', value: 10 })];

    // Act
    const tax = readOn({ scope: 'date', group: 'tax' }, '2026-11', rows);
    const insurance = readOn({ scope: 'date', group: 'insurance' }, '2026-11', rows);
    const month = readOn({ scope: 'month' }, '2026-11', rows);

    // Assert
    expect([tax, insurance, month]).toEqual(['2026-12-10', '2026-11-01', '2026-11']);
  });
});
