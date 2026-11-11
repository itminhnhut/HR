// @vitest-environment node
import { readFileSync } from 'node:fs';
import { payrollTotals, PAYROLL_COLUMNS, type PayrollMoneyCell } from '@careers/shared';
import ExcelJS, { type Worksheet } from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  APPROVED,
  codeOf,
  DOWNLOAD,
  DRAFT,
  goldenCells,
  goldenExportMonth,
  goldenSplitMonth,
} from './goldenExport.fixture';
import { buildPayrollBook } from './payrollBook';
import { payrollFileName } from './format';
import type { PayrollDownload, PayrollExportMonth } from './types';

/**
 * The payroll file of one month, written and opened again, held against HR's October workbook: groups on row 7,
 * headers on row 8, column numbers on row 9, people from row 10, the total row, then the signature block.
 * docs/test-cases-luong.md, F and L; spec 12.1.
 */

const LOGO = readFileSync(new URL('../../../../assets/logo/top-flow-logo.png', import.meta.url));
const logoBuffer = () => LOGO.buffer.slice(LOGO.byteOffset, LOGO.byteOffset + LOGO.byteLength);

const HEADERS = [
  'STT',
  'Mã NV',
  'Họ và tên',
  'Chức danh',
  'Bộ phận',
  'Loại hợp đồng',
  'Khu vực làm việc',
  'Số NPT',
  'Lương thời gian',
  'PC trách nhiệm',
  'Tiền cơm',
  'Xăng xe + ĐT',
  'Trang phục',
  'Nhà ở / Sinh hoạt',
  'Chuyên cần',
  'Thưởng KPI / Hiệu suất (100%)',
  'GROSS THỎA THUẬN',
  'Ngày công thực tế',
  'Lương 1 ngày',
  '% đánh giá KPI / Hiệu suất',
  'Thưởng hiệu suất',
  'Giờ làm thêm ngày thường',
  'Công làm thêm ngày nghỉ',
  'Công làm thêm ngày lễ',
  'Thu nhập khác',
  'Tiền làm thêm giờ',
  'THU NHẬP THỰC TẾ',
  'Lương đóng BH',
  'BHXH (8%)',
  'BHYT (1,5%)',
  'BHTN (1%)',
  'Đoàn phí CĐ',
  'Hỗ Trợ/ Hoàn ứng/ tạm ứng',
  'Thu nhập miễn thuế',
  'Thu nhập chịu thuế',
  'Giảm trừ bản thân',
  'Giảm trừ người phụ thuộc',
  'Giảm trừ BH bắt buộc',
  'Thu nhập tính thuế',
  'Bậc thuế',
  'Thuế TNCN khấu trừ',
  'TỔNG KHẤU TRỪ',
  'THỰC NHẬN',
  'BHXH (17,5%)',
  'BHYT (3%)',
  'BHTN (1%)',
  'KPCĐ (2%)',
  'Tổng BH + KPCĐ Cty',
  'TỔNG CHI PHÍ',
  'Email nhận phiếu lương',
  'Số tài khoản',
  'Ngân hàng',
  'Ghi chú',
];
const NUMBERS = [
  '(1)',
  '(2)',
  '(3)',
  '(4)',
  '(5)',
  '(6)',
  '',
  '(7)',
  '(8)',
  '(9)',
  '(10)',
  '(11)',
  ...Array.from({ length: 41 }, (_, i) => `(${i + 12})`),
];
const GROUPS: [string, string, string][] = [
  ['A7', 'H7', 'THÔNG TIN NHÂN SỰ'],
  ['I7', 'Q7', 'A. ĐỊNH MỨC LƯƠNG CHÍNH THỨC / THÁNG'],
  ['R7', 'U7', 'B. CHẤM CÔNG & ĐÁNH GIÁ'],
  ['V7', 'X7', 'B2. LÀM THÊM GIỜ'],
  ['Y7', 'Y7', 'B3. KHÁC'],
  ['Z7', 'AA7', 'C. THU NHẬP'],
  ['AB7', 'AG7', 'D. KHẤU TRỪ NGƯỜI LAO ĐỘNG'],
  ['AH7', 'AO7', 'E. THUẾ THU NHẬP CÁ NHÂN'],
  ['AP7', 'AQ7', 'F. THANH TOÁN'],
  ['AR7', 'AW7', 'G. CHI PHÍ CÔNG TY'],
  ['AX7', 'BA7', 'H. THÔNG TIN CHUYỂN KHOẢN & LIÊN HỆ'],
];
const FIRST_ROW = 10;
const TOTAL_ROW = 22;

