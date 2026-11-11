// @vitest-environment node
import ExcelJS, { type Worksheet } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { APPROVED, DRAFT, goldenCells, goldenExportMonth } from './goldenExport.fixture';
import { payslipFileName, payslipOf, payslipsOf, type Payslip } from './payslip';
import { buildPayslipBook } from './payslipBook';
import type { PayrollExportMonth } from './types';

/**
 * Payslips (spec 11.7, BLLĐ Đ.95 k3): income, overtime, deductions and net pay of one person in one month, from the
 * month's own version; several in one file, one sheet each. docs/test-cases-luong.md L-F18–L-F22, L-L33, L-L34.
 */

function slipOf(month: PayrollExportMonth, code: string): Payslip {
  const row = month.rows.find((r) => r.person.code === code);
  if (!row) throw new Error(`No ${code} in the month`);
  return payslipOf(month, row);
}

const lineOf = (slip: Payslip, label: string) => {
  const found = slip.sections.flatMap((s) => s.lines).find((l) => l.label === label);
  if (!found) throw new Error(`No payslip line "${label}"`);
  return found;
};

async function openBook(slips: readonly Payslip[]) {
  const opened = new ExcelJS.Workbook();
  await opened.xlsx.load(await (await buildPayslipBook(slips)).xlsx.writeBuffer());
  return opened;
}

/** Column C of the row whose column A reads `label`. */
function amountOn(sheet: Worksheet, label: string): unknown {
  for (let row = 1; row <= sheet.rowCount; row += 1)
    if (sheet.getCell(row, 1).value === label) return sheet.getCell(row, 3).value;
  throw new Error(`No row "${label}"`);
}
const sheetText = (sheet: Worksheet) =>
  Array.from({ length: sheet.rowCount }, (_, r) =>
    [1, 2, 3].map((c) => String(sheet.getCell(r + 1, c).value ?? '')).join('|'),
  ).join('\n');

describe('payslip of one person (L-F18–L-F21)', () => {
  it("L-F18: should show an approved month's income, overtime, deductions and net pay from its own version", () => {
    // Act
    const slip = slipOf(goldenExportMonth(), 'NV-E');

    // Assert
    expect([slip.title, slip.stamp]).toEqual([
      'PHIẾU LƯƠNG THÁNG 10/2026',
      'Bản duyệt lần 2 · duyệt 08/11/2026 09:10 bởi HR Lan',
    ]);
    expect(slip.sections.map((s) => s.title)).toEqual([
      'Ngày công',
      'Làm thêm',
      'Thu nhập',
      'Khấu trừ',
      'Khoản khác (32)',
    ]);
    expect([lineOf(slip, 'Lương thời gian').base, lineOf(slip, 'Lương thời gian').amount]).toEqual([
      6_400_000, 2_472_727,
    ]);
    expect(lineOf(slip, 'Ngày công hưởng lương').amount).toBe(8.5);
    expect(lineOf(slip, 'Tổng thu nhập').amount).toBe(4_238_409);
    expect(lineOf(slip, 'Tiền làm thêm').amount).toBe(0);
    // Left on 09/10: BHYT only, 1,5% of lương thời gian (chuyên cần is outside the BH base, K3)
    const e = goldenCells('NV E');
    expect([lineOf(slip, 'BHYT').amount, lineOf(slip, 'BHXH').amount, lineOf(slip, 'Tổng khấu trừ').amount]).toEqual([
      e.health,
      e.social,
      e.totalDeductions,
    ]);
    expect(slip.netPay).toBe(e.netPay);
    expect(slip.sections.flatMap((s) => s.lines).map((l) => l.label)).not.toContain('Trang phục');
  });

  it('L-F18: should show only the last four digits of the account', () => {
    // Act
    const slip = slipOf(goldenExportMonth(), 'NV-E');

    // Assert
    expect(slip.bank).toBe('Ngân hàng Thử · ****0014');
    expect(JSON.stringify(slip)).not.toContain('9000000014');
  });

  it('L-F19: should mark a draft month NHÁP', () => {
    // Act
    const slip = slipOf(goldenExportMonth({ month: 11, stamp: DRAFT }), 'NV-A');

    // Assert
    expect([slip.isDraft, slip.stamp]).toEqual([true, 'BẢN NHÁP · tính lúc 02/12/2026 10:15, số còn đổi']);
  });

  it('L-F20: should say a payslip of approval round 2 replaces that of round 1', () => {
    // Act
    const second = slipOf(goldenExportMonth(), 'NV-A');
    const first = slipOf(goldenExportMonth({ stamp: { ...APPROVED, round: 1 } }), 'NV-A');

    // Assert
    expect([second.replaces, first.replaces]).toEqual(['Thay phiếu bản lần 1', null]);
  });

  it("L-F21: should show a leaver's unused leave pay and 10% tax, and a back pay with its month and reason", () => {
    // Arrange
    const backPay = { originMonth: '2026-09', reason: 'Tăng lương hồi tố', amount: 300_000 };
    const month = goldenExportMonth({
      adjust: (p, input) => {
        if (p.id === 'NV H') return { ...input, income: { ...input.income, leavePayout: 400_000 } };
        if (p.id !== 'NV C') return input;
        return {
          ...input,
          income: { ...input.income, otherIncome: [{ amount: 300_000, taxable: true, reason: backPay.reason }] },
        };
      },
    });
    const withBackPay = {
      ...month,
      rows: month.rows.map((r) => (r.person.code === 'NV-C' ? { ...r, adjustments: [backPay] } : r)),
    };

    // Act
    const leaver = slipOf(withBackPay, 'NV-H');
    const back = slipOf(withBackPay, 'NV-C');

    // Assert
    expect(lineOf(leaver, 'Tiền phép chưa nghỉ').amount).toBe(400_000);
    expect(lineOf(leaver, 'Thuế TNCN (khấu trừ 10%)').amount).toBe(764_500);
    expect(lineOf(back, 'Thu nhập khác').amount).toBe(300_000);
    expect(lineOf(back, 'Truy lĩnh T9/2026 · Tăng lương hồi tố')).toMatchObject({ amount: 300_000, isDetail: true });
  });

  it('should list the support, refund and advance typed in (32) on their own lines', () => {
    // Act
    const slip = slipOf(goldenExportMonth(), 'NV-D');

    // Assert
    expect(['Hỗ trợ', 'Hoàn ứng', 'Tạm ứng'].map((label) => lineOf(slip, label).amount)).toEqual([700_000, 0, 0]);
    expect(slip.netPay).toBe(goldenCells('NV D').netPay);
  });
});

