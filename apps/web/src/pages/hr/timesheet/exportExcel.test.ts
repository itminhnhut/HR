// @vitest-environment node
import { readFileSync } from 'node:fs';
import { standardPeriod, type AttendanceCode, type TimesheetDto, type TimesheetRegionDto, type TimesheetRowDto } from '@careers/shared';
import ExcelJS, { type Cell, type Worksheet } from 'exceljs';
import { describe, expect, it } from 'vitest';
import { enteredOf, NOVEMBER_SHEET, OCTOBER_SHEET, type GoldenPerson } from '../../../../../../packages/shared/test-fixtures/timesheet-golden.js';
import { buildTimesheetBook, buildTimesheetWorkbook, type ExportArgs } from './exportExcel';
import { dayColumns, findProblems, gridRows, notesOf, rowTotals } from './timesheetModel';

/**
 * The downloaded file, opened again with ExcelJS and held against HR's own sheets. Column letters are those of
 * "Tháng 10.26" (30 days, totals AK–AU) and "Tháng 11.26" (31 days, totals AL–AV). docs/test-cases-cham-cong.md.
 */

const HCM_ID = '00000000-0000-4000-8000-0000000000a1';
const HN_ID = '00000000-0000-4000-8000-0000000000a2';
const REGIONS: TimesheetRegionDto[] = [
  { id: HCM_ID, name: 'HCM', saturdays: 2, saturdayChanges: [], tone: 'blue', hidden: false, employees: 9 },
  { id: HN_ID, name: 'HN', saturdays: 4, saturdayChanges: [], tone: 'rose', hidden: false, employees: 2 },
];
const LOGO = readFileSync(new URL('../../../assets/logo/top-flow-logo.png', import.meta.url));
const logoBuffer = () => LOGO.buffer.slice(LOGO.byteOffset, LOGO.byteOffset + LOGO.byteLength);
const idOf = (id: string) => `00000000-0000-4000-8000-${id.charCodeAt(0).toString(16).padStart(12, '0')}`;

function rowFor(person: GoldenPerson, from: string): TimesheetRowDto {
  const cells = Object.fromEntries(
    Object.entries(enteredOf(person.grid, from)).map(([day, code]) => [day, { entered: code as AttendanceCode, note: null }]),
  );
  return {
    employeeId: idOf(person.id), code: `NV-${person.id}`, fullName: `Người ${person.id}`, department: 'Phòng thử', title: '',
    regionId: person.region === 'HCM' ? HCM_ID : HN_ID, employment: person.employment,
    joinedOn: person.joinedOn ?? null, leftOn: person.leftOn ?? null,
    leaveOpening: person.expected.leaveOpening, norm: person.expected.norm, cells,
    leaveChanges: [], frozenTotals: null,
    adjustments: person.adjustment ? [{ id: `a-${person.id}`, amount: person.adjustment, reason: 'Trừ công cố định', isRecurring: true, createdBy: 'Lan' }] : [],
  };
}

function sheetDto(people: readonly GoldenPerson[], year: number, month: number, today: string, over: Partial<TimesheetDto> = {}): TimesheetDto {
  const range = standardPeriod(year, month);
  return {
    periodId: 'p', year, month, ...range, status: 'closed', closedAt: null, closedBy: null, canReopen: false,
    norms: { [HCM_ID]: people[0]?.expected.norm ?? 0, [HN_ID]: people.at(-1)?.expected.norm ?? 0 },
    rule: { threshold: 14, perPeriod: 1 }, today, regions: REGIONS, holidays: [],
    rows: people.map((p) => rowFor(p, range.from)), ...over,
  };
}

const OCTOBER = () => sheetDto(OCTOBER_SHEET, 2026, 10, '2026-10-25');
const NOVEMBER = () => sheetDto(NOVEMBER_SHEET, 2026, 11, '2026-11-05', { status: 'open' });

interface Options {
  adjustmentNotes?: Record<string, string>;
  isFreeRange?: boolean;
}

/** Build the file the way the page does, write it out, and open what was written. */
async function openFile(dto: TimesheetDto, options: Options = {}): Promise<Worksheet> {
  const days = dayColumns(dto);
  const book = await buildTimesheetWorkbook(
    {
      rows: gridRows(dto, days), days, notes: notesOf(dto, days), adjustmentNotes: options.adjustmentNotes ?? {},
      isClosed: dto.status === 'closed', isFreeRange: options.isFreeRange ?? false,
      from: dto.from, to: dto.to, year: dto.year, month: dto.month,
      regions: dto.regions.map((r) => ({ id: r.id, name: r.name, norm: dto.norms[r.id] ?? 0 })),
    },
    logoBuffer(),
  );
  const written = await book.xlsx.writeBuffer();
  const opened = new ExcelJS.Workbook();
  await opened.xlsx.load(written);
  const sheet = opened.worksheets[0];
  if (!sheet) throw new Error('The file has no sheet');
  return sheet;
}