async function openBook(months: PayrollExportMonth[], download: PayrollDownload = DOWNLOAD) {
  const book = await buildPayrollBook(months, download, logoBuffer());
  const opened = new ExcelJS.Workbook();
  await opened.xlsx.load(await book.xlsx.writeBuffer());
  return opened;
}

async function openSheet(month: PayrollExportMonth, download: PayrollDownload = DOWNLOAD): Promise<Worksheet> {
  const sheet = (await openBook([month], download)).getWorksheet('Tháng 10.26');
  if (!sheet) throw new Error('The file has no sheet "Tháng 10.26"');
  return sheet;
}

const rowValues = (sheet: Worksheet, row: number, count: number) =>
  Array.from({ length: count }, (_, i) => sheet.getCell(row, i + 1).value ?? '');
const columnOf = (number: string) => NUMBERS.indexOf(`(${number})`) + 1;
const textOf = (sheet: Worksheet, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => rowValues(sheet, from + i, 60).join('|')).join('\n');

describe('payroll Excel, one month (spec 12.1)', () => {
  it("L-F17: should lay out HR's 53 columns with their headers and numbers, one Xăng xe + ĐT (17.3 K2)", async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth());

    // Assert
    expect(rowValues(sheet, 8, 53)).toEqual(HEADERS);
    expect(rowValues(sheet, 9, 53)).toEqual(NUMBERS);
    expect(sheet.getCell(8, 54).value).toBeNull();
  });

  it('L-F17: should split (11) into (11a) Xăng xe and (11b) Điện thoại for a company paying them apart (câu 3)', async () => {
    // Act
    const sheet = await openSheet(goldenSplitMonth());

    // Assert
    expect(rowValues(sheet, 8, 14).slice(10)).toEqual(['Tiền cơm', 'Xăng xe', 'Điện thoại', 'Trang phục']);
    expect(rowValues(sheet, 9, 14).slice(10)).toEqual(['(10)', '(11a)', '(11b)', '(12)']);
    expect(sheet.getCell(8, 54).value).toBe('Ghi chú');
    expect([sheet.getCell(10, 12).value, sheet.getCell(10, 13).value]).toEqual([2_300_000, 500_000]);
  });

  it("L-F17: should band the columns in HR's groups A–H on the row above the headers", async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth());

    // Assert
    for (const [start, stop, label] of GROUPS) {
      expect(sheet.getCell(start).value).toBe(label);
      expect(sheet.getCell(stop).master.address).toBe(start);
    }
  });

  it('L-K1-18: should list the people by region, contract type, block, then code, whatever order they come in', async () => {
    // Arrange
    const month = goldenExportMonth();
    const shuffled = { ...month, rows: [...month.rows].reverse() };

    // Act
    const sheet = await openSheet(shuffled);

    // Assert
    const codes = Array.from({ length: 12 }, (_, i) => sheet.getCell(FIRST_ROW + i, 2).value);
    expect(codes).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((x) => codeOf(`NV ${x}`)));
    expect(rowValues(sheet, FIRST_ROW, 1)).toEqual([1]);
  });

  it("L-F17: should write each person's cells as the engine computed them", async () => {
    // Arrange
    const month = goldenExportMonth();

    // Act
    const sheet = await openSheet(month);

    // Assert: NV A on row 10, NV E (left, insurance BHYT only) on row 14
    const at = (row: number, number: string) => sheet.getCell(row, columnOf(number)).value;
    const a = goldenCells('NV A');
    expect([at(10, '11'), at(10, '16'), at(10, '26'), at(10, '40'), at(10, '42')]).toEqual([
      2_800_000,
      a.gross,
      a.income,
      a.tax,
      a.netPay,
    ]);
    expect([at(10, '2'), at(10, '5'), at(10, '6'), at(10, '7'), at(10, '39')]).toEqual([
      'NV-A',
      'BO',
      'HĐLĐ không xác định thời hạn',
      0,
      0,
    ]);
    // NV B (row 11): (38) 1.228.000 in the first bracket; NV A's (38) is 0 with Xăng xe + ĐT exempt
    expect([at(11, '38'), at(11, '39')]).toEqual([goldenCells('NV B').assessable, 1]);
    const e = goldenCells('NV E');
    expect([at(14, '17'), at(14, '29'), at(14, '28')]).toEqual([8.5, e.health, e.social]);
    expect(String(at(14, '52'))).toContain('Chỉ BHYT');
    expect([at(10, '49'), at(10, '51')]).toEqual(['nv-a@example.test', 'Ngân hàng Thử']);
  });

  it('L-F17: should total each column on the TỔNG CỘNG row as the screen does, to the dong', async () => {
    // Arrange
    const month = goldenExportMonth();
    const screen = payrollTotals(
      month.rows.map((r) => r.line),
      'cell',
    );

    // Act
    const sheet = await openSheet(month);

    // Assert
    expect(sheet.getCell(TOTAL_ROW, 1).value).toBe('TỔNG CỘNG');
    const money = Object.entries(PAYROLL_COLUMNS).filter(([key]) => key in screen) as [PayrollMoneyCell, string][];
    for (const [key, number] of money)
      expect([key, sheet.getCell(TOTAL_ROW, columnOf(number)).value]).toEqual([key, screen[key]]);
    const sum = goldenCells('Σ');
    expect([26, 42, 48].map((n) => sheet.getCell(TOTAL_ROW, columnOf(String(n))).value)).toEqual([
      sum.income,
      sum.netPay,
      sum.totalCost,
    ]);
    expect(['17', '18', '19', '39'].map((n) => sheet.getCell(TOTAL_ROW, columnOf(n)).value)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('D01: should total an "as HR\'s file" month as Tròn(Σ đủ), in its own 53 columns with one "Xăng xe + ĐT"', async () => {
    // Arrange
    const month = goldenExportMonth({ asHrFile: true });

    // Act
    const sheet = await openSheet(month);

    // Assert
    expect(rowValues(sheet, 8, 13).slice(8)).toEqual([
      'Lương thời gian',
      'PC trách nhiệm',
      'Tiền cơm',
      'Xăng xe + ĐT',
      'Trang phục',
    ]);
    expect(rowValues(sheet, 9, 13).slice(8)).toEqual(['(8)', '(9)', '(10)', '(11)', '(12)']);
    expect(sheet.getCell(8, 53).value).toBe('Ghi chú');
    // (26) in column AA and (42) in AQ, as in HR's file
    expect([sheet.getCell(TOTAL_ROW, 27).value, sheet.getCell(TOTAL_ROW, 43).value]).toEqual([
      152_656_523, 149_142_623,
    ]);
  });

  it('should format money with thousands and a dash for zero, days to one decimal, KPI as a percentage', async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth());

    // Assert
    const format = (number: string, row = FIRST_ROW) => sheet.getCell(row, columnOf(number)).numFmt;
    expect([format('26'), format('42', TOTAL_ROW), format('18')]).toEqual(Array(3).fill('#,##0;-#,##0;"-"'));
    expect([format('17'), format('22'), format('19')]).toEqual(['0.0', '0.0;-0.0;"-"', '0%']);
  });

  it('should freeze the headers and the name column and print on A4 landscape, one page wide', async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth());

    // Assert
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 9 });
    expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 });
    expect(sheet.pageSetup.printTitlesRow).toBe('7:9');
  });

  it("should head the sheet with the company, the month and the norm of each region, as HR's file does", async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth());

    // Assert
    expect(['A4', 'D4', 'F4', 'D5', 'F5', 'D6', 'F6'].map((a) => sheet.getCell(a).value)).toEqual([
      'CÔNG TY TNHH TOP FLOW',
      'Tháng lương:',
      '10/2026',
      'Ngày công chuẩn HCM',
      22,
      'Ngày công chuẩn HN',
      24,
    ]);
    expect(sheet.getCell('H2').value).toBe('BẢNG LƯƠNG THÁNG 10/2026');
  });

  it('L-F23, L-L34: should end the sheet with the signature block, dated on the pay date', async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth());

    // Assert
    const kt = columnOf('27');
    const gd = columnOf('41');
    expect(sheet.getCell(TOTAL_ROW + 2, gd).value).toBe('TP. Hồ Chí Minh, ngày 05 tháng 11 năm 2026');
    expect([3, kt, gd].map((c) => sheet.getCell(TOTAL_ROW + 3, c).value)).toEqual([
      'NGƯỜI LẬP BIỂU',
      'KẾ TOÁN TRƯỞNG',
      'GIÁM ĐỐC',
    ]);
    expect([3, kt, gd].map((c) => sheet.getCell(TOTAL_ROW + 4, c).value)).toEqual(Array(3).fill('(Ký, ghi rõ họ tên)'));
  });

  it('L-F02: should stamp an approved month with its round, approver and the download', async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth());

    // Assert
    expect(sheet.getCell('H3').value).toBe(
      'Bản duyệt lần 2 · duyệt 08/11/2026 09:10 bởi HR Lan · tải 20/12/2026 14:03 bởi HR Mai',
    );
  });

  it('L-F14: should say an older approval was replaced', async () => {
    // Arrange
    const month = goldenExportMonth({ stamp: { ...APPROVED, round: 1, supersededBy: 2 } });

    // Act
    const sheet = await openSheet(month);

    // Assert
    expect(String(sheet.getCell('H3').value)).toMatch(/^Bản duyệt lần 1 · .* · đã thay bởi lần 2$/);
  });

  it('L-F05: should title a draft "(BẢN NHÁP)", stamp when it was computed, and keep the signature block', async () => {
    // Arrange
    const month = goldenExportMonth({ stamp: DRAFT });

    // Act
    const sheet = await openSheet(month);

    // Assert
    expect(sheet.getCell('H2').value).toBe('BẢNG LƯƠNG THÁNG 10/2026 (BẢN NHÁP)');
    expect(sheet.getCell('H3').value).toBe(
      'BẢN NHÁP · tính lúc 02/12/2026 10:15, số còn đổi · tải 20/12/2026 14:03 bởi HR Mai',
    );
    expect(textOf(sheet, TOTAL_ROW, TOTAL_ROW + 4)).not.toContain('Bản duyệt');
    expect(textOf(sheet, TOTAL_ROW, TOTAL_ROW + 4)).toContain('KẾ TOÁN TRƯỞNG');
  });

  it('L-F01: should give the same cells when an approved month is downloaded again later, only the stamp moves', async () => {
    // Arrange
    const month = goldenExportMonth();

    // Act
    const first = await openSheet(month, { at: '2026-11-06T08:00', by: 'HR Mai' });
    const again = await openSheet(month, { at: '2026-12-20T14:03', by: 'HR Lan' });

    // Assert
    expect(textOf(again, 4, TOTAL_ROW + 4)).toBe(textOf(first, 4, TOTAL_ROW + 4));
    expect(again.getCell('H3').value).not.toBe(first.getCell('H3').value);
  });

  it('L-F07: should label a month changed after approval at the top', async () => {
    // Arrange
    const month = { ...goldenExportMonth(), labels: ['Có thay đổi sau duyệt, xử lý ở T11/2026'] };

    // Act
    const sheet = await openSheet(month);

    // Assert
    expect(sheet.getCell('H4').value).toBe('Có thay đổi sau duyệt, xử lý ở T11/2026');
  });

  it('L-F12: should leave e-mail, account and bank out when group H is hidden', async () => {
    // Act
    const sheet = await openSheet(goldenExportMonth(), { ...DOWNLOAD, hideBank: true });

    // Assert
    expect(rowValues(sheet, 8, 51).slice(-4)).toEqual(['Tổng BH + KPCĐ Cty', 'TỔNG CHI PHÍ', 'Ghi chú', '']);
    expect(textOf(sheet, 1, TOTAL_ROW)).not.toMatch(/example\.test|Ngân hàng Thử|9000000010/);
  });
});

describe('payroll file names (L-F13)', () => {
  it('L-F13: should name an approved month by its round, a draft NHAP, and several months by their range', () => {
    // Arrange
    const october = goldenExportMonth();
    const november = goldenExportMonth({ month: 11, stamp: DRAFT });
    const august = goldenExportMonth({ month: 8 });

    // Act
    const names = [payrollFileName([october]), payrollFileName([november]), payrollFileName([october, august])];

    // Assert
    expect(names).toEqual([
      'Bang-luong-10-2026-lan-2.xlsx',
      'Bang-luong-11-2026-NHAP.xlsx',
      'Bang-luong-2026-T08-T10.xlsx',
    ]);
  });

  it('L-F16: should refuse months of two years in one file', async () => {
    // Arrange
    const december = goldenExportMonth({ month: 12 });
    const january = goldenExportMonth({ year: 2027, month: 1 });

    // Act
    const build = buildPayrollBook([december, january], DOWNLOAD);

    // Assert
    await expect(build).rejects.toThrow('Mỗi file chỉ gồm các tháng của một năm');
  });
});
