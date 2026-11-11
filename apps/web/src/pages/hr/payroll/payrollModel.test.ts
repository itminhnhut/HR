import { EMPTY_MONTH_INPUTS } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import type { PayrollLineDto } from '../../../api';
import {
  columnTotals,
  configLink,
  contractShort,
  filterLines,
  gridRowsOf,
  monthFromParam,
  payrollBands,
  regionShort,
  timesheetLink,
} from './payrollModel';

/** The payroll grid's rows, columns, links and filters (spec 11.2, 4.1, 4.4). Cases: docs/test-cases-luong.md, L. */

const line = (over: Partial<PayrollLineDto>): PayrollLineDto => ({
  employeeId: 'nv-a',
  code: 'NV01',
  fullName: 'NV A',
  department: 'Hành chính',
  regionId: 'hcm',
  contractTypeId: 'khong-thoi-han',
  block: 'BO',
  probation: false,
  norm: 22,
  amounts: {},
  kpiAmount: 0,
  cells: {} as PayrollLineDto['cells'],
  explain: {},
  overrides: [],
  personSettings: [],
  note: '',
  inputs: EMPTY_MONTH_INPUTS,
  ...over,
});

const PEOPLE = [
  line({ employeeId: 'a', code: 'NV01', fullName: 'NV A' }),
  line({ employeeId: 'c', code: 'NV03', fullName: 'NV C', block: 'KD', department: 'Kinh doanh' }),
  line({ employeeId: 'g', code: 'NV07', fullName: 'NV G', contractTypeId: 'thu-viec', probation: true }),
  line({ employeeId: 'k', code: 'NV11', fullName: 'NV K', regionId: 'hn', block: 'KD', department: 'Kinh doanh' }),
];

const NAMES = {
  regions: { hcm: 'Hồ Chí Minh', hn: 'Hà Nội' },
  contracts: { 'khong-thoi-han': 'Không thời hạn', 'thu-viec': 'Thử việc' },
};

describe('the rows of the grid', () => {
  it('L-K1-18: should open each region, contract type and block group with a heading row, and end on the total row', () => {
    // Act
    const rows = gridRowsOf(PEOPLE, NAMES);

    // Assert
    expect(rows.map((r) => (r.kind === 'line' ? r.line.fullName : `${r.kind}:${r.label}`))).toEqual([
      'group:Hồ Chí Minh · Không thời hạn · BO',
      'NV A',
      'group:Hồ Chí Minh · Không thời hạn · KD',
      'NV C',
      'group:Hồ Chí Minh · Thử việc · BO',
      'NV G',
      'group:Hà Nội · Không thời hạn · KD',
      'NV K',
      'total:Tổng cộng 4 người',
    ]);
  });

  it('L-L13: should number only the people, in order, across the groups', () => {
    // Act
    const rows = gridRowsOf(PEOPLE, NAMES);

    // Assert
    expect(rows.filter((r) => r.kind === 'line').map((r) => (r.kind === 'line' ? r.stt : 0))).toEqual([1, 2, 3, 4]);
  });
});

