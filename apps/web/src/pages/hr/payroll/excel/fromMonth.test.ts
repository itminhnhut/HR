import ExcelJS, { type Worksheet } from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PayrollMonthDto } from '../../../../api';
import { demoHrPassword, mockApi, resetMockDb } from '../../../../api/mock';
import { DEMO_HR } from '../../../../api/mock-seed';
import {
  canExportDto,
  cashPartsOf,
  exportBlockOf,
  exportMonthOf,
  exportMonthsOf,
  payslipOnScreen,
  vietnamMinute,
} from './fromMonth';
import { buildPayrollBook } from './payrollBook';
import { payslipsOf } from './payslip';
import { person } from '../payrollTestData';

/**
 * The month the web shows, dressed for the payroll file and the payslips (spec 12.1, 11.7): the demo's golden month
 * (NV A…NV L, made-up people) goes through the real builders. Cases: docs/test-cases-luong.md L-F05, L-F13, L-F17–L-F19.
 */

const NOW = new Date('2026-12-20T07:03:00.000Z');
const DOWNLOAD = { at: '2026-12-20T14:03', by: 'HR Mai', hideBank: true };

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});

async function golden(over: Partial<PayrollMonthDto> = {}) {
  const month = { ...(await mockApi.hrPayrollMonth(2026, 10)), ...over };
  return { month, settings: await mockApi.hrPayrollSettings() };
}

/** A month approved before the web kept what the sheet prints beyond the grid: no row has `sheet`. */
const withoutSheets = (month: PayrollMonthDto): PayrollMonthDto => ({
  ...month,
  lines: month.lines.map(({ sheet: _, ...line }) => line),
});

async function sheetOf(month: PayrollMonthDto, settings: Awaited<ReturnType<typeof golden>>['settings']) {
  const book = await buildPayrollBook([exportMonthOf(month, settings, NOW)], DOWNLOAD);
  const opened = new ExcelJS.Workbook();
  await opened.xlsx.load(await book.xlsx.writeBuffer());
  const sheet = opened.getWorksheet('Tháng 10.26');
  if (!sheet) throw new Error('The file has no sheet "Tháng 10.26"');
  return sheet;
}

/** The column whose number row (row 9) reads `(no)`. */
function columnOf(sheet: Worksheet, no: string): number {
  for (let c = 1; c <= sheet.columnCount; c += 1) if (sheet.getCell(9, c).value === `(${no})`) return c;
  throw new Error(`No column (${no})`);
}

function rowOf(sheet: Worksheet, text: string): number {
  for (let r = 1; r <= sheet.rowCount; r += 1)
    for (let c = 1; c <= 4; c += 1) if (sheet.getCell(r, c).value === text) return r;
  throw new Error(`No row "${text}"`);
}

describe('which months can be downloaded', () => {
  it('should refuse a month waiting for the timesheet close and one without rows, each with its reason', async () => {
    // Arrange
    const { month } = await golden();

    // Act
    const reasons = [
      exportBlockOf(month),
      exportBlockOf({ ...month, status: 'waiting' }),
      exportBlockOf({ ...month, lines: [] }),
    ];

    // Assert
    expect(reasons).toEqual([null, 'Chờ chốt công, chưa có số để tải', 'Kỳ này chưa có dòng lương nào']);
    expect([canExportDto(month), canExportDto({ ...month, status: 'waiting' })]).toEqual([true, false]);
  });

  it("should print an instant as Vietnam's clock reads it", () => {
    expect(vietnamMinute('2026-11-08T02:10:00.000Z')).toBe('2026-11-08T09:10');
  });
});

