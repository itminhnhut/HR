// @vitest-environment node
import type { AbsenceRowDto } from '@careers/shared';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildLeaveBook, LEAVE_HEADS, leaveFileName, leaveSheetRows } from './exportLeave';

const base = { note: '', handover: '', createdBy: 'Lan', needsPaper: false, employeeCode: 'NV01', fullName: 'Người A', employeeId: 'e1', reason: 'annual', label: 'Nghỉ phép năm' };
const ROWS: AbsenceRowDto[] = [
  { ...base, id: 'a1', source: 'absence', code: 'P', from: '2026-11-10', to: '2026-11-12', days: 3, approvedBy: 'Giám đốc', handover: 'Bình nhận việc', note: 'Về quê', files: [{ id: 'f1', name: 'don.pdf', contentType: 'application/pdf', size: 1, createdBy: 'Lan', createdAt: '2026-11-01T00:00:00.000Z' }] },
  { ...base, id: 'a2', source: 'absence', code: 'KL/2', from: '2026-11-05', to: '2026-11-05', days: 0.5, approvedBy: null, files: [], label: 'Nghỉ không lương' },
  { ...base, id: 'a3', source: 'absence', code: 'M', from: '2026-11-04', to: '2026-11-04', days: 1, approvedBy: null, files: [], label: 'Đi muộn, về sớm' },
];
const departmentOf = () => 'Sales Engineering';

describe('the leave list in Excel', () => {
  it('should write one line per absence shown, in the columns HR asked for', () => {
    // Act
    const lines = leaveSheetRows(ROWS, departmentOf);

    // Assert
    expect(LEAVE_HEADS).toEqual(['Ngày', 'Nhân viên', 'Mã NV', 'Bộ phận', 'Lý do', 'Cách tính', 'Số ngày', 'Người duyệt', 'Bàn giao', 'Ghi chú', 'Giấy tờ']);
    expect(lines).toEqual([
      ['10/11/2026 – 12/11/2026', 'Người A', 'NV01', 'Sales Engineering', 'Nghỉ phép năm', 'Có lương, trừ phép năm', 3, 'Giám đốc', 'Bình nhận việc', 'Về quê', 1],
      ['05/11/2026', 'Người A', 'NV01', 'Sales Engineering', 'Nghỉ không lương', 'Nửa ngày không lương', 0.5, 'Chờ duyệt', '', '', 0],
      ['04/11/2026', 'Người A', 'NV01', 'Sales Engineering', 'Đi muộn, về sớm', 'Vẫn 1 công, đếm 1 lần', 1, 'Không cần duyệt', '', '', 0],
    ]);
  });

  it('should name the file after the period shown, or the year', () => {
    // Act
    const names = [leaveFileName(2026, 11), leaveFileName(2026, null)];

    // Assert
    expect(names).toEqual(['Nghi-T11-2026.xlsx', 'Nghi-2026.xlsx']);
  });

  it('should open again in Excel with the heading, the red header row and every line', async () => {
    // Arrange
    const book = await buildLeaveBook(ROWS, departmentOf, 'Kỳ T11 (26/10 – 25/11/2026)');

    // Act
    const again = new ExcelJS.Workbook();
    await again.xlsx.load(await book.xlsx.writeBuffer());
    const sheet = again.worksheets[0];

    // Assert
    expect(sheet?.name).toBe('Nghỉ, đi muộn');
    expect(sheet?.getCell('A1').value).toBe('DANH SÁCH NGHỈ, ĐI MUỘN – Kỳ T11 (26/10 – 25/11/2026)');
    expect(sheet?.getRow(3).values).toEqual([undefined, ...LEAVE_HEADS]);
    expect(sheet?.getCell('A3').fill).toMatchObject({ fgColor: { argb: 'FFFF0000' } });
    expect(sheet?.getCell('G4').value).toBe(3);
    expect(sheet?.getCell('K4').value).toBe(1);
    expect(sheet?.rowCount).toBe(6);
  });
});
