import type {
  PayrollLineDto,
  PayrollMonthDto,
  PayrollMonthInputsDto,
  PayrollMonthInputsInput,
  PayrollMonthInputsResultDto,
} from '../../../api';
import type { PayrollInputField } from './payrollModel';

/** The month inputs of the grid without React: typed or not, what a typed text sends, the row after a save. */

export type PayrollNumberField = Extract<PayrollInputField, 'kpiPercent' | 'overtimeHours' | 'restDays' | 'holidayDays'>;

export const isNumberField = (field: PayrollInputField): field is PayrollNumberField =>
  field !== 'otherIncome' && field !== 'cash';

/** HR typed this cell this month: a number over the engine's, or a list with something in it. */
export function isTyped(field: PayrollInputField, inputs: PayrollMonthInputsDto): boolean {
  if (field === 'otherIncome' || field === 'cash') return inputs[field].length > 0;
  if (field === 'overtimeHours') return inputs.overtimeHours !== 0;
  return inputs[field] !== null;
}

/** What "Về số tính" sends: null puts a computed cell back to the engine; hours have no formula, so 0. */
export const resetPatch = (field: PayrollNumberField): PayrollMonthInputsInput =>
  field === 'overtimeHours' ? { overtimeHours: 0 } : { [field]: null };

/** The text the inline editor opens with: the typed number, else the number on screen. % KPI is typed as a %. */
export function editText(field: PayrollNumberField, line: PayrollLineDto): string {
  const typed = line.inputs[field];
  const value = typed ?? line.cells[field] ?? 0;
  const shown = field === 'kpiPercent' ? Number((value * 100).toFixed(2)) : value;
  return String(shown).replace('.', ',');
}

export type ParsedInput = { ok: true; patch: PayrollMonthInputsInput } | { ok: false; error: string };

/** "80" or "80,5%" for % KPI (sent as 0,8), "1,5" for hours and days; empty goes back to the engine. */
export function parseNumberInput(field: PayrollNumberField, text: string): ParsedInput {
  const clean = text.replace(/[%\s]/g, '').replace(',', '.');
  if (clean === '') return { ok: true, patch: resetPatch(field) };
  const n = Number(clean);
  if (!Number.isFinite(n)) return { ok: false, error: 'Nhập một số, ví dụ 80 hoặc 1,5.' };
  const value = field === 'kpiPercent' ? Number((n / 100).toFixed(6)) : n;
  return { ok: true, patch: { [field]: value } };
}

/** The month on screen after a save: the person's row as the server computed it again, the rest untouched. */
export function withSavedLine(
  month: PayrollMonthDto,
  employeeId: string,
  saved: PayrollMonthInputsResultDto,
): PayrollMonthDto {
  const lines = month.lines.map((l) =>
    l.employeeId !== employeeId ? l : (saved.line ?? { ...l, inputs: saved.inputs }),
  );
  return { ...month, lines };
}

/** Why a cell cannot be typed in: the month approved or paid, or no KPI for the % (L-D08). */
export function lockReasonOf(field: PayrollInputField, line: PayrollLineDto, monthLock: string | null): string | null {
  if (monthLock) return monthLock;
  return field === 'kpiPercent' && line.kpiAmount <= 0 ? 'Người này không có KPI, ô % khoá.' : null;
}

/** The month's lock in words, for the tooltip of every input cell (spec 4.17, R7). */
export function monthLockOf(status: PayrollMonthDto['status']): string | null {
  if (status === 'approved') return 'Tháng đã duyệt, chỉ xem. Muốn sửa: Mở lại, hoặc truy lĩnh / truy thu ở tháng sau.';
  if (status === 'paid') return 'Tháng đã chuyển khoản, chỉ xem. Sửa bằng truy lĩnh / truy thu ở tháng sau.';
  return null;
}
