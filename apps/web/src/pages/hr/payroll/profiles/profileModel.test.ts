import { describe, expect, it } from 'vitest';
import { EMPTY_MONTH_INPUTS } from '@careers/shared';
import type { PayrollLineDto } from '../../../../api';
import { person } from '../payrollTestData';
import { checkValueWords, filterProfiles, summaryOf, type ProfileRow } from './profileModel';

/** The checklist in a person's Hồ sơ lương shows names, not ids. */

const CATALOGUE = {
  contractTypes: [{ id: 'khong-thoi-han', name: 'HĐLĐ không xác định thời hạn' }],
  components: [
    { id: 'xang-dt', name: 'Xăng xe + ĐT' },
    { id: 'trang-phuc', name: 'Trang phục' },
  ],
};

describe('checkValueWords', () => {
  it('should show the contract type by its name', () => {
    expect(checkValueWords('khong-thoi-han', CATALOGUE)).toBe('HĐLĐ không xác định thời hạn');
  });

  it('should show every component by its name and keep the amounts', () => {
    expect(checkValueWords('xang-dt 3.000.000, trang-phuc 400.000', CATALOGUE)).toBe(
      'Xăng xe + ĐT 3.000.000, Trang phục 400.000',
    );
  });

  it('should leave words that are not an id as they are', () => {
    expect(checkValueWords('60 ngày (mặc định)', CATALOGUE)).toBe('60 ngày (mặc định)');
    expect(checkValueWords('xang-dt-khac 1', CATALOGUE)).toBe('xang-dt-khac 1');
  });
});

describe('the person at a glance, from the payroll month viewed (F20)', () => {
  it('should read gross, dependants, the tax method, the recurring (32) and the account off the row', () => {
    // Arrange: (32) is 630.000 of recurring items less a 500.000 advance typed this month.
    const line = person({
      cells: { gross: 19_000_000, cash: 130_000 } as PayrollLineDto['cells'],
      inputs: { ...EMPTY_MONTH_INPUTS, cash: [{ kind: 'advance', amount: 500_000, reason: '' }] },
      sheet: {
        title: '',
        dependants: 2,
        taxMethod: 'none',
        paid: {},
        payslipEmail: null,
        bankName: null,
        bankAccount: null,
      },
    });

    // Act + Assert
    expect(summaryOf(line)).toEqual({
      gross: 19_000_000,
      dependants: 2,
      tax: 'Có cam kết',
      recurring: 630_000,
      account: 'Thiếu',
    });
  });

  it('should have nothing to say of someone without a row in the month', () => {
    // Act + Assert
    expect(summaryOf(undefined)).toBeNull();
  });
});

describe('the Đang làm filter (F20)', () => {
  const FILTERS = { query: '', depts: [], blocks: [], status: 'working', onlyMissing: false } as const;
  const row = (over: Partial<ProfileRow>): ProfileRow => ({
    employeeId: 'nv-a',
    code: 'NV01',
    fullName: 'NV A',
    employment: 'official',
    block: 'BO',
    joinedOn: '2025-01-06',
    leftOn: null,
    hasProfile: true,
    hasOverrides: false,
    department: '',
    regionId: '',
    title: '',
    officialOn: null,
    open: [],
    summary: null,
    ...over,
  });

  it('should keep someone who has left but is still paid in the month viewed, and hide one who is not', () => {
    // Arrange
    const paid = row({ employeeId: 'nv-b', leftOn: '2026-10-20', summary: summaryOf(person({})) });
    const gone = row({ employeeId: 'nv-c', leftOn: '2026-05-31' });

    // Act
    const working = filterProfiles([row({}), paid, gone], { ...FILTERS, depts: [], blocks: [] }, '2026-11-08');
    const left = filterProfiles(
      [row({}), paid, gone],
      { ...FILTERS, depts: [], blocks: [], status: 'left' },
      '2026-11-08',
    );

    // Assert
    expect(working.map((r) => r.employeeId)).toEqual(['nv-a', 'nv-b']);
    expect(left.map((r) => r.employeeId)).toEqual(['nv-b', 'nv-c']);
  });
});
