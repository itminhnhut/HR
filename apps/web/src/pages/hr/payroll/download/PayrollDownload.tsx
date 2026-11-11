import { ChevronDown, Download } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { PayrollMonthDto } from '../../../../api';
import { OUTLINE, WithReason } from '../../timesheet/gridParts';
import { exportBlockOf } from '../excel/fromMonth';
import { yearExportMonths } from '../excel/selection';
import { overviewFromParams } from '../overview/overviewModel';
import { filterLines, isFiltered } from '../payrollModel';
import { usePayrollYear } from '../queries';
import { usePayrollAddress } from '../usePayrollAddress';
import { draftMark, monthKeysOf, yearChoicesOf } from './downloadModel';
import { MonthsDialog } from './MonthsDialog';
import { PayslipsDialog } from './PayslipsDialog';
import { usePayrollDownload } from './usePayrollDownload';

/**
 * "Tải Excel" in the month's header (spec 12.1, 11.7): this month, several months, the whole pay year, or payslips
 * of many people. Off, with the reason, while the month waits for the timesheet close or has no rows. The file follows
 * the screen (F29): a filtered grid offers "Đang lọc · n người" first and everyone second; a filtered file says so.
 */

const ITEM =
  'flex min-h-9 w-full items-center rounded px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 max-sm:min-h-11';

type Choice = 'months' | 'payslips';