const fillOf = (cell: Cell) => (cell.fill?.type === 'pattern' ? cell.fill.fgColor?.argb : undefined);
const noteOf = (cell: Cell) => {
  const { note } = cell;
  if (!note) return undefined;
  return typeof note === 'string' ? note : note.texts?.map((t) => t.text).join('');
};
const mergesOf = (sheet: Worksheet) => (sheet.model as unknown as { merges: string[] }).merges;

const TOTAL_KEYS = ['actual', 'lateCount', 'leave', 'unpaidLeave', 'absent', 'holiday', 'norm', 'paid', 'overtime', 'leaveOpening', 'leaveClosing'] as const;

function totalsAt(sheet: Worksheet, row: number, firstTotal: string) {
  const first = sheet.getColumn(firstTotal).number;
  return Object.fromEntries(TOTAL_KEYS.map((key, i) => [key, sheet.getCell(row, first + i).value]));
}

const CODE_OF_CHAR: Record<string, string | number | null> = { '.': null, 1: 1, M: 'M', P: 'P', h: 'P/2', K: 'KL', k: 'KL/2' };

describe('the numbers in the file', () => {
  it.each(OCTOBER_SHEET)('TC-XL-02: should put every total of person $id in AK–AU of row $sheetRow, as "Tháng 10.26"', async (person) => {
    // Act
    const sheet = await openFile(OCTOBER());

    // Assert
    expect({ ...totalsAt(sheet, person.sheetRow, 'AK'), personalPaid: 0, insured: 0 }).toEqual(person.expected);
  });

  it.each(NOVEMBER_SHEET)('TC-XL-03: should put every total of person $id in AL–AV of row $sheetRow, as "Tháng 11.26"', async (person) => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect({ ...totalsAt(sheet, person.sheetRow, 'AL'), personalPaid: 0, insured: 0 }).toEqual(person.expected);
  });

  it('TC-XL-04: should write every day cell of "Tháng 10.26" as HR has it, with a 1 that is a number for COUNTIF(…,1)', async () => {
    // Act
    const sheet = await openFile(OCTOBER());

    // Assert
    for (const person of OCTOBER_SHEET) {
      const written = [...person.grid].map((_, i) => sheet.getCell(person.sheetRow, 7 + i).value);
      expect(written, person.id).toEqual([...person.grid].map((char) => CODE_OF_CHAR[char]));
    }
  });

  it('TC-XL-05: should give the sum of a column the same answer as the rows', async () => {
    // Arrange
    const dto = OCTOBER();
    const days = dayColumns(dto);

    // Act
    const sheet = await openFile(dto);

    // Assert
    const fromScreen = dto.rows.reduce((sum, row) => sum + rowTotals(dto, row, days).paid, 0);
    const fromFile = OCTOBER_SHEET.reduce((sum, p) => sum + Number(sheet.getCell(`AR${p.sheetRow}`).value), 0);
    expect(fromFile).toBe(fromScreen);
    expect(fromFile).toBe(OCTOBER_SHEET.reduce((sum, p) => sum + p.expected.paid, 0));
  });
});

