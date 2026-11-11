import { payrollTotals, sortPayrollRows } from '@careers/shared';
import { isEngineTotal, type PayrollColumn } from './columns';
import type { PayrollExportMonth, PayrollExportRow } from './types';

/** D13 (câu 26): region, contract type in the configured order, block, code; the Excel, payslips and screen agree. */
export function orderedRows(month: PayrollExportMonth): PayrollExportRow[] {
  const keyed = month.rows.map((row) => ({
    row,
    code: row.person.code,
    regionOrder: row.person.regionOrder,
    contractTypeId: row.person.contractTypeId,
    block: row.person.block,
  }));
  return sortPayrollRows(keyed, month.config.contractTypes).map((k) => k.row);
}

const numberOf = (value: string | number | null) => (typeof value === 'number' ? value : 0);

/**
 * The TỔNG CỘNG row: the engine's own totals for its money cells (D01, so the file matches the screen to the dong,
 * L-F17), a plain sum for the levels of group A and the overtime hours, nothing for the rest.
 */
export function columnTotals(columns: readonly PayrollColumn[], month: PayrollExportMonth): (number | null)[] {
  const engine: Readonly<Record<string, number>> = payrollTotals(
    month.rows.map((r) => r.line),
    month.config.options.rounding,
  );
  return columns.map((column) => {
    if (!column.isTotalled) return null;
    if (isEngineTotal(column.key, engine)) return engine[column.key] ?? 0;
    return month.rows.reduce((acc, row) => acc + numberOf(column.value(row)), 0);
  });
}