describe('the payroll file of the month on screen', () => {
  it('L-F17: should carry every row and the total row to the dong, as the screen has them', async () => {
    // Arrange
    const { month, settings } = await golden();

    // Act
    const sheet = await sheetOf(month, settings);

    // Assert
    const net = columnOf(sheet, '42');
    const first = rowOf(sheet, month.lines[0]?.code ?? '');
    expect(month.lines.map((_l, i) => sheet.getCell(first + i, net).value)).toEqual(
      month.lines.map((l) => l.cells.netPay),
    );
    const total = rowOf(sheet, 'TỔNG CỘNG');
    expect([sheet.getCell(total, net).value, sheet.getCell(total, columnOf(sheet, '26')).value]).toEqual([
      month.totals.netPay,
      month.totals.income,
    ]);
  });

  it('L-F05: should mark a draft month "(BẢN NHÁP)" and stamp when it was computed', async () => {
    // Arrange
    const { month, settings } = await golden({
      status: 'draft',
      approval: null,
      computedAt: '2026-12-02T03:15:00.000Z',
    });

    // Act
    const sheet = await sheetOf(month, settings);

    // Assert
    expect(sheet.getCell('H2').value).toBe('BẢNG LƯƠNG THÁNG 10/2026 (BẢN NHÁP)');
    expect(String(sheet.getCell('H3').value)).toContain('BẢN NHÁP · tính lúc 02/12/2026 10:15, số còn đổi');
  });

  it('L-F02: should stamp an approved month with its round, who approved and who downloads', async () => {
    // Arrange
    const { month, settings } = await golden({
      status: 'approved',
      approval: { no: 2, at: '2026-11-08T02:10:00.000Z', by: 'HR Lan' },
    });

    // Act
    const sheet = await sheetOf(month, settings);

    // Assert
    expect(sheet.getCell('H3').value).toBe(
      'Bản duyệt lần 2 · duyệt 08/11/2026 09:10 bởi HR Lan · tải 20/12/2026 14:03 bởi HR Mai',
    );
  });

  it('should leave empty what an older month does not carry instead of guessing it', async () => {
    // Arrange
    const loaded = await golden();
    const month = withoutSheets(loaded.month);
    const { settings } = loaded;

    // Act
    const exported = exportMonthOf(month, settings, NOW);
    const sheet = await sheetOf(month, settings);

    // Assert
    const first = rowOf(sheet, month.lines[0]?.code ?? '');
    expect([
      sheet.getCell(first, columnOf(sheet, '4')).value,
      sheet.getCell(first, columnOf(sheet, '7')).value,
    ]).toEqual([null, null]);
    expect([exported.closingNo, exported.formulaVersion, exported.isBankUnknown]).toEqual([null, null, true]);
    expect(exported.rows.every((r) => r.person.bankAccount === null && r.person.email === null)).toBe(true);
  });
});

describe('payslips of the month on screen', () => {
  it('L-F18: should show net pay, totals and deductions of the row, the name in full, no made-up bank line', async () => {
    // Arrange
    const loaded = await golden();
    const month = withoutSheets(loaded.month);
    const { settings } = loaded;
    const line = month.lines[4];
    if (!line) throw new Error('The golden month has twelve rows');

    // Act
    const [slip] = payslipsOf(exportMonthOf(month, settings, NOW), [line.employeeId]);

    // Assert
    const lines = slip?.sections.flatMap((s) => s.lines) ?? [];
    const amount = (label: string) => lines.find((l) => l.label === label)?.amount;
    expect([slip?.name, slip?.netPay, slip?.bank]).toEqual([line.fullName, line.cells.netPay, null]);
    expect([amount('Tổng thu nhập'), amount('Tổng khấu trừ'), amount('BHXH')]).toEqual([
      line.cells.income,
      line.cells.totalDeductions,
      line.cells.social,
    ]);
  });

  it('should show the level of each pay component and leave what was paid of it empty on an older month', async () => {
    // Arrange
    const loaded = await golden();
    const month = withoutSheets(loaded.month);
    const { settings } = loaded;
    const line = month.lines[0];
    if (!line) throw new Error('The golden month has twelve rows');

    // Act
    const [slip] = payslipsOf(exportMonthOf(month, settings, NOW), [line.employeeId]);

    // Assert
    const salary = slip?.sections.flatMap((s) => s.lines).find((l) => l.label === month.components[0]?.name);
    expect([salary?.base, salary?.amount]).toEqual([line.amounts[month.components[0]?.id ?? ''], null]);
  });

  it('L-F19, L-F22: should make one payslip a person in the row order, marked NHÁP on a draft', async () => {
    // Arrange
    const { month, settings } = await golden({ status: 'draft', approval: null });

    // Act
    const slips = payslipsOf(exportMonthOf(month, settings, NOW));

    // Assert
    expect(slips.map((s) => s.code)).toEqual(month.lines.map((l) => l.code));
    expect(slips.every((s) => s.isDraft)).toBe(true);
  });
});