describe('the columns', () => {
  it('TC-XL-06: should head the first six columns as "Tháng 11.26" does', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(['A', 'B', 'C', 'D', 'E', 'F'].map((c) => sheet.getCell(`${c}7`).value)).toEqual(['STT', 'MNV', 'Họ Và Tên', 'Bộ Phận', 'Địa Điểm', 'Nhân Viên']);
  });

  it('TC-XL-07: should head the day columns with date and weekday, from G, as row 7 and 8 of "Tháng 11.26"', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect([sheet.getCell('G7').value, sheet.getCell('G8').value]).toEqual(['26/10', 'T2']);
    expect([sheet.getCell('L7').value, sheet.getCell('L8').value]).toEqual(['31/10', 'T7']);
    expect([sheet.getCell('M7').value, sheet.getCell('M8').value]).toEqual(['01/11', 'CN']);
    expect([sheet.getCell('AK7').value, sheet.getCell('AK8').value]).toEqual(['25/11', 'T4']);
  });

  it.each([
    ['Tháng 10.26', 2026, 10, 'AJ', 'AK', 'AU'],
    ['Tháng 11.26', 2026, 11, 'AK', 'AL', 'AV'],
    ['the 28 days of March 2027', 2027, 3, 'AH', 'AI', 'AS'],
    ['the 29 days of March 2028', 2028, 3, 'AI', 'AJ', 'AT'],
  ])('TC-XL-08: should fit the totals right after the last day in %s', async (_name, year, month, lastDay, first, last) => {
    // Arrange
    const dto = sheetDto([], Number(year), Number(month), `${year}-12-31`);

    // Act
    const sheet = await openFile(dto);

    // Assert
    expect(sheet.getCell(`${lastDay}8`).value).not.toBeNull();
    expect(sheet.getCell(`${first}7`).value).toBe('Công thực tế');
    expect(sheet.getCell(`${last}7`).value).toBe('Phép tồn cuối kỳ');
  });

  it('TC-XL-09: should name the totals as HR does, in the same order', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    const first = sheet.getColumn('AL').number;
    expect(Array.from({ length: 11 }, (_, i) => sheet.getCell(7, first + i).value)).toEqual([
      'Công thực tế', 'Đi trễ/ về sớm (lần)', 'Nghỉ phép', 'Nghỉ không lương', 'Nghỉ không phép', 'Nghỉ lễ',
      'Công chuẩn', 'Công hưởng lương', 'Công vượt chuẩn (OT)', 'Phép tồn đầu kỳ', 'Phép tồn cuối kỳ',
    ]);
  });

  it('TC-XL-10: should say who each row is, numbered from 1', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(['A', 'B', 'C', 'D', 'E'].map((c) => sheet.getCell(`${c}18`).value)).toEqual([10, 'NV-K', 'Người K', 'Phòng thử', 'HN']);
  });

  it('TC-XL-11: should write the type of staff as HR writes it', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getCell('F9').value).toBe('Chính Thức');
    expect(sheet.getCell('F14').value).toBe('Thử Việc');
  });

  it('TC-XL-12: should end with the row of column numbers both sheets have under the last person', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert: row 20 of "Tháng 11.26", right under row 19
    expect(typeof sheet.getCell('G20').value).toBe('number');
  });
});

