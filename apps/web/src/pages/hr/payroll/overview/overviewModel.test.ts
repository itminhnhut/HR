import { describe, expect, it } from 'vitest';
import type { PayrollLineDto, PayrollMonthDto } from '../../../../api';
import { filtersFromParams } from '../payrollModel';
import { month, person } from '../payrollTestData';
import {
  breakdownOf,
  gridLink,
  overviewFromParams,
  overviewSearch,
  reviewLink,
  sumsOf,
  yearRowsOf,
  yearTotalsOf,
  type MonthLoad,
} from './overviewModel';

/** Tổng quan (spec 11.8, step 26). Cases: docs/test-cases-luong.md L-G02, L-G05, L-G06, L-G07, L-G11, L-L32. */

const cells = (over: Partial<PayrollLineDto['cells']>) => over as PayrollLineDto['cells'];

const A = person({
  employeeId: 'nv-a',
  block: 'BO',
  department: 'Hành chính',
  regionId: 'hcm',
  contractTypeId: 'khong-thoi-han',
  cells: cells({
    income: 10_000_000,
    social: 800_000,
    health: 150_000,
    unemployment: 100_000,
    companyTotal: 2_150_000,
    tax: 300_000,
    netPay: 8_650_000,
    totalCost: 12_150_000,
  }),
});
const J = person({
  employeeId: 'nv-j',
  code: 'NV10',
  fullName: 'NV J',
  block: 'KD',
  department: 'Kinh doanh',
  regionId: 'hn',
  contractTypeId: 'thu-viec',
  cells: cells({
    income: 6_000_000,
    social: 0,
    health: 0,
    unemployment: 0,
    companyTotal: 0,
    tax: 600_000,
    netPay: 5_400_000,
    totalCost: 6_000_000,
  }),
});
const NO_BLOCK = person({ ...J, employeeId: 'nv-k', code: 'NV11', fullName: 'NV K', block: null, contractTypeId: '' });

const MONTH: PayrollMonthDto = month({
  lines: [A, J, NO_BLOCK],
  regions: [
    { id: 'hcm', name: 'Hồ Chí Minh', tone: 'blue' },
    { id: 'hn', name: 'Hà Nội', tone: 'rose' },
  ],
  contractTypes: [
    { id: 'khong-thoi-han', name: 'Không thời hạn' },
    { id: 'thu-viec', name: 'Thử việc' },
  ],
});
const NONE = filtersFromParams(new URLSearchParams(''));

describe('sumsOf', () => {
  it('should add the lines: income, both insurances, tax, net pay, total cost and the head count', () => {
    expect(sumsOf([A, J])).toEqual({
      people: 2,
      income: 16_000_000,
      employeeInsurance: 1_050_000,
      companyInsurance: 2_150_000,
      tax: 900_000,
      cash: 0,
      netPay: 14_050_000,
      totalCost: 18_150_000,
    });
  });

  it('should be all zero for no line', () => {
    expect(sumsOf([])).toEqual({
      people: 0,
      income: 0,
      employeeInsurance: 0,
      companyInsurance: 0,
      tax: 0,
      cash: 0,
      netPay: 0,
      totalCost: 0,
    });
  });
});

describe('breakdownOf', () => {
  it('L-G11: should split the month by block, the parts adding up to the whole', () => {
    // Act
    const rows = breakdownOf(MONTH, MONTH.lines, 'block');

    // Assert
    expect(rows.map((r) => [r.label, r.sums.people])).toEqual([
      ['BO · Văn phòng', 1],
      ['KD · Kinh doanh', 1],
      ['Thiếu khối', 1],
    ]);
    expect(rows.reduce((sum, r) => sum + r.sums.totalCost, 0)).toBe(sumsOf(MONTH.lines).totalCost);
  });

  it('should name regions and contract types as the month does, and a line without a profile as such', () => {
    expect(breakdownOf(MONTH, MONTH.lines, 'region').map((r) => r.label)).toEqual(['Hồ Chí Minh', 'Hà Nội']);
    expect(breakdownOf(MONTH, MONTH.lines, 'contract').map((r) => r.label)).toEqual([
      'Không thời hạn',
      'Thử việc',
      'Chưa có hồ sơ lương',
    ]);
    expect(breakdownOf(MONTH, MONTH.lines, 'dept').map((r) => r.label)).toEqual(['Hành chính', 'Kinh doanh']);
  });

  it('should carry the filter of the grid for each part, and none for a part the grid cannot filter', () => {
    const rows = breakdownOf(MONTH, MONTH.lines, 'block');
    expect(rows.map((r) => r.filter)).toEqual([{ key: 'blocks', value: 'BO' }, { key: 'blocks', value: 'KD' }, null]);
  });
});

describe('gridLink', () => {
  it('should open Bảng lương on the month', () => {
    expect(gridLink('2026-10', NONE)).toBe('/hr/luong?ky=2026-10');
  });

  it('should keep the filters on, so the grid total is the number clicked', () => {
    const filters = filtersFromParams(new URLSearchParams('kv=hcm,hn&tim=nv'));
    expect(gridLink('2026-10', filters)).toBe('/hr/luong?ky=2026-10&kv=hcm%2Chn&tim=nv');
  });

  it('should narrow to one part of a breakdown', () => {
    const filters = filtersFromParams(new URLSearchParams('khoi=BO,KD&bp=Kinh doanh'));
    expect(gridLink('2026-10', filters, { key: 'blocks', value: 'KD' })).toBe(
      '/hr/luong?ky=2026-10&bp=Kinh+doanh&khoi=KD',
    );
  });
});

