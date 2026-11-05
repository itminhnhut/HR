import type { TimesheetDto, TimesheetMonthDto } from '@careers/shared';
import { CheckCircle2, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { errorMessage } from '../parts';
import { exportTimesheetMonths, type ExportArgs } from './exportExcel';
import { MONTH_LOOK, MonthGrid, useTimesheetYear, YearNav } from './months';
import { adjustmentNotesOf, dayColumns, gridRows, notesOf } from './timesheetModel';

export const exportArgsOf = (dto: TimesheetDto): ExportArgs => {
  const days = dayColumns(dto);
  return {
    rows: gridRows(dto, days),
    days,
    notes: notesOf(dto, days),
    adjustmentNotes: adjustmentNotesOf(dto),
    isClosed: dto.status === 'closed',
    isFreeRange: false,
    from: dto.from,
    to: dto.to,
    year: dto.year,
    month: dto.month,
    regions: dto.regions.map((r) => ({ id: r.id, name: r.name, norm: dto.norms[r.id] ?? 0 })),
  };
};

/** A month nobody used would read full attendance only because nothing was entered, so it is not a payroll sheet. */
const canExport = (m: TimesheetMonthDto) => m.status === 'closed' || m.status === 'waiting' || m.status === 'running';

/** One file with one sheet a month, as HR's workbook. */
export function ExportMonthsDialog({ open, year: startYear, onClose }: { open: boolean; year: number; onClose: () => void }) {
  const [year, setYear] = useState(startYear);
  const [picked, setPicked] = useState<number[] | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<unknown>(null);
  const months = useTimesheetYear(year);
  const offered = (months.data ?? []).filter(canExport);
  const chosen = picked ?? offered.map((m) => m.month);
  const changeYear = (next: number) => {
    setYear(next);
    setPicked(null);
    setState('idle');
  };
  const toggle = (m: TimesheetMonthDto) => {
    setState('idle');
    setPicked(chosen.includes(m.month) ? chosen.filter((x) => x !== m.month) : [...chosen, m.month].sort((a, b) => a - b));
  };
  const download = async () => {
    setState('busy');
    setError(null);
    try {
      const sheets = await Promise.all(chosen.map((month) => api.hrTimesheet(year, month)));
      await exportTimesheetMonths(sheets.map(exportArgsOf));
      setState('done');
    } catch (cause) {
      setError(cause);
      setState('idle');
    }
  };
  const drafts = (months.data ?? []).filter((m) => chosen.includes(m.month) && m.status !== 'closed').length;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-green-600" />Tải nhiều tháng</DialogTitle></DialogHeader>
        <YearNav year={year} onChange={changeYear} />
        {months.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(months.error)}</p>}
        <MonthGrid months={months.data ?? []} isOn={(m) => chosen.includes(m.month)} isDisabled={(m) => !canExport(m)} onPick={toggle} />
        <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-slate-600">
          {(['closed', 'running', 'waiting', 'empty', 'future'] as const).map((key) => {
            const look = MONTH_LOOK[key];
            return <li key={key} className="inline-flex items-center gap-1 whitespace-nowrap"><look.icon className={`size-3 ${look.tone}`} />{look.word}</li>;
          })}
        </ul>
        <p data-testid="export-summary" className="m-0 text-sm text-slate-700">
          {chosen.length === 0 ? 'Chưa chọn tháng nào' : `${chosen.length} sheet`}
          {drafts > 0 ? ` · ${drafts} bản nháp` : ''}
        </p>
        {state === 'done' && <p role="status" className="m-0 flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="size-4" />Đã tải file</p>}
        {!!error && <p role="alert" className="m-0 text-sm text-red-600">Chưa tải được file. {errorMessage(error)}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className="h-9 rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50">Đóng</button>
          <button type="button" disabled={chosen.length === 0 || state === 'busy'} onClick={() => void download()} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">
            {state === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Tải Excel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