describe('the top of the sheet', () => {
  it('TC-XL-13: should have the merges of "Tháng 11.26" for the title and the column groups', async () => {
    // Act
    const merges = mergesOf(await openFile(NOVEMBER()));

    // Assert
    expect(merges).toEqual(expect.arrayContaining([
      'A4:C4', 'A6:F6', 'G6:AK6', 'AL6:AQ6', 'AR6:AT6', 'AU6:AV6',
      'A7:A8', 'B7:B8', 'C7:C8', 'D7:D8', 'E7:E8', 'F7:F8', 'AL7:AL8', 'AV7:AV8',
    ]));
  });

  it('TC-XL-14: should keep the logo block A1:C3 and the blank A5:D5 merged', async () => {
    // Act
    const merges = mergesOf(await openFile(NOVEMBER()));

    // Assert
    expect(merges).toEqual(expect.arrayContaining(['A1:C3', 'A5:D5']));
  });

  it('TC-XL-15: should freeze the sheet at E9', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 4, ySplit: 8 });
  });

  it('TC-XL-16: should have a logo in the top left corner, and the company under it', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getImages()).toHaveLength(1);
    expect(sheet.getImages()[0]?.range.tl.nativeRow).toBe(0);
    expect(sheet.getCell('A4').value).toBe('Công Ty TNHH TOP FLOW');
  });

  it('TC-XL-17: should keep year and month in G2 and G3, the cells the date formula of the sheet reads', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(['D2', 'G2', 'D3', 'G3'].map((c) => sheet.getCell(c).value)).toEqual(['Năm', 2026, 'Tháng', 11]);
  });

  it('TC-XL-18: should show the norms in F4:G5, as AR9 reads them', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(['D4', 'F4', 'G4', 'F5', 'G5'].map((c) => sheet.getCell(c).value)).toEqual(['Định mức công', 'HCM', 25, 'HN', 27]);
  });

  it('TC-XL-19: should not lose a third region from the header', async () => {
    // Arrange
    const third: TimesheetRegionDto = { id: '00000000-0000-4000-8000-0000000000a3', name: 'Đà Nẵng', saturdays: 2, saturdayChanges: [], tone: 'cyan', hidden: false, employees: 0 };
    const dto = sheetDto([], 2026, 11, '2026-11-05', { regions: [...REGIONS, third], norms: { [HCM_ID]: 25, [HN_ID]: 27, [third.id]: 25 } });

    // Act
    const sheet = await openFile(dto);

    // Assert: wherever it sits, its name and its norm are in the top rows
    const top = Array.from({ length: 6 }, (_, r) => Array.from({ length: 8 }, (__, c) => sheet.getCell(r + 1, c + 1).value)).flat();
    expect(top).toContain('Đà Nẵng');
    expect(sheet.getCell('G6').value).toBe('NGÀY CÔNG TRONG KÌ');
  });

  it('TC-XL-20: should lay the legend out where "Tháng 11.26" has it', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getCell('I1').value).toBe('Quy Ước:');
    expect(['I2', 'I3', 'I4'].map((c) => sheet.getCell(c).value)).toEqual(['P', 'P/2', 'KL']);
    expect(['N2', 'N3', 'N4'].map((c) => sheet.getCell(c).value)).toEqual([1, 'M', 'NL']);
    expect(['R3', 'R4'].map((c) => sheet.getCell(c).value)).toEqual(['KP', 'KL/2']);
    expect(sheet.getCell('S2').value).toBe('Off/ Chưa OB');
    expect(fillOf(sheet.getCell('R2'))).toBe('FFD9D9D9');
  });

  it('TC-XL-21: should explain every code in the words and colours of the legend', async () => {
    // Arrange
    const legend: [code: string | number, words: string, argb: string][] = [
      ['P', 'Nghỉ phép 1 ngày', 'FFFCE4D6'], ['P/2', 'Nghỉ phép 0,5 ngày', 'FFF8CBAD'], ['KL', 'Nghỉ không lương', 'FFF4B084'],
      [1, '1 ngày công', 'FFE2EFDA'], ['M', 'Đi muộn về sớm', 'FFC6E0B4'], ['NL', 'Nghỉ lễ', 'FFA9D08E'], ['KP', 'Nghỉ không phép', 'FFFF0000'],
    ];

    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    const cells = [2, 3, 4].flatMap((r) => Array.from({ length: 24 }, (_, c) => sheet.getCell(r, c + 7)));
    for (const [code, words, argb] of legend) {
      const cell = cells.find((c) => c.value === code);
      expect(cell, String(code)).toBeDefined();
      if (cell) {
        expect(fillOf(cell), String(code)).toBe(argb);
        expect(sheet.getCell(cell.row, Number(cell.col) + 1).value).toBe(words);
      }
    }
  });

  it('TC-XL-22: should call a closed period by its name in O5, and warn when it is still open', async () => {
    // Act
    const open = await openFile(NOVEMBER());
    const closed = await openFile(sheetDto(NOVEMBER_SHEET, 2026, 11, '2026-11-26'));

    // Assert
    expect(closed.getCell('O5').value).toBe('BẢNG CHẤM CÔNG THÁNG 11');
    expect(open.getCell('O5').value).toBe('BẢNG CHẤM CÔNG THÁNG 11 (BẢN NHÁP)');
  });

  it('TC-XL-23: should name the sheet as HR names it, also in January', async () => {
    // Act
    const november = await openFile(NOVEMBER());
    const january = await openFile(sheetDto([], 2027, 1, '2027-01-26'));

    // Assert
    expect(november.name).toBe('Tháng 11.26');
    expect(january.name).toBe('Tháng 1.27');
  });
});

