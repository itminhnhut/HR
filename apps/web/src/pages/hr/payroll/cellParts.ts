import type { PayrollCellKey } from '@careers/shared';
import type { PayrollLineDto } from '../../../api';
import { printedNote, type PayrollColumnSpec } from './payrollModel';

/**
 * "Trong đó" of a total cell (F08): the cells it adds up, each a link to its own sources, so HR reads which number
 * of the formula is which column. Declared here for the totals of HR's file; the engine's formula stays above it.
 */

type Sign = '+' | '−';

const PARTS: Partial<Record<PayrollCellKey, readonly (readonly [Sign, PayrollCellKey])[]>> = {
  income: [
    ['+', 'kpiBonus'],
    ['+', 'otherIncome'],
    ['+', 'overtimePay'],
  ],
  taxable: [
    ['+', 'income'],
    ['−', 'exempt'],
  ],
  assessable: [
    ['+', 'taxable'],
    ['−', 'personalDeduction'],
    ['−', 'dependantDeduction'],
    ['−', 'insuranceDeduction'],
  ],
  totalDeductions: [
    ['+', 'social'],
    ['+', 'health'],
    ['+', 'unemployment'],
    ['+', 'unionFee'],
    ['+', 'tax'],
  ],
  netPay: [
    ['+', 'income'],
    ['−', 'totalDeductions'],
    ['+', 'cash'],
  ],
  companyTotal: [
    ['+', 'companySocial'],
    ['+', 'companyHealth'],
    ['+', 'companyUnemployment'],
    ['+', 'unionFund'],
  ],
  totalCost: [
    ['+', 'income'],
    ['+', 'companyTotal'],
  ],
};

export interface CellPart {
  id: string;
  sign: Sign;
  /** "(18) Lương 1 ngày", or a pay component's name. */
  label: string;
  value: number;
  /** The cell whose sources the row opens; null for a pay component, which opens the person's pay levels. */
  cell: PayrollCellKey | null;
}

/** What was paid of each pay component this month: the first terms of (26). Empty on an older approved month. */
function paidComponents(line: PayrollLineDto, components: readonly { id: string; name: string }[]): CellPart[] {
  const paid = line.sheet?.paid;
  if (!paid) return [];
  return components
    .filter((c) => (paid[c.id] ?? 0) !== 0)
    .map((c) => ({
      id: `khoan:${c.id}`,
      sign: '+',
      label: `${c.name} (theo ngày công)`,
      value: paid[c.id] ?? 0,
      cell: null,
    }));
}

export function cellPartsOf(
  cell: PayrollCellKey,
  line: PayrollLineDto,
  columns: readonly PayrollColumnSpec[],
  components: readonly { id: string; name: string }[],
): CellPart[] {
  const parts = PARTS[cell];
  if (!parts) return [];
  const named = parts.map(([sign, key]): CellPart => {
    const column = columns.find((c) => c.cell === key);
    const label = column ? `(${column.no ?? ''}) ${column.label}` : key;
    return { id: key, sign, label, value: line.cells[key] ?? 0, cell: key };
  });
  return cell === 'income' ? [...paidComponents(line, components), ...named] : named;
}

const BLOCK_CELLS = new Set<PayrollCellKey>(['kpiPercent', 'kpiBonus']);

/** The row's note without "Khối lấy từ hồ sơ…" on a cell the block does not touch (it decides (19) only). */
export function noteFor(cell: PayrollCellKey, note: string): string {
  if (BLOCK_CELLS.has(cell)) return note;
  return printedNote(note);
}
