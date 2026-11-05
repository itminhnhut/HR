/**
 * The two sheets of HR's workbook "Bảng Chấm Công", with anonymous people: the day cells and totals are the sheets',
 * nothing else about the people is. Checked by hand against the PDF of "Tháng 10.26", and against the saved page and
 * HR's screenshots of "Tháng 11.26". Used by the tests of all three packages; it lives outside `src` so it never ships.
 *
 * A grid has one character per day of the period, from its first day: `.` empty, `1`, `M`, `P`, `h` = P/2, `K` = KL,
 * `k` = KL/2. Neither sheet has NL or KP yet.
 */

export type GoldenCode = '1' | 'M' | 'P' | 'P/2' | 'KL' | 'KL/2' | 'NL' | 'KP';

export interface GoldenTotals {
  actual: number;
  lateCount: number;
  leave: number;
  unpaidLeave: number;
  /** Neither sheet has anyone on these yet, so they are 0 throughout. */
  personalPaid: number;
  insured: number;
  absent: number;
  holiday: number;
  norm: number;
  paid: number;
  overtime: number;
  leaveOpening: number;
  leaveClosing: number;
}

export interface GoldenPerson {
  id: string;
  /** Row of the sheet this person is on. */
  sheetRow: number;
  region: 'HCM' | 'HN';
  employment: 'official' | 'probation';
  joinedOn?: string;
  leftOn?: string;
  /** Written by hand into "Công hưởng lương" in both sheets, with a cell comment saying why. */
  adjustment?: number;
  grid: string;
  expected: GoldenTotals;
}

const totals = (
  actual: number, lateCount: number, leave: number, unpaidLeave: number,
  norm: number, paid: number, leaveOpening: number, leaveClosing: number,
): GoldenTotals => ({ actual, lateCount, leave, unpaidLeave, personalPaid: 0, insured: 0, absent: 0, holiday: 0, norm, paid, overtime: 0, leaveOpening, leaveClosing });

/** "Tháng 10.26", 26/09 to 25/10, rows 9–20. Totals: columns AK–AU. */
export const OCTOBER_SHEET: readonly GoldenPerson[] = [
  { id: 'A', sheetRow: 9, region: 'HCM', employment: 'official', grid: '..11111..111111.11111..111111.', expected: totals(22, 0, 0, 0, 22, 22, 7.5, 8.5) },
  { id: 'B', sheetRow: 10, region: 'HCM', employment: 'official', grid: '..11111..111111.111111.11111..', expected: totals(22, 0, 0, 0, 22, 22, 3, 4) },
  { id: 'C', sheetRow: 11, region: 'HCM', employment: 'official', grid: '..11111..111111.11111..111111.', expected: totals(22, 0, 0, 0, 22, 22, 2, 3) },
  { id: 'D', sheetRow: 12, region: 'HCM', employment: 'official', grid: '..111111.11111..111111.11P11..', expected: totals(21, 0, 1, 0, 22, 22, 1, 1) },
  { id: 'E', sheetRow: 13, region: 'HCM', employment: 'official', leftOn: '2026-10-09', grid: '..11111..1h111................', expected: totals(9.5, 0, 0.5, 0, 22, 9.5, 0, 0) },
  { id: 'F', sheetRow: 14, region: 'HCM', employment: 'official', grid: '..111111.PP111..11M1P1.11111..', expected: totals(19, 1, 3, 0, 22, 20.5, 0.5, 0) },
  { id: 'G', sheetRow: 15, region: 'HCM', employment: 'probation', adjustment: -0.5, grid: '..11111..11111..111k11.111111.', expected: totals(21.5, 0, 0, 0.5, 22, 21, 0, 0) },
  { id: 'H', sheetRow: 16, region: 'HCM', employment: 'probation', leftOn: '2026-10-15', grid: '..1111M1.111M1..1111..........', expected: totals(15, 2, 0, 0, 22, 15, 0, 0) },
  { id: 'I', sheetRow: 17, region: 'HCM', employment: 'probation', grid: '..11111..1111k..11111..11111..', expected: totals(19.5, 0, 0, 0.5, 22, 19.5, 0, 0) },
  { id: 'J', sheetRow: 18, region: 'HCM', employment: 'probation', joinedOn: '2026-10-07', grid: '...........111..1M11K1.1111M1.', expected: totals(14, 2, 0, 1, 22, 14, 0, 0) },
  { id: 'K', sheetRow: 19, region: 'HN', employment: 'official', grid: '..111111.111111.111111.111111.', expected: totals(24, 0, 0, 0, 24, 24, 6, 7) },
  { id: 'L', sheetRow: 20, region: 'HN', employment: 'probation', grid: '..111111.111111.111111.111111.', expected: totals(24, 0, 0, 0, 24, 24, 0, 0) },
];