describe('the colours and fonts', () => {
  it('TC-XL-24: should head the sheet in the red of the sheets, and weekends in yellow', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(fillOf(sheet.getCell('A7'))).toBe('FFFF0000');
    expect(fillOf(sheet.getCell('G7'))).toBe('FFFF0000');
    expect(fillOf(sheet.getCell('L7'))).toBe('FFFFFF00');
    expect(fillOf(sheet.getCell('M8'))).toBe('FFFFFF00');
  });

  it('TC-XL-25: should paint Saturdays and Sundays yellow for people at work, and a plain day not at all', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(fillOf(sheet.getCell('L9'))).toBe('FFFFFF00');
    expect(fillOf(sheet.getCell('M10'))).toBe('FFFFFF00');
    expect(fillOf(sheet.getCell('G9'))).toBeUndefined();
  });

  it('TC-XL-26: should grey the Mon–Fri someone was not there, as rows E, H and J of "Tháng 10.26"', async () => {
    // Act
    const sheet = await openFile(OCTOBER());

    // Assert: J starts 07/10, so 28/09 (I) is off and 07/10 (R) is not; E leaves 09/10, so 12/10 (W) is off
    expect(fillOf(sheet.getCell('I18'))).toBe('FFD9D9D9');
    expect(fillOf(sheet.getCell('R18'))).toBeUndefined();
    expect(fillOf(sheet.getCell('W13'))).toBe('FFD9D9D9');
  });

  it('TC-XL-27: should keep weekends yellow on those same rows, as "Tháng 10.26" has them', async () => {
    // Act
    const sheet = await openFile(OCTOBER());

    // Assert: 26/09 (G) before J starts, and 17/10 (AB) after E has left
    expect(fillOf(sheet.getCell('G18'))).toBe('FFFFFF00');
    expect(fillOf(sheet.getCell('AB13'))).toBe('FFFFFF00');
  });

  it('TC-XL-28: should colour exceptions with the colours of the legend', async () => {
    // Act
    const sheet = await openFile(OCTOBER());

    // Assert: on row F: P on 05/10, M on 14/10; on row J: KL on 16/10; on row E: P/2 on 06/10
    expect(fillOf(sheet.getCell('P14'))).toBe('FFFCE4D6');
    expect(fillOf(sheet.getCell('Y14'))).toBe('FFC6E0B4');
    expect(fillOf(sheet.getCell('AA18'))).toBe('FFF4B084');
    expect(fillOf(sheet.getCell('Q13'))).toBe('FFF8CBAD');
  });

  it('TC-XL-29: should colour the three groups of totals as "Tháng 11.26"', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(fillOf(sheet.getCell('AL9'))).toBe('FFFCE4D6');
    expect(fillOf(sheet.getCell('AQ9'))).toBe('FFFCE4D6');
    expect(fillOf(sheet.getCell('AR9'))).toBe('FFE2EFDA');
    expect(fillOf(sheet.getCell('AT9'))).toBe('FFE2EFDA');
    expect(fillOf(sheet.getCell('AU9'))).toBe('FFFFF2CC');
    expect(fillOf(sheet.getCell('AV9'))).toBe('FFFFF2CC');
  });

  it('TC-XL-30: should make "Công hưởng lương" stand out in bold red', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getCell('AS9').font).toMatchObject({ bold: true });
    expect(sheet.getCell('AS9').font?.color?.argb?.slice(2)).toMatch(/^(FF0000|EE3124)$/);
  });

  it('TC-XL-31: should write the rows in Times New Roman, as every sheet of the workbook', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getCell('C9').font?.name).toBe('Times New Roman');
    expect(sheet.getCell('G9').font?.name).toBe('Times New Roman');
    expect(sheet.getCell('AL9').font?.name).toBe('Times New Roman');
  });

  it('TC-XL-32: should show zero as a dash, as "Tháng 11.26" does', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getCell('AM9').numFmt.split(';')[2]).toBe('"-"');
  });

  it('TC-XL-33: should show a whole number without a decimal, as the 9 and 10 of "Tháng 11.26"', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getCell('AL9').numFmt.split(';')[0]).not.toMatch(/0\.0/);
  });
});

describe('the comments', () => {
  it('TC-XL-34: should put the adjustment on "Công hưởng lương" of that person, as G has in both sheets', async () => {
    // Act
    const sheet = await openFile(NOVEMBER(), { adjustmentNotes: { [idOf('G')]: 'Trừ 0,5 công trên tháng' } });

    // Assert
    expect(noteOf(sheet.getCell('AS14'))).toContain('Trừ 0,5 công trên tháng');
    expect(noteOf(sheet.getCell('AS13'))).toBeUndefined();
  });

  it('TC-XL-35: should put the note of a day on that day of that person', async () => {
    // Arrange
    const dto = NOVEMBER();
    const rows = dto.rows.map((r) => (r.code === 'NV-J' ? { ...r, cells: { ...r.cells, '2026-11-02': { entered: 'KL' as const, note: 'Việc gia đình' } } } : r));

    // Act
    const sheet = await openFile({ ...dto, rows });

    // Assert: 02/11 is column N of "Tháng 11.26"
    expect(noteOf(sheet.getCell('N16'))).toContain('Việc gia đình');
    expect(noteOf(sheet.getCell('N15'))).toBeUndefined();
  });
});

