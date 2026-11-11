import type { PayslipChangesDto, PayslipPersonDto } from '@careers/shared';
import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type PayrollMonthDto } from '../../../../api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../vendor/shadcn-grid/components/ui/dialog';
import { errorMessage } from '../../parts';
import { OUTLINE } from '../../timesheet/gridParts';
import { payslipOnScreen } from '../excel/fromMonth';
import { LogLine } from '../log/LogLine';
import { linksOf, type LogPerson } from '../log/logModel';
import { diffWords, figureRows, figureWords, logAddress, whyWords, type FigureRow } from './payslipChangesModel';
import { sentTimeWords } from './payslipsModel';

/**
 * "Thay đổi từ lần gửi" of one person: why the payslip sent may be out of date, every figure of the payslip that is
 * not what was sent (net pay first, the rest behind a tick), and what was done since, as the Nhật ký tab shows it.
 * It only reads; marking again, or saying the payslip sent is still right, is at its foot.
 */

export const payslipChangesKey = (monthKey: string, employeeId: string) => [
  'hr',
  'payroll',
  'payslips',
  monthKey,
  'changes',
  employeeId,
];

export interface PayslipChangesDrawerProps {
  month: PayrollMonthDto;
  person: PayslipPersonDto;
  /** Everyone of the month, for the links of a log line. */
  people: readonly LogPerson[];
  canSend: boolean;
  isBusy: boolean;
  error: string | null;
  onOpenPayslip: () => void;
  onMarkAgain: () => void;
  onConfirmUnchanged: () => void;
  onClose: () => void;
}

const HEAD = 'h-10 px-2 text-left text-xs font-medium text-slate-600';
const NUMBER = 'p-2 text-right tabular-nums whitespace-nowrap';
const diffTone = (row: FigureRow) =>
  !row.diff ? 'text-slate-500' : row.diff > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700';