/** The open menu: it alone reads the months of the year, so a page that never opens it asks for nothing more. */
function Menu(p: {
  month: PayrollMonthDto;
  /** The people the grid shows when it is filtered; null: no filter, the file has everyone. */
  shownIds: readonly string[] | null;
  /** The year "Cả năm" takes: the one Tổng quan is browsing, else the month's (C01). */
  year: number;
  isBusy: boolean;
  onPayroll: (months: number[], isFiltered: boolean, year?: number) => void;
  onChoose: (choice: Choice) => void;
}) {
  const { month, shownIds } = p;
  const name = `T${month.month}/${month.year}${draftMark(month)}`;
  const year = usePayrollYear(p.year);
  const months = yearExportMonths(yearChoicesOf(year.loads));
  return (
    <div
      role="menu"
      aria-label="Tải Excel"
      className="absolute top-full right-0 z-30 mt-1 flex min-w-56 flex-col rounded-md border bg-white p-1 shadow-lg"
    >
      {shownIds && (
        <button
          type="button"
          role="menuitem"
          disabled={p.isBusy || shownIds.length === 0}
          onClick={() => p.onPayroll([month.month], true)}
          className={`${ITEM} font-semibold`}
        >
          {`Đang lọc · ${shownIds.length} người · ${name}`}
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        disabled={p.isBusy}
        onClick={() => p.onPayroll([month.month], false)}
        className={ITEM}
      >
        {shownIds ? `Cả tháng · ${month.lines.length} người · ${name}` : `Tháng này · ${name}`}
      </button>
      <button type="button" role="menuitem" onClick={() => p.onChoose('months')} className={ITEM}>
        Nhiều tháng…
      </button>
      {shownIds && (
        <button
          type="button"
          role="menuitem"
          disabled={p.isBusy || year.isLoading || months.length === 0 || shownIds.length === 0}
          onClick={() => p.onPayroll(months, true, p.year)}
          className={ITEM}
        >
          {`Cả năm ${p.year} · đang lọc ${shownIds.length} người`}
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        disabled={p.isBusy || year.isLoading || months.length === 0}
        onClick={() => p.onPayroll(months, false, p.year)}
        className={ITEM}
      >
        {shownIds ? `Cả năm ${p.year} · tất cả` : `Cả năm ${p.year}`}
      </button>
      <button type="button" role="menuitem" onClick={() => p.onChoose('payslips')} className={`${ITEM} border-t`}>
        Phiếu lương nhiều người…
      </button>
      <p role="status" className="m-0 px-3 py-1 text-xs text-slate-500">
        {year.isLoading
          ? 'Đang đọc các tháng của năm…'
          : shownIds
            ? `Lưới đang lọc ${shownIds.length}/${month.lines.length} người: file "Đang lọc" ghi rõ là đã lọc.`
            : `Tải đủ ${month.lines.length} người.`}
      </p>
    </div>
  );
}

function MonthsChoice(p: {
  year: number;
  shownIds: readonly string[] | null;
  download: ReturnType<typeof usePayrollDownload>;
  onClose: () => void;
}) {
  const year = usePayrollYear(p.year);
  const choices = useMemo(() => yearChoicesOf(year.loads), [year.loads]);
  const run = async (months: number[], isFiltered: boolean) => {
    const ids = isFiltered && p.shownIds ? p.shownIds : undefined;
    if (await p.download.payroll(monthKeysOf(p.year, months), ids)) p.onClose();
  };
  return (
    <MonthsDialog
      year={p.year}
      choices={choices}
      isLoading={year.isLoading}
      isBusy={p.download.isBusy}
      error={p.download.error}
      filteredCount={p.shownIds ? p.shownIds.length : null}
      onDownload={(months, isFiltered) => void run(months, isFiltered)}
      onClose={p.onClose}
    />
  );
}

/** Closes on a click outside and on Escape. */
function useDismiss(isOpen: boolean, close: () => void) {
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (e.target instanceof Node && !box.current?.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);
  return box;
}

export function PayrollDownload({ month }: { month: PayrollMonthDto }) {
  const hint = useId();
  const { filters } = usePayrollAddress();
  const [isOpen, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const download = usePayrollDownload();
  const box = useDismiss(isOpen, () => setOpen(false));
  const reason = exportBlockOf(month);
  const choose = (next: Choice) => {
    setOpen(false);
    setChoice(next);
  };
  // The download follows the screen (F29): a filtered grid offers its own people first, everyone second.
  const shown = useMemo(() => filterLines(month.lines, filters).map((l) => l.employeeId), [month.lines, filters]);
  const shownIds = isFiltered(filters) && shown.length < month.lines.length ? shown : null;
  // On Tổng quan › Theo năm the year browsed can differ from the pay month's: "Cả năm" and "Nhiều tháng…" take it.
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const browsed = overviewFromParams(params, month.year);
  const year = pathname.endsWith('/tong-quan') && browsed.view === 'nam' ? browsed.year : month.year;
  const payroll = (months: number[], isOnlyShown: boolean, ofYear = month.year) => {
    setOpen(false);
    void download.payroll(monthKeysOf(ofYear, months), isOnlyShown && shownIds ? shownIds : undefined);
  };
  const payslips = async (employeeIds?: string[]) => {
    if (await download.payslips(month.monthKey, employeeIds)) setChoice(null);
  };
  return (
    <span ref={box} className="relative inline-flex">
      <WithReason reason={reason}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-describedby={reason ? hint : undefined}
          disabled={reason !== null || download.isBusy}
          onClick={() => setOpen(!isOpen)}
          className={OUTLINE}
        >
          <Download className="size-4 text-blue-600" />
          Tải Excel
          <ChevronDown aria-hidden="true" className="size-3.5 text-slate-500" />
        </button>
      </WithReason>
      {reason && (
        <span id={hint} className="sr-only">
          {reason}
        </span>
      )}
      {isOpen && !reason && (
        <Menu
          month={month}
          shownIds={shownIds}
          year={year}
          isBusy={download.isBusy}
          onPayroll={payroll}
          onChoose={choose}
        />
      )}
      {choice === 'months' && (
        <MonthsChoice year={year} shownIds={shownIds} download={download} onClose={() => setChoice(null)} />
      )}
      {choice === 'payslips' && (
        <PayslipsDialog
          month={month}
          shownIds={shown}
          isBusy={download.isBusy}
          error={download.error}
          onDownload={(ids) => void payslips(ids)}
          onClose={() => setChoice(null)}
        />
      )}
    </span>
  );
}
