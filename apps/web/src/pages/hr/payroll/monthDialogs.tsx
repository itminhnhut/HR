import { groupThousands } from '@careers/shared';
import { Banknote, CheckCircle2, LockOpen } from 'lucide-react';
import { useRef, useState, type ReactNode, type Ref } from 'react';
import type { PayrollMonthDto } from '../../../api';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../vendor/shadcn-grid/components/ui/dialog';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../parts';
import { DateField } from '../timesheet/DateField';
import { Field } from '../timesheet/dialogs';
import { canApproveNow, dayMonthOf, reviewCounts, timeAndDay } from './monthActionsModel';

/** The three month dialogs of spec 11.4: Duyệt, Mở lại, Đã chuyển khoản. Each one says what it is about to change. */

const OUTLINE = 'ts-field rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50';
const PRIMARY =
  'ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50';

const monthName = (m: PayrollMonthDto) => `T${m.month}/${m.year}`;
const dong = (n: number | undefined) => `${groupThousands(Math.round(n ?? 0))} đ`;
const fullDay = (day: string) => `${dayMonthOf(day)}/${day.slice(0, 4)}`;

interface ActionDialogProps {
  open: boolean;
  month: PayrollMonthDto;
  isBusy: boolean;
  error: unknown;
  onClose: () => void;
}

/** One line of facts: a label on the left, the value on the right. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-b-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className="m-0 text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="m-0 flex flex-col rounded-md bg-slate-50 px-3 py-1 text-sm">{children}</dl>;
}

function Failure({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="m-0 text-sm text-red-600">
      {errorMessage(error)}
    </p>
  );
}

/** The cancel button holds the focus, so a stray Enter changes nothing. */
function Footer({
  cancel,
  onCancel,
  children,
}: {
  cancel: Ref<HTMLButtonElement>;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <DialogFooter>
      <button ref={cancel} type="button" onClick={onCancel} className={OUTLINE}>
        Huỷ
      </button>
      {children}
    </DialogFooter>
  );
}

function Shell({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: (cancel: Ref<HTMLButtonElement>) => ReactNode;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent initialFocus={cancel} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children(cancel)}
      </DialogContent>
    </Dialog>
  );
}

/** Duyệt (L-M01): who, how much, which warnings are left; red ones need "Đã xem" first. */
export function ApproveDialog({
  open,
  month,
  approver,
  isBusy,
  error,
  onClose,
  onApprove,
}: ActionDialogProps & { approver: string; onApprove: (acknowledgedRed: boolean) => void }) {
  const [hasSeenRed, setHasSeenRed] = useState(false);
  const counts = reviewCounts(month.review);
  const isReady = canApproveNow(month.review, hasSeenRed);
  return (
    <Shell open={open} title={`Duyệt bảng lương ${monthName(month)}`} onClose={onClose}>
      {(cancel) => (
        <>
          <Facts>
            <Fact label="Số người">{month.lines.length}</Fact>
            <Fact label="Cảnh báo còn lại">{`${counts.red} đỏ · ${counts.yellow} vàng`}</Fact>
            <Fact label="Tổng thực nhận">{dong(month.totals.netPay)}</Fact>
            <Fact label="Tổng chi phí">{dong(month.totals.totalCost)}</Fact>
            <Fact label="Ngày chi trả">{fullDay(month.payDate)}</Fact>
            <Fact label="Người duyệt">{approver}</Fact>
          </Facts>
          <p className="m-0 text-sm text-slate-600">
            Duyệt lưu bản chụp bất biến của tháng. Sau đó muốn sửa phải Mở lại hoặc truy lĩnh / truy thu ở tháng sau.
          </p>
          {counts.red > 0 && (
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-900">
              <input
                type="checkbox"
                checked={hasSeenRed}
                onChange={(e) => setHasSeenRed(e.target.checked)}
                className="size-4 accent-red-600"
              />
              {`Đã xem ${counts.red} cảnh báo đỏ ở Rà soát`}
            </label>
          )}
          <Failure error={error} />
          <Footer cancel={cancel} onCancel={onClose}>
            <button
              type="button"
              disabled={!isReady || isBusy}
              onClick={() => onApprove(hasSeenRed)}
              className={PRIMARY}
              aria-label="Duyệt tháng"
            >
              <CheckCircle2 className="size-4" />
              {isBusy ? 'Đang duyệt…' : 'Duyệt'}
            </button>
          </Footer>
        </>
      )}
    </Shell>
  );
}

