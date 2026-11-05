import type { TimesheetLogDto, TimesheetRowDto } from '@careers/shared';
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, Flag, History, Lock, LockOpen, Plane, ShieldCheck, SlidersHorizontal, Sun, Trash2, UserX, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../parts';
import type { TimesheetProblem } from './timesheetModel';
import { useTimesheetLog } from './queries';

type ProblemKind = TimesheetProblem['kind'];

const KINDS: { kind: ProblemKind; label: string; icon: LucideIcon; tone: string }[] = [
  { kind: 'saturday', label: 'Thiếu thứ Bảy, không đủ định mức', icon: CalendarDays, tone: 'text-amber-600' },
  { kind: 'leave', label: 'Vượt phép, phần vượt không trả lương', icon: Plane, tone: 'text-sky-600' },
  { kind: 'left', label: 'Nghỉ việc, còn phép cần thanh toán', icon: UserX, tone: 'text-orange-600' },
  { kind: 'adjustment', label: 'Có điều chỉnh công', icon: SlidersHorizontal, tone: 'text-red-600' },
  { kind: 'missingHoliday', label: 'Chưa nhập ngày lễ', icon: Flag, tone: 'text-red-600' },
  { kind: 'holidayWork', label: 'Đi làm ngày lễ', icon: Flag, tone: 'text-teal-600' },
  { kind: 'sundayWork', label: 'Làm Chủ nhật', icon: Sun, tone: 'text-amber-600' },
  { kind: 'holidayOvertime', label: 'OT có thể chỉ do ngày lễ', icon: Flag, tone: 'text-blue-600' },
  { kind: 'becameOfficial', label: 'Lên chính thức trong kỳ', icon: ShieldCheck, tone: 'text-green-600' },
];

/** The group title already says what is wrong: the line only needs who and how much. */
export function shortProblem(problem: TimesheetProblem): string {
  if (problem.kind === 'saturday') return problem.text.split(', không còn')[0] ?? problem.text;
  if (problem.kind === 'leave') return problem.text.split(', phần vượt')[0] ?? problem.text;
  if (problem.kind === 'left') return problem.text.replace(' cần thanh toán', '');
  return problem.text;
}

const OUTLINE = 'ts-field rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50';
const PRIMARY = 'ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50';

export function Field({ label, error, isRequired = false, children }: { label: string; error?: string; isRequired?: boolean; children: React.ReactNode }) {
  return (
    <label data-invalid={error ? '' : undefined} className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}{isRequired && <span aria-hidden="true" className="text-red-600"> *</span>}</span>
      {children}
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}

