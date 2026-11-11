// @vitest-environment node
import ExcelJS, { type Worksheet } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { DOWNLOAD, DRAFT, goldenExportMonth, goldenSplitMonth } from './goldenExport.fixture';
import { buildPayrollBook } from './payrollBook';
import { exportSummary, yearExportMonths } from './selection';
import type { PayrollExportMonth } from './types';

/**
 * The "Tham số" sheet (R8: which configuration each month used) and the "Tổng hợp" sheet across the months of one
 * file (spec 12.1). docs/test-cases-luong.md L-F03, L-F04, L-F07–L-F11, L-F15, L-L33.
 */

async function openBook(months: PayrollExportMonth[]) {
  const book = await buildPayrollBook(months, DOWNLOAD);
  const opened = new ExcelJS.Workbook();
  await opened.xlsx.load(await book.xlsx.writeBuffer());
  return opened;
}

async function openSheet(months: PayrollExportMonth[], name: string): Promise<Worksheet> {
  const sheet = (await openBook(months)).getWorksheet(name);
  if (!sheet) throw new Error(`The file has no sheet "${name}"`);
  return sheet;
}

/** The row whose column B reads `label`, as [Nhóm, Tham số, month 1, month 2, …]. */
function paramRow(sheet: Worksheet, label: string): unknown[] {
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    if (sheet.getCell(row, 2).value !== label) continue;
    return Array.from({ length: sheet.columnCount }, (_, i) => sheet.getCell(row, i + 1).value);
  }
  throw new Error(`No parameter row "${label}"`);
}

const valueOf = (sheet: Worksheet, label: string, month = 0) => String(paramRow(sheet, label)[2 + month]);
const fillOf = (sheet: Worksheet, label: string, column: number) => {
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    if (sheet.getCell(row, 2).value !== label) continue;
    const { fill } = sheet.getCell(row, column);
    return fill?.type === 'pattern' ? fill.fgColor?.argb : undefined;
  }
  return undefined;
};

