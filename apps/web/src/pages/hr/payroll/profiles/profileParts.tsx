import { Check, Pencil, Plus, Trash2, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../../../../api';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../../parts';

/** Building blocks of the Hồ sơ lương drawer: a section, a stored row, an entry form and its fields. */

const ICON_BUTTON = 'inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-white max-md:size-11';
export const OUTLINE_BUTTON =
  'ts-field inline-flex items-center justify-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium whitespace-nowrap hover:bg-slate-50';
export const PRIMARY_BUTTON =
  'ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-50';

export function Section(p: {
  id: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
}) {
  const Icon = p.icon;
  return (
    <section id={p.id} aria-labelledby={`${p.id}-t`} className="flex scroll-mt-4 flex-col gap-2 border-b px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${p.id}-t`} className="m-0 flex flex-1 items-center gap-2 text-base font-semibold">
          <Icon className="size-4 text-blue-600" />
          {p.title}
        </h3>
        {p.onAdd && (
          <button type="button" onClick={p.onAdd} className={OUTLINE_BUTTON}>
            <Plus className="size-4 text-blue-600" />
            {p.addLabel ?? 'Thêm'}
          </button>
        )}
      </div>
      {p.hint && <p className="m-0 text-xs text-slate-500">{p.hint}</p>}
      {p.children}
    </section>
  );
}

export function ItemRow(p: {
  text: ReactNode;
  sub?: ReactNode;
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
  extra?: ReactNode;
  /** The row a link from elsewhere points at: marked, and scrolled to. */
  isCurrent?: boolean;
}) {
  return (
    <li
      ref={p.isCurrent ? (el) => el?.scrollIntoView?.({ block: 'center' }) : undefined}
      aria-current={p.isCurrent ? 'true' : undefined}
      className={`flex min-h-12 flex-wrap items-center gap-2 border-b py-1.5 last:border-b-0 ${p.isCurrent ? '-mx-2 rounded-md bg-amber-50 px-2 ring-2 ring-amber-300' : ''}`}
    >
      <span className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-sm font-medium">{p.text}</span>
        {p.sub && <span className="text-xs text-slate-600">{p.sub}</span>}
      </span>
      {p.extra}
      {p.onEdit && (
        <button
          type="button"
          aria-label={`Sửa ${p.label}`}
          onClick={p.onEdit}
          className={`${ICON_BUTTON} hover:bg-slate-50`}
        >
          <Pencil className="size-3.5 text-blue-600" />
        </button>
      )}
      {p.onDelete && (
        <button
          type="button"
          aria-label={`Xoá ${p.label}`}
          onClick={p.onDelete}
          className={`${ICON_BUTTON} hover:bg-red-50`}
        >
          <Trash2 className="size-3.5 text-red-600" />
        </button>
      )}
    </li>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="m-0 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{children}</p>
);

/** Add or edit in place: the fields on a grid, Huỷ and Lưu under them, the API's message when no field owns it. */
export function EntryForm(p: {
  label: string;
  isBusy: boolean;
  error: unknown;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const hasFieldErrors = p.error instanceof ApiError && Object.keys(p.error.fieldErrors).length > 0;
  return (
    <form
      aria-label={p.label}
      onSubmit={(e) => {
        e.preventDefault();
        p.onSave();
      }}
      className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 ring-2 ring-blue-200"
    >
      <div className="grid gap-3 sm:grid-cols-2">{p.children}</div>
      {!!p.error && !hasFieldErrors && (
        <p role="alert" className="m-0 text-sm text-red-600">
          {errorMessage(p.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={p.onCancel} className={OUTLINE_BUTTON}>
          <X className="size-4" />
          Huỷ
        </button>
        <button type="submit" disabled={p.isBusy} className={PRIMARY_BUTTON}>
          <Check className="size-4" />
          Lưu
        </button>
      </div>
    </form>
  );
}

/** "Tự điền": known elsewhere, filled for HR. "HR nhập": only HR knows it. */
export function SourceTag({ source }: { source: 'auto' | 'manual' }) {
  return source === 'auto' ? (
    <span className="rounded bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600">Tự điền</span>
  ) : (
    <span className="rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800">HR nhập</span>
  );
}

export function ProfileField(p: {
  label: string;
  error?: string;
  source?: 'auto' | 'manual';
  hint?: string | null;
  isWide?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      data-invalid={p.error ? '' : undefined}
      className={`flex min-w-0 flex-col gap-1.5 text-sm font-medium ${p.isWide ? 'sm:col-span-2' : ''}`}
    >
      <span className="flex items-center gap-1.5">
        {p.label}
        {p.source && <SourceTag source={p.source} />}
      </span>
      {p.children}
      {p.hint && <span className="text-xs font-normal text-slate-600">{p.hint}</span>}
      {p.error && <span className="text-xs font-normal text-red-600">{p.error}</span>}
    </label>
  );
}

const DONG = new Intl.NumberFormat('vi-VN');
export const money = (value: number) => DONG.format(value);

/** Whole dong with dots as they are typed: 1.100.000. */
export function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      value={value ? money(value) : ''}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      className="bg-white text-right tabular-nums"
    />
  );
}

export function MonthInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Input
      type="month"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white"
    />
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  step?: number;
}) {
  return (
    <Input
      type="number"
      aria-label={label}
      min={0}
      step={step}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="bg-white tabular-nums"
    />
  );
}