/** Asks before something is deleted. The safe answer holds the focus, so a stray Enter cancels. */
export function ConfirmDialog({ open, title, confirmLabel = 'Xoá', isBusy = false, onCancel, onConfirm }: { open: boolean; title: string; confirmLabel?: string; isBusy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent initialFocus={cancel} className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogFooter>
          <button ref={cancel} type="button" onClick={onCancel} className={OUTLINE}>Huỷ</button>
          <button type="button" disabled={isBusy} onClick={onConfirm} className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50"><Trash2 className="size-4" />{confirmLabel}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProblemGroup({ problems, kind, onJump }: { problems: readonly TimesheetProblem[]; kind: (typeof KINDS)[number]; onJump: (p: TimesheetProblem) => void }) {
  const items = problems.filter((p) => p.kind === kind.kind);
  if (items.length === 0) return null;
  const Mark = kind.icon;
  return (
    <section aria-label={kind.label} className="flex flex-col">
      <h3 className="sticky top-0 m-0 flex items-center gap-1.5 bg-white py-1 text-xs font-semibold text-slate-600"><Mark className={`size-4 shrink-0 ${kind.tone}`} />{kind.label} ({items.length})</h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((p) => (
          <li key={p.id} className="border-b last:border-b-0">
            <button type="button" onClick={() => onJump(p)} className="flex min-h-9 w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-slate-50">
              <span className="flex-1">{shortProblem(p)}</span>
              <ArrowRight className="size-4 shrink-0 text-blue-600" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProblemList({ problems, onJump }: { problems: readonly TimesheetProblem[]; onJump: (p: TimesheetProblem) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const measure = () => {
    const el = box.current;
    if (el) setHasMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  };
  useEffect(measure, [problems]);
  const must = problems.filter((p) => p.group === 'Cần xử lý').length;
  return (
    <>
      <p className="m-0 text-sm font-medium text-slate-700">Cần xử lý: {must} · Cần xem: {problems.length - must}</p>
      <div className="relative">
        <div ref={box} onScroll={measure} className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {KINDS.map((kind) => <ProblemGroup key={kind.kind} problems={problems} kind={kind} onJump={onJump} />)}
        </div>
        {hasMore && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-white to-transparent" />}
      </div>
    </>
  );
}

export function ReviewDialog({ open, onClose, problems, onJump, onLock, isBusy, error, closableFrom }: {
  open: boolean;
  /** The period's last day while it is still running: days after today have no attendance yet. */
  closableFrom: string | null;
  onClose: () => void;
  problems: readonly TimesheetProblem[];
  onJump: (p: TimesheetProblem) => void;
  onLock: () => void;
  isBusy: boolean;
  error: unknown;
}) {
  const later = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent initialFocus={later} className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Rà soát trước khi chốt kỳ</DialogTitle></DialogHeader>
        {problems.length === 0
          ? <p className="m-0 flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="size-4" />Không có gì cần xem.</p>
          : <ProblemList problems={problems} onJump={onJump} />}
        {closableFrom ? (
          <p data-testid="close-wait" className="m-0 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <CalendarDays className="mt-0.5 size-4 shrink-0" />
            Kỳ chưa hết. Chốt được từ {closableFrom}.
          </p>
        ) : (
          <p className="m-0 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Máy tự chấm T2–T6. Kiểm tra đã điền hết người nghỉ trước khi chốt.
          </p>
        )}
        {!!error && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
        <DialogFooter>
          <button ref={later} type="button" onClick={onClose} className={OUTLINE}>Để sau</button>
          <button type="button" disabled={isBusy || !!closableFrom} onClick={onLock} className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50">
            <Lock className="size-4" />
            {isBusy ? 'Đang chốt…' : 'Chốt kỳ'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReopenDialog({ open, onClose, onReopen, isBusy, error }: { open: boolean; onClose: () => void; onReopen: (reason: string) => void; isBusy: boolean; error: unknown }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mở lại kỳ đã chốt</DialogTitle></DialogHeader>
        <Field label="Lý do mở lại">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="vd: Sửa sai công ngày 03/11" />
        </Field>
        {!!error && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className={OUTLINE}>Huỷ</button>
          <button type="button" disabled={!reason.trim() || isBusy} onClick={() => onReopen(reason.trim())} className={PRIMARY}>
            <LockOpen className="size-4" />
            Mở lại
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentList({ row, isBusy, onRemove }: { row: TimesheetRowDto; isBusy: boolean; onRemove: (id: string) => void }) {
  const [askingId, setAskingId] = useState<string | null>(null);
  const asking = row.adjustments.find((a) => a.id === askingId);
  if (row.adjustments.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
      {row.adjustments.map((a) => (
        <li key={a.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
          <span className="font-semibold text-red-600 tabular-nums">{a.amount > 0 ? '+' : ''}{String(a.amount).replace('.', ',')}</span>
          <span className="min-w-0 flex-1">{a.reason} · {a.isRecurring ? 'Mỗi kỳ' : 'Chỉ kỳ này'} · {a.createdBy}</span>
          <button type="button" aria-label={`Bỏ điều chỉnh ${a.reason}`} disabled={isBusy} onClick={() => setAskingId(a.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
        </li>
      ))}
      <ConfirmDialog
        open={!!asking}
        title="Bỏ điều chỉnh này?"
        confirmLabel="Bỏ điều chỉnh"
        isBusy={isBusy}
        onCancel={() => setAskingId(null)}
        onConfirm={() => {
          if (asking) onRemove(asking.id);
          setAskingId(null);
        }}
      />
    </ul>
  );
}

function RecurringChoice({ isRecurring, onChange }: { isRecurring: boolean; onChange: (next: boolean) => void }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0 text-sm font-medium">
      <legend className="mb-1.5 p-0">Áp dụng</legend>
      <div className="flex gap-1">
        {([[true, 'Mỗi kỳ'], [false, 'Chỉ kỳ này']] as const).map(([v, label]) => (
          <button key={label} type="button" aria-pressed={isRecurring === v} onClick={() => onChange(v)} className={`ts-field flex-1 rounded-md border px-2 text-sm font-medium whitespace-nowrap ${isRecurring === v ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function AdjustDialog({ row, onClose, onAdd, onRemove, isBusy, error }: {
  row: TimesheetRowDto | null;
  onClose: () => void;
  onAdd: (input: { amount: number; reason: string; isRecurring: boolean }) => void;
  onRemove: (adjustmentId: string) => void;
  isBusy: boolean;
  error: unknown;
}) {
  const amountBox = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const value = Number(amount.replace(',', '.'));
  const isAmountOk = Number.isFinite(value) && value !== 0 && Number.isInteger(value * 2);
  const submit = () => {
    onAdd({ amount: value, reason: reason.trim(), isRecurring });
    setAmount('');
    setReason('');
  };
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent initialFocus={amountBox} className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Điều chỉnh công: {row?.fullName}</DialogTitle></DialogHeader>
        {row && <AdjustmentList row={row} isBusy={isBusy} onRemove={onRemove} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số công (+ cộng, − trừ)" error={amount.trim() && !isAmountOk ? 'Nhập bội số của 0,5, như -0,5 hoặc 1' : undefined}>
            <Input ref={amountBox} aria-label="Số công" value={amount} placeholder="-0,5" onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <RecurringChoice isRecurring={isRecurring} onChange={setIsRecurring} />
        </div>
        <Field label="Lý do">
          <Input aria-label="Lý do" value={reason} placeholder="vd: Sáng thứ 6 vào lúc 9:30" onChange={(e) => setReason(e.target.value)} />
        </Field>
        {!!error && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className={OUTLINE}>Đóng</button>
          <button type="button" disabled={!isAmountOk || !reason.trim() || isBusy} onClick={submit} className={PRIMARY}>
            <Check className="size-4" />
            Lưu
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const WHEN = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false });
const when = (iso: string) => {
  const part = Object.fromEntries(WHEN.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${part.day}/${part.month} ${part.hour}:${part.minute}`;
};

export function LogDialog({ periodId, open, onClose }: { periodId: string | null; open: boolean; onClose: () => void }) {
  const log = useTimesheetLog(periodId, open);
  const lines: TimesheetLogDto[] = log.data ?? [];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="size-5 text-blue-600" />Nhật ký kỳ công</DialogTitle></DialogHeader>
        {log.isPending && <p className="m-0 text-sm text-slate-500">Đang tải…</p>}
        {log.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(log.error)}</p>}
        {!log.isPending && !log.isError && lines.length === 0 && <p className="m-0 text-sm text-slate-500">Chưa có thay đổi nào.</p>}
        {lines.length > 0 && (
          <ol className="m-0 flex max-h-96 list-none flex-col overflow-y-auto p-0 text-sm">
            {lines.map((line) => (
              <li key={line.id} className="flex flex-col gap-0.5 border-b py-2 last:border-b-0">
                <span className="font-medium">{line.action}</span>
                <span className="text-slate-700">{line.detail}</span>
                <span className="text-xs text-slate-500">{line.actor} · {when(line.at)}</span>
              </li>
            ))}
          </ol>
        )}
        <DialogFooter>
          <button type="button" onClick={onClose} className={OUTLINE}>Đóng</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