/**
 * "Tháng 11.26", 26/10 to 25/11, rows 9–19, as HR left it on 05/11: nine days of the period have gone by, so nobody has
 * reached 14 and no new leave day shows yet. E and H have left. L has become official. N is new; the sheet does not say
 * when N joined, only that N's row starts on 26/10. Totals: columns AL–AV.
 */
export const NOVEMBER_SHEET: readonly GoldenPerson[] = [
  { id: 'A', sheetRow: 9, region: 'HCM', employment: 'official', grid: '11111..1111....................', expected: totals(9, 0, 0, 0, 25, 9, 8.5, 8.5) },
  { id: 'B', sheetRow: 10, region: 'HCM', employment: 'official', grid: '111111.1111....................', expected: totals(10, 0, 0, 0, 25, 10, 4, 4) },
  { id: 'C', sheetRow: 11, region: 'HCM', employment: 'official', grid: '11111..1111....................', expected: totals(9, 0, 0, 0, 25, 9, 3, 3) },
  { id: 'D', sheetRow: 12, region: 'HCM', employment: 'official', grid: '111111.1111....................', expected: totals(10, 0, 0, 0, 25, 10, 1, 1) },
  { id: 'F', sheetRow: 13, region: 'HCM', employment: 'official', grid: '1111h..1111....................', expected: totals(8.5, 0, 0.5, 0, 25, 8.5, 0, 0) },
  { id: 'G', sheetRow: 14, region: 'HCM', employment: 'probation', adjustment: -0.5, grid: '11111..1111....................', expected: totals(9, 0, 0, 0, 25, 8.5, 0, 0) },
  { id: 'I', sheetRow: 15, region: 'HCM', employment: 'probation', grid: '11111..1111....................', expected: totals(9, 0, 0, 0, 25, 9, 0, 0) },
  { id: 'J', sheetRow: 16, region: 'HCM', employment: 'probation', grid: '11111..K111....................', expected: totals(8, 0, 0, 1, 25, 8, 0, 0) },
  { id: 'N', sheetRow: 17, region: 'HCM', employment: 'probation', joinedOn: '2026-10-26', grid: '111111.1111....................', expected: totals(10, 0, 0, 0, 25, 10, 0, 0) },
  { id: 'K', sheetRow: 18, region: 'HN', employment: 'official', grid: '111111.1111....................', expected: totals(10, 0, 0, 0, 27, 10, 7, 7) },
  { id: 'L', sheetRow: 19, region: 'HN', employment: 'official', grid: '11111..1111....................', expected: totals(9, 0, 0, 0, 27, 9, 0, 0) },
];

const CODE_OF: Record<string, GoldenCode> = { 1: '1', M: 'M', P: 'P', h: 'P/2', K: 'KL', k: 'KL/2' };

const addDays = (from: string, days: number) => {
  const [y = 2000, m = 1, d = 1] = from.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const isSaturdayOrSunday = (day: string) => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

/** Every filled cell of a grid, by day. */
export function cellsOf(grid: string, from: string): Record<string, GoldenCode> {
  const cells: Record<string, GoldenCode> = {};
  [...grid].forEach((char, i) => {
    const code = CODE_OF[char];
    if (code) cells[addDays(from, i)] = code;
  });
  return cells;
}

/** What HR has to type: everything but the 1s of Mon–Fri, which the machine fills. */
export function enteredOf(grid: string, from: string): Record<string, GoldenCode> {
  return Object.fromEntries(
    Object.entries(cellsOf(grid, from)).filter(([day, code]) => code !== '1' || isSaturdayOrSunday(day)),
  );
}