describe('the "Tham số" sheet (R8)', () => {
  it('L-F03: should list the period, pay date, insurance month, tax year, norms, closing and formula version', async () => {
    // Act
    const sheet = await openSheet([goldenExportMonth()], 'Tham số');

    // Assert
    expect(sheet.getCell('A1').value).toBe('THAM SỐ ÁP DỤNG');
    expect(paramRow(sheet, 'Tham số').slice(0, 3)).toEqual(['Nhóm', 'Tham số', 'T10/2026']);
    expect(paramRow(sheet, 'Kỳ công').slice(0, 3)).toEqual(['Kỳ', 'Kỳ công', '26/09/2026–25/10/2026']);
    const labels = ['Ngày chi trả', 'Tháng BH', 'Năm thuế', 'Công chuẩn', 'Lần chốt kỳ công', 'Phiên bản công thức'];
    expect(labels.map((label) => valueOf(sheet, label))).toEqual([
      '05/11/2026',
      '10/2026',
      '2026',
      'HCM 22 · HN 24',
      'Lần 1',
      'luong-2026.11',
    ]);
    expect(valueOf(sheet, 'Bản')).toBe('Bản duyệt lần 2 · duyệt 08/11/2026 09:10 bởi HR Lan');
  });

  it('L-F03: should give each law parameter that month used with the date it applies from and its source', async () => {
    // Act
    const sheet = await openSheet([goldenExportMonth()], 'Tham số');

    // Assert
    expect(paramRow(sheet, 'Lương cơ sở').slice(0, 3)).toEqual([
      'Tham số luật',
      'Lương cơ sở',
      '2.530.000\nTừ 01/07/2026 · NĐ 161/2026',
    ]);
    expect(valueOf(sheet, 'Trần tiền ăn miễn thuế')).toBe('1.200.000\nTừ 01/07/2026 · NĐ 253/2026 Đ.8 k2 g, Đ.69 k1 b');
    expect(valueOf(sheet, 'BH người lao động')).toMatch(/^BHXH 8% · BHYT 1,5% · BHTN 1%\nTừ 01\/01\/2026 · /);
    expect(valueOf(sheet, 'Giảm trừ gia cảnh')).toMatch(/^Bản thân 15\.500\.000 · Người phụ thuộc 6\.200\.000\n/);
    expect(valueOf(sheet, 'Khấu trừ 10%: tỷ lệ và ngưỡng một lần chi')).toMatch(/^Tỷ lệ 10% · Ngưỡng 5\.000\.000\n/);
  });

  it('L-F03: should list the pay components, rules, contract types and options D01–D15 of that month', async () => {
    // Act
    const sheet = await openSheet([goldenExportMonth()], 'Tham số');

    // Assert
    expect(paramRow(sheet, 'Xăng xe + ĐT').slice(0, 2)).toEqual(['Khoản lương', 'Xăng xe + ĐT']);
    expect(valueOf(sheet, 'Xăng xe + ĐT')).toMatch(
      /^Chia theo ngày · × tỷ lệ thử việc · Vào lương làm thêm · Miễn thuế\n/,
    );
    // K3: chuyên cần is outside the BH base by default (still a switch in Cấu hình)
    expect(valueOf(sheet, 'Chuyên cần')).toMatch(/^Chia theo ngày · × tỷ lệ thử việc · Lương theo HĐ · /);
    expect(valueOf(sheet, 'Chuyên cần')).not.toContain('Tính BH');
    expect(valueOf(sheet, 'Tỷ lệ lương thử việc')).toBe('90%\nTừ T1/2026 · BLLĐ Đ.26');
    expect(valueOf(sheet, 'HĐ thử việc')).toMatch(/^Không đóng BH · Khấu trừ 10% · Dưới 3 tháng · Thử việc 60 ngày\n/);
    expect(valueOf(sheet, 'D01 Làm tròn')).toMatch(/^Tròn từng ô khi tính\n/);
    expect(valueOf(sheet, 'D15 Vẫn đóng BH tháng có từ 14 ngày không hưởng lương')).toMatch(/^Không\n/);
  });

  it("L-F03: should list each person's override and each typed cell with its reason", async () => {
    // Arrange
    const override = {
      key: 'quy-tac.ty-le-thu-viec',
      employeeId: 'NV G',
      from: '2026-10',
      value: 0.85,
      source: 'Thoả thuận riêng',
    };
    const typed = [
      { employeeId: 'NV J', column: '19', computed: 0.531818, typed: 0.5, reason: 'Đi công tác dài ngày' },
    ];
    const month = { ...goldenExportMonth({ settings: [override] }), typed };

    // Act
    const sheet = await openSheet([month], 'Tham số');

    // Assert
    expect(paramRow(sheet, 'NV-G · Tỷ lệ lương thử việc').slice(0, 3)).toEqual([
      'Ghi đè từng người',
      'NV-G · Tỷ lệ lương thử việc',
      '85%\nTừ T10/2026 · Thoả thuận riêng',
    ]);
    expect(paramRow(sheet, 'NV-J · (19)').slice(0, 3)).toEqual([
      'Ô gõ đè',
      'NV-J · (19)',
      'Tính 53,18% → gõ 50% · Đi công tác dài ngày',
    ]);
  });

  it("L-F04: should show a split period of a person with each part's dates and pay", async () => {
    // Arrange
    const parts = [
      { from: '2026-10-26', to: '2026-10-31', amounts: { luong: 6_400_000 } },
      { from: '2026-11-01', to: '2026-11-25', amounts: { luong: 7_000_000 } },
    ];
    const month = { ...goldenExportMonth({ month: 11 }), segments: [{ employeeId: 'NV C', parts }] };

    // Act
    const sheet = await openSheet([month], 'Tham số');

    // Assert
    expect(paramRow(sheet, 'NV-C').slice(0, 3)).toEqual([
      'Tách đoạn',
      'NV-C',
      '26/10/2026–31/10/2026: Lương thời gian 6.400.000\n01/11/2026–25/11/2026: Lương thời gian 7.000.000',
    ]);
  });

  it("L-F07: should carry the month's labels", async () => {
    // Arrange
    const month = { ...goldenExportMonth(), labels: ['Kỳ công đã mở lại'] };

    // Act
    const sheet = await openSheet([month], 'Tham số');

    // Assert
    expect(valueOf(sheet, 'Nhãn')).toBe('Kỳ công đã mở lại');
  });

  it('L-F08: should give months across a change of law one column each, each with its own values, the change coloured', async () => {
    // Arrange
    const june = goldenExportMonth({ month: 6 });
    const july = goldenExportMonth({ month: 7 });

    // Act
    const sheet = await openSheet([june, july], 'Tham số');

    // Assert
    expect(paramRow(sheet, 'Tham số').slice(2, 4)).toEqual(['T6/2026', 'T7/2026']);
    expect(
      paramRow(sheet, 'Lương cơ sở')
        .slice(2, 4)
        .map((v) => String(v).split('\n')[0]),
    ).toEqual(['2.340.000', '2.530.000']);
    // Tax parameters go by the pay date (R2): June is paid on 05/07, so it already has July's meal cap.
    expect(
      paramRow(sheet, 'Trần tiền ăn miễn thuế')
        .slice(2, 4)
        .map((v) => String(v).split('\n')[0]),
    ).toEqual(['1.200.000', '1.200.000']);
    expect([fillOf(sheet, 'Lương cơ sở', 4), fillOf(sheet, 'Giảm trừ gia cảnh', 4)]).toEqual(['FFFFF2CC', undefined]);
  });
});

