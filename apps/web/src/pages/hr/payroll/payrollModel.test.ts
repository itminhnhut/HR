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
  taxBracketOf,
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
    expect(bands.map((b) => b.id)).toEqual(['info', 'more', 'A', 'B', 'B2', 'B3', 'C', 'D', 'E', 'F', 'G', 'H']);
    // F01: the letters and the columns under each are those of HR's file.
    const numbersOf = (id: string) => bands.find((b) => b.id === id)?.columns.map((c) => c.no);
    expect(bands.slice(3).map((b) => b.label)).toEqual([
      'B · CHẤM CÔNG & ĐÁNH GIÁ',
      'B2 · LÀM THÊM GIỜ',
      'B3 · KHÁC',
      'C · THU NHẬP',
      'D · KHẤU TRỪ NGƯỜI LAO ĐỘNG',
      'E · THUẾ TNCN',
      'F · THANH TOÁN',
      'G · CHI PHÍ CÔNG TY',
      'H · GHI CHÚ',
    ]);
    expect(numbersOf('B')).toEqual([null, '17', '18', '19', '20']);
    expect(numbersOf('B2')).toEqual(['21', '22', '23']);
    expect(numbersOf('B3')).toEqual(['24']);
    expect(numbersOf('C')).toEqual(['25', '26']);
    expect(numbersOf('D')).toEqual(['27', '28', '29', '30', '31', '32']);
    const numbers = bands.flatMap((b) => b.columns.map((c) => c.no)).filter((n): n is string => n !== null);
    // C05: the fixed columns and the file's (5) carry the file's numbers too.
    expect(numbers).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
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
      '39',
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

  it('F02: should name the columns as HR file does, with the insurance rates of the month in the headings', () => {
    // Arrange
    const rates = {
      employee: { social: 0.08, health: 0.015, unemployment: 0.01 },
      company: { social: 0.175, health: 0.03, unemployment: 0.01 },
      unionFund: 0.02,
    };

    // Act
    const columns = payrollBands([], rates).flatMap((b) => b.columns);
    const labelOf = (no: string) => columns.find((c) => c.no === no)?.label;

    // Assert
    expect(['15', '17', '19', '47'].map(labelOf)).toEqual([
      'Thưởng KPI (100%)',
      'Ngày công thực tế',
      '% đánh giá KPI',
      'Tổng BH + KPCĐ Cty',
    ]);
    expect(['28', '29', '30'].map(labelOf)).toEqual(['BHXH (8%)', 'BHYT (1,5%)', 'BHTN (1%)']);
    expect(['43', '44', '45', '46'].map(labelOf)).toEqual([
      'BHXH Cty (17,5%)',
      'BHYT Cty (3%)',
      'BHTN Cty (1%)',
      'KPCĐ (2%)',
    ]);
    expect(columns.find((c) => c.no === '15')?.title).toBe('Thưởng KPI / Hiệu suất (100%)');
  });

  it('F03: should show the title, the dependants and the tax bracket of HR file, the info columns in its order', () => {
    // Act
    const bands = payrollBands([]);

    // Assert
    expect(bands.find((b) => b.id === 'more')?.columns.map((c) => c.label)).toEqual([
      'Chức danh',
      'Bộ phận (khối)',
      'Loại HĐ',
      'Khu vực',
      'Số NPT',
      'Phòng ban',
    ]);
    expect(bands.find((b) => b.id === 'E')?.columns.map((c) => c.no)).toEqual([
      '33',
      '34',
      '35',
      '36',
      '37',
      '38',
      '39',
      '40',
    ]);
  });

  it('F03: should give the bracket (38) reaches only when the tax of the month is progressive', () => {
    // Arrange
    const brackets = [{ upTo: 10_000_000 }, { upTo: 30_000_000 }, { upTo: null }];
    const person = (assessable: number, taxMethod: 'progressive' | 'flat10') =>
      line({
        cells: { assessable } as PayrollLineDto['cells'],
        sheet: { title: '', dependants: 0, taxMethod, paid: {}, payslipEmail: null, bankName: null, bankAccount: null },
      });

    // Act + Assert
    expect(taxBracketOf(person(10_000_000, 'progressive'), brackets)).toBe(1);
    expect(taxBracketOf(person(10_000_001, 'progressive'), brackets)).toBe(2);
    expect(taxBracketOf(person(90_000_000, 'progressive'), brackets)).toBe(3);
    expect(taxBracketOf(person(0, 'progressive'), brackets)).toBe(0);
    expect(taxBracketOf(person(20_000_000, 'flat10'), brackets)).toBe(0);
    expect(taxBracketOf(person(20_000_000, 'progressive'), undefined)).toBe(0);
  });

  it('F27: should number a component HR added after Chuyên cần (14a), (14b), the columns of HR file keeping theirs', () => {
    // Act
    const bands = payrollBands([
      { id: 'luong', name: 'Lương thời gian' },
      { id: 'chuyen-can', name: 'Chuyên cần' },
      { id: 'pc-doc-hai', name: 'PC độc hại' },
      { id: 'pc-xa-nha', name: 'PC xa nhà' },
    ]);

    // Assert
    expect(bands.find((b) => b.id === 'A')?.columns.map((c) => [c.no, c.label])).toEqual([
      ['8', 'Lương thời gian'],
      ['14', 'Chuyên cần'],
      ['14a', 'PC độc hại'],
      ['14b', 'PC xa nhà'],
      ['15', 'Thưởng KPI (100%)'],
      ['16', 'Gross thoả thuận'],
    ]);
  });

  it('F02: should leave the rate out of a heading while the rates of the month are not read', () => {
    // Act
    const columns = payrollBands([]).flatMap((b) => b.columns);

    // Assert
    expect(columns.find((c) => c.no === '28')?.label).toBe('BHXH');
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

  it('F04: should total the overtime hours and the rest-day and holiday days as HR file does, not (17) or (19)', () => {
    // Arrange
    const bands = payrollBands([]);
    const cells = (over: Partial<PayrollLineDto['cells']>) => over as PayrollLineDto['cells'];
    const shown = [
      line({ cells: cells({ overtimeHours: 0.1, restDays: 1, holidayDays: 0.5, paidDays: 22, kpiPercent: 1 }) }),
      line({ cells: cells({ overtimeHours: 0.2, restDays: 0.5, holidayDays: 0, paidDays: 20, kpiPercent: 0.8 }) }),
    ];

    // Act
    const totals = columnTotals(shown, bands);

    // Assert
    expect(totals.overtimeHours).toBe(0.3);
    expect(totals.restDays).toBe(1.5);
    expect(totals.holidayDays).toBe(0.5);
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
    // F16: every money column but (18), a daily rate, which HR's file leaves empty on the total row.
    expect(money.filter((c) => c.no !== '18').every((c) => totals[c.id] === 0)).toBe(true);
    expect(totals.dailyRate).toBeUndefined();
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