describe('reviewLink', () => {
  it('should open Rà soát over the grid of the month', () => {
    expect(reviewLink('2026-10', NONE)).toBe('/hr/luong?ky=2026-10&rs=1');
  });
});

describe('overviewFromParams', () => {
  it('should start on the month view, in the year of the pay month', () => {
    expect(overviewFromParams(new URLSearchParams(''), 2026)).toEqual({ view: 'thang', year: 2026 });
  });

  it('should read the view and the year from the address', () => {
    expect(overviewFromParams(new URLSearchParams('xem=nam&nam=2027'), 2026)).toEqual({ view: 'nam', year: 2027 });
  });

  it('should fall back on a wrong view or year', () => {
    expect(overviewFromParams(new URLSearchParams('xem=tuan&nam=20x7'), 2026)).toEqual({ view: 'thang', year: 2026 });
  });
});

describe('overviewSearch', () => {
  it('should keep the month and the filters, and drop what is the default', () => {
    expect(overviewSearch('ky=2026-10&kv=hcm', { view: 'nam', year: 2027 }, 2026)).toBe(
      '?ky=2026-10&kv=hcm&xem=nam&nam=2027',
    );
    expect(overviewSearch('ky=2026-10&xem=nam&nam=2027', { view: 'thang', year: 2026 }, 2026)).toBe('?ky=2026-10');
  });
});

describe('yearRowsOf', () => {
  const loads = (over: Record<number, MonthLoad>): MonthLoad[] =>
    Array.from({ length: 12 }, (_, i) => over[i + 1] ?? { kind: 'none' });
  const approved = month({ month: 10, monthKey: '2026-10', status: 'approved', lines: [A, J] });
  const draft = month({ month: 11, monthKey: '2026-11', status: 'draft', lines: [A] });
  const waiting = month({ month: 12, monthKey: '2026-12', status: 'waiting', lines: [] });
  const LOADS = loads({
    9: { kind: 'loading' },
    10: { kind: 'month', month: approved },
    11: { kind: 'month', month: draft },
    12: { kind: 'month', month: waiting },
  });

  it('L-L32: should give one row a month, each with its status', () => {
    // Act
    const rows = yearRowsOf(2026, LOADS, NONE);

    // Assert
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.status).slice(7)).toEqual(['none', 'loading', 'approved', 'draft', 'waiting']);
    expect(rows[9]?.monthKey).toBe('2026-10');
    expect(rows[9]?.sums?.netPay).toBe(14_050_000);
  });

  it('L-G05: should carry no number for a month without data, loading or waiting for the timesheet', () => {
    const rows = yearRowsOf(2026, LOADS, NONE);
    expect([rows[0]?.sums, rows[8]?.sums, rows[11]?.sums]).toEqual([null, null, null]);
  });

  it('L-G07: should filter each month by its own lines', () => {
    // Arrange: the person is in HCM in October and in Hà Nội in November.
    const moved = month({ month: 11, monthKey: '2026-11', status: 'draft', lines: [{ ...A, regionId: 'hn' }] });
    const filters = filtersFromParams(new URLSearchParams('kv=hcm'));

    // Act
    const rows = yearRowsOf(
      2026,
      loads({ 10: { kind: 'month', month: approved }, 11: { kind: 'month', month: moved } }),
      filters,
    );

    // Assert
    expect(rows[9]?.sums?.people).toBe(1);
    expect(rows[10]?.sums?.people).toBe(0);
  });

  it('L-G06: should total approved and draft months apart, never as one number', () => {
    // Act
    const totals = yearTotalsOf(yearRowsOf(2026, LOADS, NONE));

    // Assert
    expect(totals.approved.months).toBe(1);
    expect(totals.approved.sums.totalCost).toBe(18_150_000);
    expect(totals.draft.months).toBe(1);
    expect(totals.draft.sums.totalCost).toBe(12_150_000);
  });

  it('should count a paid month with the approved ones, and each person once in the year', () => {
    // Arrange
    const paid = month({ month: 9, monthKey: '2026-09', status: 'paid', lines: [A] });

    // Act
    const totals = yearTotalsOf(
      yearRowsOf(2026, loads({ 9: { kind: 'month', month: paid }, 10: { kind: 'month', month: approved } }), NONE),
    );

    // Assert
    expect(totals.approved.months).toBe(2);
    expect(totals.approved.sums.people).toBe(2);
    expect(totals.approved.sums.netPay).toBe(8_650_000 + 14_050_000);
  });

  it('should keep the message of a month that failed', () => {
    const rows = yearRowsOf(2026, loads({ 3: { kind: 'error', message: 'Mất kết nối' } }), NONE);
    expect(rows[2]?.status).toBe('error');
    expect(rows[2]?.message).toBe('Mất kết nối');
  });
});
