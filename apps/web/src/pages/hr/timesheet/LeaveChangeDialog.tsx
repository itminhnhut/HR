import type { TimesheetRowDto } from '@careers/shared';
import { Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../parts';
import { ConfirmDialog, Field } from './dialogs';

const words = (n: number) => String(n).replace('.', ',');

/** Days added to or taken off a balance by hand: for 5 years of service, a wrong starting figure, leave paid out. */
export function LeaveChangeDialog({ row, onClose, onAdd, onRemove, isBusy, error }: {
  row: TimesheetRowDto | null;
  onClose: () => void;
  onAdd: (input: { amount: number; reason: string }) => void;
  onRemove: (id: string) => void;
  isBusy: boolean;
  error: unknown;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const value = Number(amount.replace(',', '.'));
  const isAmountOk = Number.isFinite(value) && value !== 0 && Number.isInteger(value * 2);
  const errors = error instanceof ApiError ? error.fieldErrors : {};
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Điều chỉnh phép: {row?.fullName}</DialogTitle></DialogHeader>
        {row && row.leaveChanges.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {row.leaveChanges.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                <span className="font-semibold text-amber-700 tabular-nums">{words(c.amount)}</span>
                <span className="min-w-0 flex-1">{c.reason} · {c.createdBy}</span>
                <button type="button" aria-label={`Bỏ điều chỉnh ${c.reason}`} disabled={isBusy} onClick={() => setRemoving(c.id)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
          <Field label="Số ngày (+ cộng, − trừ)" error={errors.amount ?? (amount.trim() && !isAmountOk ? 'Nhập bội số của 0,5' : undefined)}>
            <Input aria-label="Số ngày phép" value={amount} placeholder="1" onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Lý do" error={errors.reason}>
            <Input aria-label="Lý do điều chỉnh phép" value={reason} placeholder="vd: Đủ 5 năm làm việc" onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        {!!error && Object.keys(errors).length === 0 && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className="ts-field rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50">Đóng</button>
          <button
            type="button"
            disabled={!isAmountOk || !reason.trim() || isBusy}
            onClick={() => {
              onAdd({ amount: value, reason: reason.trim() });
              setAmount('');
              setReason('');
            }}
            className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            <Check className="size-4" />
            Lưu
          </button>
        </DialogFooter>
        <ConfirmDialog
          open={!!removing}
          title="Bỏ điều chỉnh phép này?"
          confirmLabel="Bỏ"
          isBusy={isBusy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            if (removing) onRemove(removing);
            setRemoving(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