describe('several months in one file and the "Tổng hợp" sheet', () => {
  const months = () => [
    goldenExportMonth({ month: 8 }),
    goldenExportMonth({ month: 9 }),
    goldenExportMonth({ month: 10, stamp: DRAFT }),
  ];
  const HEAD = 5;
  const FIRST = 7;
  const rowOfCode = (sheet: Worksheet, code: string) => {
    for (let row = FIRST; row <= sheet.rowCount; row += 1) if (sheet.getCell(row, 1).value === code) return row;
    throw new Error(`No row for ${code}`);
  };
  const columnOfHeader = (sheet: Worksheet, header: string) => {
    for (let col = 1; col <= sheet.columnCount; col += 1) if (sheet.getCell(HEAD, col).value === header) return col;
    throw new Error(`No column "${header}"`);
  };

  it('L-L33: should hold one sheet per month, each by its own version, then Tổng hợp and Tham số', async () => {
    // Act
    const book = await openBook(months());

    // Assert
    expect(book.worksheets.map((s) => s.name)).toEqual([
      'Tháng 8.26',
      'Tháng 9.26',
      'Tháng 10.26',
      'Tổng hợp',
      'Tham số',
    ]);
    expect(book.getWorksheet('Tháng 10.26')?.getCell('H2').value).toBe('BẢNG LƯƠNG THÁNG 10/2026 (BẢN NHÁP)');
    expect(book.getWorksheet('Tháng 8.26')?.getCell('H2').value).toBe('BẢNG LƯƠNG THÁNG 8/2026');
  });

  it("L-F10: should give one row per person, adding the months' cells without computing again", async () => {
    // Arrange
    const input = months();

    // Act
    const sheet = await openSheet(input, 'Tổng hợp');

    // Assert
    const row = rowOfCode(sheet, 'NV-A');
    const expected = input.reduce((acc, m) => acc + (m.rows[0]?.line.cells.netPay ?? 0), 0);
    expect(sheet.getCell(row, columnOfHeader(sheet, 'THỰC NHẬN')).value).toBe(expected);
    expect(sheet.getCell(row, columnOfHeader(sheet, 'Số tháng')).value).toBe(3);
    expect([1, 2, 3, 4].map((c) => sheet.getCell(HEAD, c).value)).toEqual(['Mã NV', 'Họ và tên', 'Bộ phận', 'Khu vực']);
    expect(sheet.getCell(rowOfCode(sheet, 'TỔNG CỘNG'), columnOfHeader(sheet, 'THU NHẬP THỰC TẾ')).value).toBe(
      input.reduce((acc, m) => acc + m.rows.reduce((s, r) => s + r.line.cells.income, 0), 0),
    );
  });

  it('L-F10: should take name and region from the latest month and note an earlier one that differs', async () => {
    // Arrange
    const [august, september, october] = months();
    if (!august || !september || !october) throw new Error('three months expected');
    const moved = {
      ...august,
      rows: august.rows.map((r) => (r.person.code === 'NV-K' ? { ...r, person: { ...r.person, region: 'HCM' } } : r)),
    };

    // Act
    const sheet = await openSheet([moved, september, october], 'Tổng hợp');

    // Assert
    const row = rowOfCode(sheet, 'NV-K');
    expect(sheet.getCell(row, 4).value).toBe('HN');
    expect(sheet.getCell(row, columnOfHeader(sheet, 'Ghi chú')).value).toBe('T8/2026: khu vực HCM');
  });

  it('L-F09: should say the summary includes draft numbers', async () => {
    // Act
    const sheet = await openSheet(months(), 'Tổng hợp');

    // Assert
    expect(sheet.getCell('A1').value).toBe('TỔNG HỢP LƯƠNG NĂM 2026 · T8, T9, T10');
    expect(sheet.getCell('A3').value).toBe('Gồm số nháp T10/2026');
  });

  it('L-F11: should merge the columns of months with different components, empty where a month had none', async () => {
    // Arrange: October in HR's columns (one "Xăng xe + ĐT"), without NV L; November with fuel and phone apart
    const october = goldenExportMonth({ asHrFile: true });
    const withoutL = { ...october, rows: october.rows.filter((r) => r.person.code !== 'NV-L') };
    const november = goldenSplitMonth({ month: 11 });

    // Act
    const sheet = await openSheet([withoutL, november], 'Tổng hợp');

    // Assert
    const headers = Array.from({ length: 6 }, (_, i) => sheet.getCell(HEAD, 8 + i).value);
    expect(headers).toEqual(['Tiền cơm', 'Xăng xe + ĐT', 'Xăng xe', 'Điện thoại', 'Trang phục', 'Nhà ở / Sinh hoạt']);
    const a = rowOfCode(sheet, 'NV-A');
    expect([9, 10, 11].map((c) => sheet.getCell(a, c).value)).toEqual([2_800_000, 2_300_000, 500_000]);
    expect(sheet.getCell(rowOfCode(sheet, 'NV-L'), 9).value).toBeNull();
  });

  it('should leave Tổng hợp out of a one-month file', async () => {
    // Act
    const book = await openBook([goldenExportMonth()]);

    // Assert
    expect(book.worksheets.map((s) => s.name)).toEqual(['Tháng 10.26', 'Tham số']);
  });
});

describe('choosing months (L-F09, L-F15)', () => {
  const YEAR = [
    { month: 8, status: 'approved' as const },
    { month: 9, status: 'paid' as const },
    { month: 10, status: 'draft' as const },
    { month: 11, status: 'waiting' as const },
    { month: 12, status: 'estimate' as const },
  ];

  it('L-F15: should take approved and draft months of the year, not those still estimated', () => {
    // Act
    const chosen = yearExportMonths(YEAR);

    // Assert
    expect(chosen).toEqual([8, 9, 10]);
  });

  it('L-F09: should tell how many sheets and how many drafts the download holds', () => {
    // Act
    const text = exportSummary(YEAR.filter((m) => m.month <= 10));

    // Assert
    expect(text).toBe('3 tháng · 1 bản nháp');
  });
});
