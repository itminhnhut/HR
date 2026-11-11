import { CheckCircle2 } from 'lucide-react';

/**
 * "Đã kiểm tra, ngày này đúng" under Ngày vào, Ngày chính thức and Ngày nghỉ việc (spec-luong.md 4.20): payroll splits
 * probation and official pay and counts insurance on these dates, and warns in red until HR has confirmed each one.
 */

export const DATE_FLAGS = { joinedOn: 'joinedOnConfirmed', officialOn: 'officialOnConfirmed', leftOn: 'leftOnConfirmed' } as const;
export type DateKey = keyof typeof DATE_FLAGS;
export type DateConfirms = Record<DateKey, string> & Record<(typeof DATE_FLAGS)[DateKey], boolean>;

/** What the save sends: a tick counts only on a date that is filled in. */
export const confirmsToSave = (form: DateConfirms) => ({
  joinedOnConfirmed: !!form.joinedOn && form.joinedOnConfirmed,
  officialOnConfirmed: !!form.officialOn && form.officialOnConfirmed,
  leftOnConfirmed: !!form.leftOn && form.leftOnConfirmed,
});

export function DateConfirm({ label, date, isConfirmed, onChange }: { label: string; date: string; isConfirmed: boolean; onChange: (next: boolean) => void }) {
  if (!date) return null;
  return (
    <label className="flex min-h-8 items-center gap-2 text-xs font-normal text-slate-700 max-sm:min-h-11">
      <input type="checkbox" aria-label={`Đã kiểm tra, ngày này đúng: ${label}`} checked={isConfirmed} onChange={(e) => onChange(e.target.checked)} className="shrink-0" />
      Đã kiểm tra, ngày này đúng
      {isConfirmed && <span className="inline-flex items-center gap-1 font-medium text-green-700"><CheckCircle2 className="size-3.5" />Đã xác nhận</span>}
    </label>
  );
}
