import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../vendor/shadcn-grid/components/ui/dialog';
import { OUTLINE } from '../../timesheet/gridParts';
import { canExportMonth, exportSummary, type PayrollMonthChoice } from '../excel/selection';
import { rangeChoices } from './downloadModel';

/** "Nhiều tháng…" (spec 12.1, L-F09): from one month to another among the months of the year that have numbers. */

const PRIMARY =
  'ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50';
const SELECT = 'ts-field rounded-md border bg-white px-2 text-sm';

const STATUS_WORDS: Partial<Record<PayrollMonthChoice['status'], string>> = {
  draft: 'Nháp',
  approved: 'Đã duyệt',
  paid: 'Đã chuyển khoản',
};

function MonthSelect(p: {
  label: string;
  value: number | undefined;
  choices: readonly PayrollMonthChoice[];
  onChange: (month: number) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
      {p.label}
      <select value={p.value ?? ''} onChange={(e) => p.onChange(Number(e.target.value))} className={SELECT}>
        {p.choices.map((c) => (
          <option key={c.month} value={c.month}>{`T${c.month} · ${STATUS_WORDS[c.status] ?? ''}`}</option>
        ))}
      </select>
    </label>
  );
}

export function MonthsDialog(p: {
  year: number;
  choices: readonly PayrollMonthChoice[];
  isLoading: boolean;
  isBusy: boolean;
  error: string | null;
  /** The grid is filtered to this many people: the dialog offers to keep the files to them (ticked at first). */
  filteredCount?: number | null;
  onDownload: (months: number[], isFiltered: boolean) => void;
  onClose: () => void;
}) {
  const offered = p.choices.filter(canExportMonth);
  const count = p.filteredCount ?? null;
  const [isFiltered, setIsFiltered] = useState(count !== null);
  const [picked, setPicked] = useState<{ from?: number; to?: number }>({});
  const from = picked.from ?? offered[0]?.month;
  const to = picked.to ?? offered[offered.length - 1]?.month;
  const chosen = from === undefined || to === undefined ? [] : rangeChoices(p.choices, from, to);
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="max-w-md!">
        <DialogHeader>
          <DialogTitle>Tải nhiều tháng</DialogTitle>
        </DialogHeader>
        <p className="m-0 text-sm text-slate-600">
          {`Năm ${p.year}: mỗi tháng một sheet, kèm "Tổng hợp" và "Tham số áp dụng". Tháng chưa duyệt ghi NHÁP.`}
        </p>
        {p.isLoading && (
          <p role="status" className="m-0 text-sm text-slate-600">
            Đang đọc các tháng của năm…
          </p>
        )}
        {!p.isLoading && offered.length === 0 && (
          <p className="m-0 text-sm text-slate-600">{`Năm ${p.year} chưa có tháng nào có số.`}</p>
        )}
        {offered.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <MonthSelect
              label="Từ tháng"
              value={from}
              choices={offered}
              onChange={(m) => setPicked({ ...picked, from: m })}
            />
            <MonthSelect
              label="Đến tháng"
              value={to}
              choices={offered}
              onChange={(m) => setPicked({ ...picked, to: m })}
            />
          </div>
        )}
        {count !== null && (
          <label className="flex min-h-9 items-center gap-2 text-sm font-normal max-sm:min-h-11">
            <input type="checkbox" checked={isFiltered} onChange={(e) => setIsFiltered(e.target.checked)} />
            {`Chỉ ${count} người đang lọc trên lưới (bỏ tích: tải tất cả)`}
          </label>
        )}
        <p data-testid="export-summary" className="m-0 text-sm font-medium text-slate-800">
          {exportSummary(chosen)}
        </p>
        {p.error && (
          <p role="alert" className="m-0 text-sm text-red-600">
            {p.error}
          </p>
        )}
        <DialogFooter>
          <button type="button" onClick={p.onClose} className={OUTLINE}>
            Huỷ
          </button>
          <button
            type="button"
            disabled={chosen.length === 0 || p.isBusy || p.isLoading}
            onClick={() =>
              p.onDownload(
                chosen.map((c) => c.month),
                isFiltered && count !== null,
              )
            }
            className={PRIMARY}
          >
            {p.isBusy ? 'Đang tải…' : 'Tải Excel'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