describe('the answer of the export call', () => {
  const answer = async (kind: 'payroll' | 'payslips') => {
    await mockApi.hrPayrollProfiles();
    return mockApi.hrPayrollExport({ months: ['2026-10'], kind });
  };

  it('should hand the builders what the sheet prints beyond the grid, the whole account in the payroll file', async () => {
    // Arrange
    const dto = await answer('payroll');
    const first = dto.months[0]?.month.lines[0];

    // Act
    const [month] = exportMonthsOf(dto, NOW);

    // Assert
    const row = month?.rows.find((r) => r.person.employeeId === first?.employeeId);
    expect([row?.person.title, row?.person.dependants, row?.person.bankAccount, row?.person.bankName]).toEqual([
      first?.sheet?.title,
      first?.sheet?.dependants,
      first?.sheet?.bankAccount,
      first?.sheet?.bankName,
    ]);
    expect(row?.person.bankAccount).toMatch(/^\d{10}$/);
    expect(row?.line.tax.method).toBe(first?.sheet?.taxMethod);
    expect(row?.line.income.componentPaid.map((c) => c.paid)).toEqual(
      dto.months[0]?.month.components.map((c) => first?.sheet?.paid[c.id] ?? 0),
    );
    expect([month?.closingNo, month?.formulaVersion, month?.isBankUnknown]).toEqual([1, 'luong-2026.11', false]);
  });

  it('should put the months oldest first and print the server notes among the labels', async () => {
    // Arrange
    const dto = await answer('payroll');
    const [one] = dto.months;
    if (!one) throw new Error('The demo answers one month');
    const later = {
      ...one,
      month: { ...one.month, month: 11, monthKey: '2026-11' },
      notes: ['Tham số đọc theo ngày tải'],
    };

    // Act
    const months = exportMonthsOf({ kind: 'payroll', months: [later, one] }, NOW);

    // Assert
    expect(months.map((m) => m.dates.month)).toEqual([10, 11]);
    expect(months[1]?.labels).toContain('Tham số đọc theo ngày tải');
  });

  it('should show on screen only the last digits of the account, and nothing for someone not in the month', async () => {
    // Arrange
    await mockApi.hrPayrollProfiles();
    const month = await mockApi.hrPayrollMonth(2026, 10);
    const first = month.lines[0];

    // Act
    const slip = payslipOnScreen(month, first?.employeeId ?? '', NOW);
    const nobody = payslipOnScreen(month, 'khong-co', NOW);

    // Assert
    expect(slip?.bank).toBe('Ngân hàng Demo · ****4567');
    expect([slip?.name, slip?.netPay, slip?.isDraft]).toEqual([first?.fullName, first?.cells.netPay, true]);
    expect(nobody).toBeNull();
  });
});

describe('(32) on a payslip made from the month on screen (F22)', () => {
  const withCash = (formula: string, cash: number) =>
    person({ cells: { cash } as PayrollMonthDto['lines'][number]['cells'], explain: { cash: { formula, refs: [] } } });

  it('should name what the company pays back of the insurance, apart from support, refund and advance', () => {
    // Arrange
    const line = withCash(
      'Hỗ trợ 200.000 + Hoàn ứng 0 − Tạm ứng 500.000 + Công ty trả thay BH [(28) + (29) + (30) = 480.000 + 90.000 + 60.000 = 630.000, chưa tính thuế] = 330.000',
      330_000,
    );

    // Act + Assert
    expect(cashPartsOf(line)).toEqual({
      cash: { support: 200_000, refund: 0, advance: 500_000 },
      insurancePaid: 630_000,
    });
  });

  it('should find no insurance paid back when the three kinds add up to the cell', () => {
    // Act + Assert
    expect(cashPartsOf(withCash('Hỗ trợ 0 + Hoàn ứng 300.000 − Tạm ứng 0 = 300.000', 300_000))).toEqual({
      cash: { support: 0, refund: 300_000, advance: 0 },
      insurancePaid: 0,
    });
  });

  it('should leave the one line of (32) when the row carries no formula', () => {
    // Act + Assert
    expect(cashPartsOf(person({}))).toBeNull();
  });
});

describe('truy lĩnh / truy thu on a payslip made from the month on screen (C02)', () => {
  it('should name each one with the month it comes from, and leave out what HR took out', async () => {
    // Arrange: NV A of the golden month carries a back pay of T9 and one HR left out (0).
    const { month } = await golden();
    const first = month.lines[0];
    if (!first) throw new Error('The golden month has no line');
    const item = {
      employeeId: first.employeeId,
      code: first.code,
      fullName: first.fullName,
      originApproval: 1,
      cells: {},
      computed: 300_000,
      typed: null,
      reason: '',
      placed: true,
      causes: [],
    };
    const retro = [
      { ...item, origin: '2026-09', amount: 300_000 },
      { ...item, origin: '2026-08', amount: 0, typed: 0, reason: 'Đã trả tay' },
    ];

    // Act
    const slip = payslipOnScreen({ ...month, retro }, first.employeeId);

    // Assert
    const section = slip?.sections.find((s) => s.title.startsWith('Truy lĩnh / truy thu'));
    expect(section?.lines.map((l) => [l.label, l.amount])).toEqual([
      ['Truy lĩnh T9/2026 · tính lại sau khi tháng đó đã duyệt', 300_000],
    ]);
  });

  it('should have no such section for someone without one', async () => {
    // Arrange
    const { month } = await golden();
    const first = month.lines[0];

    // Act
    const slip = payslipOnScreen(month, first?.employeeId ?? '');

    // Assert
    expect(slip?.sections.some((s) => s.title.startsWith('Truy lĩnh'))).toBe(false);
  });
});
