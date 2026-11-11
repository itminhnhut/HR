import { Pencil } from 'lucide-react';
import type { PayrollLineDto } from '../../../api';
import { ApiError } from '../../../api';
import { isTyped } from './monthInputsModel';
import { Marks } from './PayrollCell';
import { formatValue, type PayrollColumnSpec } from './payrollModel';

/** Pieces shared by the inline number editor and the list editor of the month inputs. */

export const cellLabel = (column: PayrollColumnSpec) => `(${column.no ?? ''}) ${column.label}`;

/** The server's words for the field, else its message; a lost connection says so. */
export function saveError(error: unknown, field: string): string {
  if (error instanceof ApiError) return error.fieldErrors[field] ?? error.message;
  return 'Không lưu được, thử lại.';
}

/** A cell HR can type in (F10): white with a dotted edge and a faint pencil, so it reads apart from a computed one. */
export const INPUT_LOOK = 'group border border-dashed border-slate-300 bg-white hover:border-solid hover:border-blue-400';

/** The number with its marks: a corner when typed over the engine or typed by hand, a dot for an own setting. */
export function InputValue({ line, column }: { line: PayrollLineDto; column: PayrollColumnSpec }) {
  const value = column.value(line);
  const override = line.overrides.find((o) => o.cell === column.cell);
  const own = line.personSettings.filter((s) => !!column.cell && s.cells.includes(column.cell));
  const isHand = !!column.input && isTyped(column.input, line.inputs);
  return (
    <span className="relative inline-flex items-center gap-1">
      <Pencil aria-hidden="true" className="size-3 shrink-0 text-slate-300 group-hover:text-blue-600 group-focus-visible:text-blue-600" />
      <span className={value === 0 ? 'text-slate-400' : 'text-slate-800'}>{formatValue(column.kind, value)}</span>
      <Marks isTyped={!!override} isHand={isHand} isOwn={own.length > 0} />
    </span>
  );
}