describe('the columns, in the order of HR file', () => {
  it('L-L13: should band the columns from the frozen name columns to the notes, in the file order', () => {
    // Act
    const bands = payrollBands([
      { id: 'luong', name: 'Lương thời gian' },
      { id: 'xang', name: 'Xăng xe' },
      { id: 'dien-thoai', name: 'Điện thoại' },
    ]);

    // Assert
    expect(bands.map((b) => b.id)).toEqual(['info', 'more', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const numbers = bands.flatMap((b) => b.columns.map((c) => c.no)).filter((n): n is string => n !== null);
    expect(numbers).toEqual([
      '8',
      '11a',
      '11b',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
      '21',
      '22',
      '23',
      '24',
      '25',
      '26',
      '27',
      '28',
      '29',
      '30',
      '31',
      '32',
      '33',
      '34',
      '35',
      '36',
      '37',
      '38',
      '40',
      '41',
      '42',
      '43',
      '44',
      '45',
      '46',
      '47',
      '48',
    ]);
  });

  it('L-L11: should link the norm, the days and rest-day, holiday cells to the timesheet, and nothing HR types', () => {
    // Act
    const linked = payrollBands([])
      .flatMap((b) => b.columns)
      .filter((c) => c.toTimesheet)
      .map((c) => c.no ?? c.id);

    // Assert
    expect(linked).toEqual(['norm', '17', '22', '23']);
  });
});

describe('links back to the source', () => {
  it("L-L11: should open the person's cell on the timesheet of that period", () => {
    // Act
    const href = timesheetLink({ monthKey: '2026-10', to: '2026-10-25' }, 'nv-a');

    // Assert
    expect(href).toBe('/hr/cham-cong?ky=2026-10&ngay=2026-10-25&nv=nv-a');
  });

  it('L-L09: should open Cấu hình on the section and the month of the version used', () => {
    // Act
    const href = configLink('2026-10', { key: 'luat.tran-tien-an', area: 'tham-so' });

    // Assert
    expect(href).toBe('/hr/luong/cau-hinh?ky=2026-10&muc=tham-so&khoa=luat.tran-tien-an');
  });
});

describe('the period in the address', () => {
  it('L-L05: should take the current period when the address has none', () => {
    // Act
    const picked = monthFromParam(null, '2026-11-08');

    // Assert
    expect(picked).toEqual({ ok: true, year: 2026, month: 11 });
  });

  it('L-L05: should take the period after the 25th as the next month', () => {
    // Act
    const picked = monthFromParam(null, '2026-11-26');

    // Assert
    expect(picked).toEqual({ ok: true, year: 2026, month: 12 });
  });

  it('L-L07: should say what a period looks like instead of opening another one quietly', () => {
    // Act
    const picked = monthFromParam('abc', '2026-11-08');

    // Assert
    expect(picked).toEqual({ ok: false, message: 'Kỳ “abc” không đúng dạng. Kỳ ghi dạng 2026-11 (năm-tháng).' });
  });
});

describe('the shared filters', () => {
  it('L-L06: should combine region, contract type, block, department and search', () => {
    // Act
    const shown = filterLines(PEOPLE, {
      people: [],
      depts: ['Kinh doanh'],
      regions: ['hcm'],
      contracts: [],
      blocks: ['KD'],
      query: 'nv c',
    });

    // Assert
    expect(shown.map((l) => l.fullName)).toEqual(['NV C']);
  });

  it('L-L06: should pick people by id and find a code without its accents or case', () => {
    // Act
    const byPerson = filterLines(PEOPLE, {
      people: ['g', 'k'],
      depts: [],
      regions: [],
      contracts: [],
      blocks: [],
      query: '',
    });
    const byCode = filterLines(PEOPLE, {
      people: [],
      depts: [],
      regions: [],
      contracts: ['thu-viec'],
      blocks: [],
      query: 'nv07',
    });

    // Assert
    expect(byPerson.map((l) => l.fullName)).toEqual(['NV G', 'NV K']);
    expect(byCode.map((l) => l.fullName)).toEqual(['NV G']);
  });
});

describe('the total row', () => {
  it('L-L13: should total each money column over the rows shown, not the whole month', () => {
    // Arrange
    const bands = payrollBands([{ id: 'luong', name: 'Lương thời gian' }]);
    const shown = [
      line({
        employeeId: 'a',
        amounts: { luong: 6_400_000 },
        kpiAmount: 1_000_000,
        cells: { netPay: 18_516_850, paidDays: 22 } as PayrollLineDto['cells'],
      }),
      line({
        employeeId: 'b',
        amounts: { luong: 5_000_000 },
        kpiAmount: 0,
        cells: { netPay: 7_322_727, paidDays: 20 } as PayrollLineDto['cells'],
      }),
    ];

    // Act
    const totals = columnTotals(shown, bands);

    // Assert
    expect(totals['muc:luong']).toBe(11_400_000);
    expect(totals.kpiAmount).toBe(1_000_000);
    expect(totals.netPay).toBe(25_839_577);
    expect(totals.paidDays).toBeUndefined();
    expect(totals.kpiPercent).toBeUndefined();
  });

  it('L-L13: should give every money column of the file a total', () => {
    // Arrange
    const bands = payrollBands([{ id: 'luong', name: 'Lương thời gian' }]);
    const money = bands.flatMap((b) => b.columns).filter((c) => c.kind === 'money');

    // Act
    const totals = columnTotals([line({})], bands);

    // Assert
    expect(money.map((c) => c.no)).toEqual([
      '8',
      '15',
      '16',
      '18',
      '20',
      '24',
      '25',
      '26',
      '27',
      '28',
      '29',
      '30',
      '31',
      '32',
      '33',
      '34',
      '35',
      '36',
      '37',
      '38',
      '40',
      '41',
      '42',
      '43',
      '44',
      '45',
      '46',
      '47',
      '48',
    ]);
    expect(money.every((c) => totals[c.id] === 0)).toBe(true);
  });
});

describe('the short names in the chips', () => {
  it('should shorten a region of several words to its initials', () => {
    // Act / Assert
    expect(regionShort('Hồ Chí Minh')).toBe('HCM');
    expect(regionShort('Hà Nội')).toBe('HN');
    expect(regionShort('Đà Nẵng')).toBe('ĐN');
    expect(regionShort('Huế')).toBe('Huế');
  });

  it('should shorten only a long contract type, keeping its leading code', () => {
    // Act / Assert
    expect(contractShort('HĐLĐ không xác định thời hạn')).toBe('HĐLĐ KXĐTH');
    expect(contractShort('HĐLĐ 12 tháng')).toBe('HĐLĐ 12 tháng');
    expect(contractShort('HĐ thử việc')).toBe('HĐ thử việc');
  });
});