function Figures({ rows }: { rows: readonly FigureRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className={HEAD}>Dòng trên phiếu lương</th>
            <th className={`${HEAD} text-right`}>Lúc gửi</th>
            <th className={`${HEAD} text-right`}>Bây giờ</th>
            <th className={`${HEAD} text-right`}>Chênh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b last:border-b-0 ${row.id === 'net' ? 'bg-amber-50 font-semibold' : ''}`}
            >
              <td className={`p-2 break-words ${row.isDetail ? 'pl-6 text-slate-600' : ''}`}>{row.label}</td>
              <td className={NUMBER}>{figureWords(row.sent, row.format)}</td>
              <td className={NUMBER}>{figureWords(row.now, row.format)}</td>
              <td className={`${NUMBER} ${diffTone(row)}`}>{diffWords(row.diff, row.format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FiguresPart({ dto, month }: { dto: PayslipChangesDto; month: PayrollMonthDto }) {
  const [isAll, setIsAll] = useState(false);
  const rows = useMemo(() => {
    const sent = dto.sentMonth ? payslipOnScreen(dto.sentMonth, dto.employeeId) : null;
    return figureRows(sent, payslipOnScreen(month, dto.employeeId));
  }, [dto, month]);
  const changed = rows.filter((r) => r.isChanged);
  const hasUnknown = rows.some((r) => r.sent === null);
  const shown = isAll ? rows : changed;
  return (
    <section aria-label="Số trên phiếu lương" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">{`Số trên phiếu lương: ${changed.length} dòng đã đổi`}</h3>
        <label className="inline-flex min-h-9 items-center gap-2 text-sm font-normal max-sm:min-h-11">
          <input type="checkbox" checked={isAll} onChange={(e) => setIsAll(e.target.checked)} className="size-4" />
          {`Hiện cả dòng không đổi (${rows.length - changed.length})`}
        </label>
      </div>
      {!dto.sentMonth && (
        <p role="note" className="m-0 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {`Bản duyệt lần ${dto.sent?.approvalNo ?? ''} không còn lưu số của người này nên không so được từng dòng; cột "Lúc gửi" để "—". Xem phần nhật ký bên dưới.`}
        </p>
      )}
      {dto.sentMonth && changed.length === 0 && (
        <p
          role="status"
          className="m-0 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900"
        >
          Số trên phiếu không đổi so với lần gửi.
        </p>
      )}
      {shown.length > 0 && <Figures rows={shown} />}
      {dto.sentMonth && hasUnknown && (
        <p className="m-0 text-xs text-slate-600">"—": bản duyệt lúc gửi chưa lưu dòng này nên không so được.</p>
      )}
    </section>
  );
}

function LogPart({ dto, people }: { dto: PayslipChangesDto; people: readonly LogPerson[] }) {
  return (
    <section aria-label="Đã làm gì từ lần gửi" className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">{`Đã làm gì từ lần gửi (${dto.log.length})`}</h3>
        <Link
          to={logAddress(dto.monthKey, dto.code)}
          className="inline-flex min-h-9 items-center text-sm max-sm:min-h-11"
        >
          Xem tất cả trong Nhật ký
        </Link>
      </div>
      {dto.log.length === 0 ? (
        <p className="m-0 text-sm text-slate-600">Nhật ký không có dòng nào về người này hoặc cả tháng từ lần gửi.</p>
      ) : (
        <ul className="m-0 list-none p-0 text-sm">
          {dto.log.map((line) => (
            <LogLine key={line.id} line={line} links={linksOf(line, people, dto.monthKey)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Foot({ p, dto }: { p: PayslipChangesDrawerProps; dto: PayslipChangesDto | undefined }) {
  const held = p.canSend ? undefined : 'Tháng chưa duyệt — duyệt bảng lương rồi mới gửi phiếu';
  return (
    <footer className="flex flex-col gap-2 border-t px-5 py-3">
      {p.error && (
        <p role="alert" className="m-0 text-sm text-red-600">
          {p.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={p.onOpenPayslip} className={OUTLINE}>
          Xem phiếu hiện tại
        </button>
        {dto?.canConfirmUnchanged && (
          <button type="button" disabled={p.isBusy} onClick={p.onConfirmUnchanged} className={OUTLINE}>
            Đánh dấu vẫn đúng (không cần gửi lại)
          </button>
        )}
        <span title={held} className="ml-auto inline-flex max-sm:ml-0 max-sm:w-full">
          <button
            type="button"
            disabled={!p.canSend || p.isBusy}
            onClick={p.onMarkAgain}
            className="ts-field inline-flex items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 max-sm:w-full"
          >
            Đánh dấu đã gửi lại
          </button>
        </span>
      </div>
    </footer>
  );
}

export function PayslipChangesDrawer(p: PayslipChangesDrawerProps) {
  const title = useRef<HTMLHeadingElement>(null);
  const { month, person } = p;
  const query = useQuery({
    queryKey: payslipChangesKey(month.monthKey, person.employeeId),
    queryFn: () => api.hrPayrollPayslipChanges(month.monthKey, person.employeeId),
    refetchOnWindowFocus: false,
  });
  const dto = query.data;
  const when = person.send.at ? ` ${sentTimeWords(person.send.at)}` : '';
  return (
    <Dialog open onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent
        initialFocus={title}
        className="top-0! right-0! left-auto! flex h-dvh max-h-dvh! w-full max-w-3xl! translate-x-0! translate-y-0! flex-col gap-0 rounded-none! rounded-l-xl! p-0 max-sm:rounded-none!"
      >
        <DialogHeader className="m-0! border-b px-5! py-4! pr-14!">
          <DialogTitle ref={title} tabIndex={-1} className="flex flex-wrap items-center gap-2 outline-none">
            <GitCompareArrows className="size-5 shrink-0 text-amber-600" />
            <span className="min-w-0 break-words">{`Thay đổi từ lần gửi${when} · ${person.fullName} · T${month.month}/${month.year}`}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Phiếu lương lúc gửi so với phiếu lương bây giờ, và nhật ký từ lần gửi
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {query.isPending && <p className="m-0 text-sm text-slate-600">Đang so phiếu lương lúc gửi với bây giờ…</p>}
          {query.isError && (
            <p role="alert" className="m-0 text-sm text-red-600">
              {errorMessage(query.error)}
            </p>
          )}
          {dto && (
            <>
              <section aria-label="Vì sao cần gửi lại" className="rounded-md border bg-slate-50 px-3 py-2">
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
                  {whyWords(dto).map((words) => (
                    <li key={words}>{words}</li>
                  ))}
                </ul>
              </section>
              <FiguresPart dto={dto} month={month} />
              <LogPart dto={dto} people={p.people} />
            </>
          )}
        </div>
        <Foot p={p} dto={dto} />
      </DialogContent>
    </Dialog>
  );
}