describe('a file for a free range', () => {
  it('TC-KT-07: should be named by its dates, with the totals right after its last day', async () => {
    // Arrange: 14 days, so the first total falls in column U
    const dto = { ...sheetDto(NOVEMBER_SHEET, 2026, 11, '2026-11-20'), periodId: null, from: '2026-11-02', to: '2026-11-15' };

    // Act
    const sheet = await openFile(dto, { isFreeRange: true });

    // Assert
    expect(sheet.getCell('O5').value).toBe('BẢNG CHẤM CÔNG 2026-11-02 ĐẾN 2026-11-15');
    expect(sheet.getCell('G7').value).toBe('02/11');
    expect(sheet.getCell('T7').value).toBe('15/11');
    expect(sheet.getCell('U7').value).toBe('Công thực tế');
  });
});

describe('what to look at before closing "Tháng 10.26"', () => {
  it('TC-T7-07: should ask about the one person on full time without their Saturdays, and those who took leave they had not', () => {
    // Arrange
    const dto = OCTOBER();
    const days = dayColumns(dto);

    // Act
    const problems = findProblems(dto, days, gridRows(dto, days));

    // Assert
    const summary = problems.map((p) => `${dto.rows.find((r) => r.employeeId === p.employeeId)?.code} ${p.kind}`).sort();
    expect(summary).toEqual(['NV-E leave', 'NV-F leave', 'NV-G adjustment', 'NV-I saturday']);
  });
});

describe('several months in one file', () => {
  const argsOf = (dto: TimesheetDto): ExportArgs => {
    const days = dayColumns(dto);
    return {
      rows: gridRows(dto, days), days, notes: notesOf(dto, days), adjustmentNotes: {}, isClosed: dto.status === 'closed', isFreeRange: false,
      from: dto.from, to: dto.to, year: dto.year, month: dto.month,
      regions: dto.regions.map((r) => ({ id: r.id, name: r.name, norm: dto.norms[r.id] ?? 0 })),
    };
  };

  it('should have one sheet a month, named as in HR\'s workbook, each with its own days and totals', async () => {
    // Act
    const book = await buildTimesheetBook([argsOf(OCTOBER()), argsOf(NOVEMBER())], logoBuffer());
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(await book.xlsx.writeBuffer());

    // Assert
    expect(reopened.worksheets.map((s) => s.name)).toEqual(['Tháng 10.26', 'Tháng 11.26']);
    expect(reopened.worksheets[0]?.getCell('G7').value).toBe('26/09');
    expect(reopened.worksheets[1]?.getCell('G7').value).toBe('26/10');
    expect(reopened.worksheets.every((s) => s.getImages().length === 1)).toBe(true);
    expect(reopened.worksheets[1]?.views[0]).toMatchObject({ state: 'frozen', xSplit: 4, ySplit: 8 });
  });
});

describe('the columns only some months need', () => {
  it('should stay column for column HR\'s sheet when nobody used the new kinds of leave', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.getCell('AQ7').value).toBe('Nghỉ lễ');
    expect(sheet.getCell('AR7').value).toBe('Công chuẩn');
  });

  it('should add them after "Nghỉ lễ" in a month someone took family or insured leave, with the groups moved along', async () => {
    // Arrange: person A on family leave on 02/11 and maternity leave on 03/11
    const dto = NOVEMBER();
    const [first, ...rest] = dto.rows;
    if (!first) throw new Error('The fixture has no rows');
    const withLeave = { ...first, cells: { ...first.cells, '2026-11-02': { entered: 'CL' as const, note: 'Cưới' }, '2026-11-03': { entered: 'TS' as const, note: null } } };

    // Act
    const sheet = await openFile({ ...dto, rows: [withLeave, ...rest] });

    // Assert
    expect(['AQ7', 'AR7', 'AS7', 'AT7'].map((c) => sheet.getCell(c).value)).toEqual(['Nghỉ lễ', 'Nghỉ có lương', 'Nghỉ BHXH', 'Công chuẩn']);
    expect(['AR9', 'AS9'].map((c) => sheet.getCell(c).value)).toEqual([1, 1]);
    expect(sheet.getCell('AT6').value).toBe('TÍNH LƯƠNG');
  });
});

describe('printing', () => {
  it('should fit one landscape A4, as HR\'s own PDF of the sheet', async () => {
    // Act
    const sheet = await openFile(NOVEMBER());

    // Assert
    expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 });
  });
});