describe('several payslips in one file (L-F22, L-L33, L-L34)', () => {
  it("L-F22, L-L33: should give every chosen person a sheet of their own, in the month's row order", async () => {
    // Arrange
    const month = goldenExportMonth();
    const chosen = ['NV-K', 'NV-A', 'NV-H', 'NV-C', 'NV-E'];

    // Act
    const slips = payslipsOf(
      month,
      month.rows.filter((r) => chosen.includes(r.person.code)).map((r) => r.person.employeeId),
    );
    const book = await openBook(slips);

    // Assert
    expect(book.worksheets.map((s) => s.name)).toEqual(['NV-A', 'NV-C', 'NV-E', 'NV-H', 'NV-K']);
    const sheet = book.getWorksheet('NV-E');
    if (!sheet) throw new Error('No sheet NV-E');
    const e = goldenCells('NV E');
    expect([sheet.getCell('A2').value, amountOn(sheet, 'THỰC NHẬN'), amountOn(sheet, 'BHYT')]).toEqual([
      'PHIẾU LƯƠNG THÁNG 10/2026',
      e.netPay,
      e.health,
    ]);
    expect(sheet.getCell(rowOfLabel(sheet, 'THỰC NHẬN'), 3).numFmt).toBe('#,##0;-#,##0;"-"');
    expect(sheet.pageSetup).toMatchObject({
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    });
  });

  it('L-L34: should have no signature block on a payslip, in the file or on the web', async () => {
    // Act
    const book = await openBook(payslipsOf(goldenExportMonth()));

    // Assert
    expect(book.worksheets).toHaveLength(12);
    for (const sheet of book.worksheets) {
      expect(sheetText(sheet)).toContain('THỰC NHẬN');
      expect(sheetText(sheet)).not.toMatch(/NGƯỜI LẬP BIỂU|KẾ TOÁN TRƯỞNG|GIÁM ĐỐC|Ký, ghi rõ/);
    }
  });

  it('L-F19: should print NHÁP on every draft payslip sheet', async () => {
    // Act
    const book = await openBook(payslipsOf(goldenExportMonth({ month: 11, stamp: DRAFT })));

    // Assert
    expect(book.worksheets).toHaveLength(12);
    for (const sheet of book.worksheets) {
      expect(sheet.getCell('C1').value).toBe('NHÁP');
      expect(sheet.headerFooter.oddHeader).toContain('NHÁP');
    }
  });

  it('should name the payslip file by month, round or draft', () => {
    // Act
    const names = [
      payslipFileName(goldenExportMonth()),
      payslipFileName(goldenExportMonth({ month: 11, stamp: DRAFT })),
    ];

    // Assert
    expect(names).toEqual(['Phieu-luong-10-2026-lan-2.xlsx', 'Phieu-luong-11-2026-NHAP.xlsx']);
  });
});

function rowOfLabel(sheet: Worksheet, label: string): number {
  for (let row = 1; row <= sheet.rowCount; row += 1) if (sheet.getCell(row, 1).value === label) return row;
  throw new Error(`No row "${label}"`);
}
