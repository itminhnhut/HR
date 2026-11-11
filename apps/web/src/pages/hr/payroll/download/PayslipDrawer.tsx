import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Download, ReceiptText } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import type { PayrollLineDto, PayrollMonthDto } from '../../../../api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../vendor/shadcn-grid/components/ui/dialog';
import { OUTLINE } from '../../timesheet/gridParts';
import { payslipOnScreen } from '../excel/fromMonth';
import { PayslipCard } from '../excel/PayslipCard';
import { payslipSearch } from './downloadModel';
import { usePayrollDownload } from './usePayrollDownload';

/**
 * Phiếu lương of one person and month over the grid (spec 11.7, `?phieu=<employeeId>`): the card as the file prints
 * it, from the month on screen, so the account shows its last digits only. "Tải Excel" asks the server for the file.
 */

/** The row's way in: beside the name, so the name column keeps its width for the name (see `PAYSLIP_LINK_WIDTH`). */
export const PAYSLIP_LINK_WIDTH = 24;

export function PayslipLink({ line }: { line: PayrollLineDto }) {
  const { pathname, search } = useLocation();
  return (
    <Link
      to={{ pathname, search: payslipSearch(search, line.employeeId) }}
      aria-label={`Xem phiếu lương ${line.fullName}`}
      title="Xem phiếu lương"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-700"
    >
      <ReceiptText className="size-3.5" />
    </Link>
  );
}

export function PayslipDrawer(p: { month: PayrollMonthDto; employeeId: string; onClose: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  const download = usePayrollDownload();
  const slip = useMemo(() => payslipOnScreen(p.month, p.employeeId), [p.month, p.employeeId]);
  const monthName = `T${p.month.month}/${p.month.year}`;
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent
        initialFocus={title}
        className="top-0! right-0! left-auto! flex h-dvh max-h-dvh! w-full max-w-2xl! translate-x-0! translate-y-0! flex-col gap-0 rounded-none! rounded-l-xl! p-0 max-sm:rounded-none!"
      >
        <DialogHeader className="m-0! border-b px-5! py-4! pr-14!">
          <DialogTitle ref={title} tabIndex={-1} className="flex flex-wrap items-center gap-2 outline-none">
            <ReceiptText className="size-5 shrink-0 text-blue-600" />
            <span className="min-w-0 break-words">{`Phiếu lương · ${slip ? `${slip.name} · ` : ''}${monthName}`}</span>
          </DialogTitle>
          <DialogPrimitive.Description className="sr-only">
            Phiếu lương của một người trong tháng đang xem
          </DialogPrimitive.Description>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {slip ? (
            <PayslipCard slip={slip} />
          ) : (
            <p className="m-0 text-sm text-slate-600">Người này không có dòng ở tháng đang xem.</p>
          )}
        </div>
        {slip && (
          <div className="flex flex-wrap items-center gap-3 border-t px-5 py-3">
            <button
              type="button"
              disabled={download.isBusy}
              onClick={() => void download.payslips(p.month.monthKey, [p.employeeId])}
              className={OUTLINE}
            >
              <Download className="size-4 text-blue-600" />
              {download.isBusy ? 'Đang tải…' : 'Tải Excel'}
            </button>
            {download.error && (
              <p role="alert" className="m-0 text-sm text-red-600">
                {download.error}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
