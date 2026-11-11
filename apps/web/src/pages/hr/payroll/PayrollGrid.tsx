import { useMemo, useRef, useState } from 'react';
import type { PayrollLineDto, PayrollMonthDto } from '../../../api';
import { DataGrid } from '../../../vendor/shadcn-grid/components/data-grid/data-grid';
import { useDataGrid } from '../../../vendor/shadcn-grid/hooks/use-data-grid';
import { useGridHeight } from '../timesheet/gridHooks';
import { monthRates } from './config/configModel';
import { useSettingsMonth } from './config/configQueries';
import { monthLockOf } from './monthInputsModel';
import { makePayrollColumns, payrollPins } from './payrollColumns';
import {
  columnTotals,
  contractShort,
  gridRowsOf,
  payrollBands,
  regionShort,
  type PayrollGridRow,
} from './payrollModel';
import './payroll.css';

/** The grid itself: the Chấm công data grid, read only, scrolling inside its own box (spec 4.22, 11.10). */

const PHONE_WIDTH = 640;

export function PayrollGrid({ month, lines }: { month: PayrollMonthDto; lines: readonly PayrollLineDto[] }) {
  const [pinned] = useState(() => payrollPins(window.innerWidth));
  const [isPhone] = useState(() => window.innerWidth < PHONE_WIDTH);
  const names = useMemo(
    () => ({
      regions: Object.fromEntries(month.regions.map((r) => [r.id, regionShort(r.name)])),
      contracts: Object.fromEntries(month.contractTypes.map((t) => [t.id, contractShort(t.name)])),
    }),
    [month.regions, month.contractTypes],
  );
  const rows = useMemo(() => gridRowsOf(lines, names), [lines, names]);
  // The rates in the headings come with the month's settings; until then (or without them) the bare names show.
  const settings = useSettingsMonth(month.monthKey).data;
  const rates = useMemo(() => (settings ? monthRates(settings) : undefined), [settings]);
  const bands = useMemo(() => payrollBands(month.components, rates), [month.components, rates]);
  const totals = useMemo(() => columnTotals(lines, bands), [lines, bands]);
  const groupLabels = useMemo(
    () => gridRowsOf(month.lines, names).flatMap((r) => (r.kind === 'group' ? [r.label] : [])),
    [month.lines, names],
  );
  const columns = useMemo(() => {
    const context = {
      monthKey: month.monthKey,
      to: month.period.to,
      isLocked: month.status === 'approved' || month.status === 'paid',
      lockReason: monthLockOf(month.status),
    };
    return makePayrollColumns({ bands, month, context, pinned, totals, groupLabels });
  }, [bands, month, pinned, totals, groupLabels]);
  const grid = useDataGrid<PayrollGridRow>({
    data: rows,
    columns: columns as never,
    readOnly: true,
    getRowId: (r: PayrollGridRow) => r.id,
    initialState: { columnPinning: { start: pinned, end: [] }, rowHeight: isPhone ? 'medium' : 'short' },
  } as never);
  const host = useRef<HTMLDivElement>(null);
  const height = useGridHeight(host, rows.length, isPhone ? 56 : 36);
  return (
    <div ref={host} data-payroll-grid className="min-w-0">
      <DataGrid {...grid} height={height} />
    </div>
  );
}