/** Mở lại (L-M03): the approved copy it leaves behind, what happens next, a required reason. */
export function ReopenDialog({
  open,
  month,
  isBusy,
  error,
  onClose,
  onReopen,
}: ActionDialogProps & { onReopen: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const a = month.approval;
  return (
    <Shell open={open} title={`Mở lại ${monthName(month)}`} onClose={onClose}>
      {(cancel) => (
        <>
          <Facts>
            <Fact label="Bản đang giữ">
              {a ? `Bản duyệt lần ${a.no} · ${timeAndDay(a.at)} · bởi ${a.by}` : 'Bản duyệt'}
            </Fact>
            <Fact label="Tổng thực nhận">{dong(month.totals.netPay)}</Fact>
          </Facts>
          <p className="m-0 text-sm text-slate-600">
            {`Sau khi mở: về Nháp, tính lại theo cấu hình của ${monthName(month)}; bản lần ${a?.no ?? 1} vẫn giữ trong Nhật ký.`}
          </p>
          <Field label="Lý do mở lại" isRequired>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="vd: Sửa KPI của NV J"
              aria-required="true"
            />
          </Field>
          <Failure error={error} />
          <Footer cancel={cancel} onCancel={onClose}>
            <button
              type="button"
              disabled={!reason.trim() || isBusy}
              onClick={() => onReopen(reason.trim())}
              className={PRIMARY}
              aria-label="Mở lại tháng"
            >
              <LockOpen className="size-4" />
              {isBusy ? 'Đang mở…' : 'Mở lại'}
            </button>
          </Footer>
        </>
      )}
    </Shell>
  );
}

/** Đã chuyển khoản (L-M05): the day starts on the pay date; from then on the month cannot be reopened. */
export function PaidDialog({
  open,
  month,
  isBusy,
  error,
  onClose,
  onMarkPaid,
}: ActionDialogProps & { onMarkPaid: (input: { paidOn: string; note?: string }) => void }) {
  const [paidOn, setPaidOn] = useState(month.payDate);
  const [note, setNote] = useState('');
  const send = () => onMarkPaid(note.trim() ? { paidOn, note: note.trim() } : { paidOn });
  return (
    <Shell open={open} title={`Đã chuyển khoản ${monthName(month)}`} onClose={onClose}>
      {(cancel) => (
        <>
          <Facts>
            <Fact label="Số người">{month.lines.length}</Fact>
            <Fact label={`Tổng thực nhận bản lần ${month.approval?.no ?? 1}`}>{dong(month.totals.netPay)}</Fact>
            <Fact label="Ngày chi trả">{fullDay(month.payDate)}</Fact>
          </Facts>
          <DateField label="Ngày chuyển khoản" value={paidOn} onChange={setPaidOn} />
          <Field label="Ghi chú">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd: Chuyển qua Vietcombank" />
          </Field>
          <p className="m-0 text-sm text-amber-800">Đánh dấu rồi thì không Mở lại được, chỉ truy lĩnh / truy thu.</p>
          <Failure error={error} />
          <Footer cancel={cancel} onCancel={onClose}>
            <button type="button" disabled={!paidOn || isBusy} onClick={send} className={PRIMARY}>
              <Banknote className="size-4" />
              {isBusy ? 'Đang lưu…' : 'Đánh dấu đã chuyển khoản'}
            </button>
          </Footer>
        </>
      )}
    </Shell>
  );
}
