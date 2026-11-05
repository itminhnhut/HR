import type { TimesheetLogDto, TimesheetRowDto } from '@careers/shared';
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, History, Lock, LockOpen, SlidersHorizontal, Sun, Trash2, Wallet, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../parts';
import type { TimesheetProblem } from './timesheetModel';
import { useTimesheetLog } from './queries';

const ICON: Record<TimesheetProblem['kind'], [LucideIcon, string]> = {
  saturday: [CalendarDays, 'text-amber-600'],
  leave: [Sun, 'text-sky-600'],
  left: [Wallet, 'text-orange-600'],
  adjustment: [SlidersHorizontal, 'text-red-600'],
};

const OUTLINE = 'h-9 rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50';

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </label>
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
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Rà soát trước khi chốt kỳ</DialogTitle></DialogHeader>
        {problems.length === 0 ? (
          <p className="m-0 flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="size-4" />Không có gì cần xem.</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
            {(['Cần xử lý', 'Cần xem'] as const).map((group) => {
              const items = problems.filter((p) => p.group === group);
              if (items.length === 0) return null;
              return (
                <section key={group} aria-label={group} className="flex flex-col">
                  <h3 className="m-0 mb-1 text-xs font-semibold text-slate-500">{group} ({items.length})</h3>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {items.map((p) => {
                      const [Mark, tone] = ICON[p.kind];
                      return (
                        <li key={p.id} className="border-b last:border-b-0">
                          <button type="button" onClick={() => onJump(p)} className="flex min-h-10 w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                            <Mark className={`size-4 shrink-0 ${tone}`} />
                            <span className="flex-1">{p.text}</span>
                            <ArrowRight className="size-4 shrink-0 text-blue-600" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
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
          <button type="button" onClick={onClose} className={OUTLINE}>Để sau</button>
          <button type="button" disabled={isBusy || !!closableFrom} onClick={onLock} className="inline-flex h-9 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50">
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
          <button type="button" disabled={!reason.trim() || isBusy} onClick={() => onReopen(reason.trim())} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">
            <LockOpen className="size-4" />
            Mở lại
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isRecurring, setIsRecurring] = useState(true);
  const value = Number(amount.replace(',', '.'));
  const isAmountOk = Number.isFinite(value) && value !== 0 && Number.isInteger(value * 2);
  const isValid = isAmountOk && !!reason.trim();
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Điều chỉnh công: {row?.fullName}</DialogTitle></DialogHeader>
        {row && row.adjustments.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {row.adjustments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                <span className="font-semibold text-red-600 tabular-nums">{String(a.amount).replace('.', ',')}</span>
                <span className="min-w-0 flex-1">{a.reason} · {a.isRecurring ? 'Mỗi kỳ' : 'Chỉ kỳ này'} · {a.createdBy}</span>
                <button type="button" aria-label={`Bỏ điều chỉnh ${a.reason}`} disabled={isBusy} onClick={() => onRemove(a.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Số công (+ cộng, − trừ)" error={amount.trim() && !isAmountOk ? 'Nhập bội số của 0,5, như -0,5 hoặc 1' : undefined}>
            <Input aria-label="Số công" value={amount} placeholder="-0,5" onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0 text-sm font-medium">
            <legend className="mb-1.5 p-0">Áp dụng</legend>
            <div className="flex gap-1">
              {([[true, 'Mỗi kỳ'], [false, 'Chỉ kỳ này']] as const).map(([v, label]) => (
                <button key={label} type="button" aria-pressed={isRecurring === v} onClick={() => setIsRecurring(v)} className={`h-9 flex-1 rounded-md border px-2 text-sm font-medium whitespace-nowrap ${isRecurring === v ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}>{label}</button>
              ))}
            </div>
          </fieldset>
        </div>
        <Field label="Lý do">
          <Input aria-label="Lý do" value={reason} placeholder="vd: Sáng thứ 6 vào lúc 9:30" onChange={(e) => setReason(e.target.value)} />
        </Field>
        {!!error && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className={OUTLINE}>Đóng</button>
          <button
            type="button"
            disabled={!isValid || isBusy}
            onClick={() => {
              onAdd({ amount: value, reason: reason.trim(), isRecurring });
              setAmount('');
              setReason('');
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
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
        <ol className="m-0 flex max-h-96 list-none flex-col overflow-y-auto p-0 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-col gap-0.5 border-b py-2 last:border-b-0">
              <span className="font-medium">{line.action}</span>
              <span className="text-slate-700">{line.detail}</span>
              <span className="text-xs text-slate-500">{line.actor} · {when(line.at)}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
