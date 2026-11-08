import { SHEET_LEAVE_CODES, type AbsenceRowDto } from '@careers/shared';

type SheetLeaveCode = (typeof SHEET_LEAVE_CODES)[number];
const isSheetCode = (code: string): code is SheetLeaveCode => (SHEET_LEAVE_CODES as readonly string[]).includes(code);

/** A line typed on the sheet, as the API takes it over or clears it. */
export interface SheetLine {
  code: SheetLeaveCode;
  from: string;
  to: string;
}

type Counting = 'CL' | 'P' | 'KL' | 'M' | 'TS' | 'OM';

/** The reason each typed code stands for. KP (without permission) has none: such a line can only be cleared. */
const REASON_OF: Record<string, { reason: string; code: Counting; isHalf: boolean }> = {
  P: { reason: 'annual', code: 'P', isHalf: false },
  'P/2': { reason: 'annual', code: 'P', isHalf: true },
  KL: { reason: 'unpaid', code: 'KL', isHalf: false },
  'KL/2': { reason: 'unpaid', code: 'KL', isHalf: true },
  M: { reason: 'late', code: 'M', isHalf: false },
  OM: { reason: 'sick', code: 'OM', isHalf: false },
  TS: { reason: 'maternity', code: 'TS', isHalf: false },
  CL: { reason: 'other-paid', code: 'CL', isHalf: false },
};

/** "Sửa" on a typed line: the form starts from it, approved by whoever typed it (HR), and saving takes its days over. */
export function sheetLineForm(row: AbsenceRowDto) {
  const reason = REASON_OF[row.code];
  if (!reason || !isSheetCode(row.code)) return null;
  return {
    personId: row.employeeId,
    ...reason,
    from: row.from,
    to: row.to,
    approvedBy: row.approvedBy ?? '',
    handover: row.handover,
    note: row.note,
    replaces: { code: row.code, from: row.from, to: row.to } satisfies SheetLine,
  };
}
