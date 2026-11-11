import { useState } from 'react';
import type { PayrollMonthDto } from '../../../../api';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../vendor/shadcn-grid/components/ui/dialog';
import { OUTLINE } from '../../timesheet/gridParts';
import { PeoplePicker } from '../config/PeoplePicker';
import { draftMark } from './downloadModel';

/** "Phiếu lương nhiều người" (spec 11.7, L-F22): everyone of the month, or the people ticked, in one file. */

const PRIMARY =
  'ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50';

type Mode = 'all' | 'some';

const MODES: readonly { id: Mode; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'some', label: 'Chọn người' },
];

export function PayslipsDialog(p: {
  month: PayrollMonthDto;
  /** The people the grid's filters show: ticked to start with when the filters leave some out. */
  shownIds: readonly string[];
  isBusy: boolean;
  error: string | null;
  /** No ids: everyone of the month. */
  onDownload: (employeeIds?: string[]) => void;
  onClose: () => void;
}) {
  const everyone = p.month.lines.length;
  const isFiltered = p.shownIds.length < everyone;
  const [mode, setMode] = useState<Mode>(isFiltered ? 'some' : 'all');
  const [picked, setPicked] = useState<string[]>(isFiltered ? [...p.shownIds] : []);
  const count = mode === 'all' ? everyone : picked.length;
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="max-w-xl!">
        <DialogHeader>
          <DialogTitle>Tải phiếu lương</DialogTitle>
        </DialogHeader>
        <p className="m-0 text-sm text-slate-600">
          {`T${p.month.month}/${p.month.year}${draftMark(p.month)}: một file, mỗi người một sheet. Phiếu chỉ in 4 số cuối tài khoản.`}
        </p>
        <div role="radiogroup" aria-label="Phiếu của ai" className="flex flex-wrap gap-4 text-sm">
          {MODES.map((m) => (
            <label key={m.id} className="inline-flex min-h-9 items-center gap-2 font-normal">
              <input type="radio" name="payslip-people" checked={mode === m.id} onChange={() => setMode(m.id)} />
              {m.id === 'all' ? `${m.label} (${everyone} người)` : m.label}
            </label>
          ))}
        </div>
        {mode === 'some' && <PeoplePicker people={p.month.lines} picked={picked} onChange={setPicked} />}
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
            disabled={count === 0 || p.isBusy}
            onClick={() => p.onDownload(mode === 'all' ? undefined : picked)}
            className={PRIMARY}
          >
            {p.isBusy ? 'Đang tải…' : `Tải Excel (${count} phiếu)`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
