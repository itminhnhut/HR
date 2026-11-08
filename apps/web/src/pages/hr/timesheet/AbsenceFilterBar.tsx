import { ATTENDANCE_LABEL, standardPeriod, type AbsenceRowDto, type AttendanceCode } from '@careers/shared';
import { FilterX } from 'lucide-react';
import { DateField } from './DateField';
import { FILTER_KINDS, filtersOn, type AbsenceFilters, type Approval } from './absenceFilters';

const KINDS: readonly AttendanceCode[] = FILTER_KINDS;
export const SELECT = 'ts-field h-9 min-w-0 rounded-md border bg-white px-2 text-sm font-normal';
const dayMonth = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

export function Pick({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      {label}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
        {children}
      </select>
    </label>
  );
}

/** Period, day, person, kind and approval: what HR looks for in the year's list. */
export function AbsenceFilterBar({ year, rows, filters, start, shown, onChange }: {
  year: number;
  /** What "Xoá lọc" goes back to: the period running today. */
  start: AbsenceFilters;
  /** The whole year's lines: who can be picked. */
  rows: readonly AbsenceRowDto[];
  filters: AbsenceFilters;
  shown: number;
  onChange: (next: AbsenceFilters) => void;
}) {
  const set = (patch: Partial<AbsenceFilters>) => onChange({ ...filters, ...patch });
  const people = [...new Map(rows.map((r) => [r.employeeId, r.fullName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  const count = filtersOn(filters, start);
  return (
    <div role="group" aria-label="Lọc danh sách nghỉ" className="grid grid-cols-2 items-end gap-3 rounded-lg border bg-slate-50 p-3 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      <Pick label="Kỳ công" value={filters.period ? String(filters.period) : ''} onChange={(v) => set({ period: v ? Number(v) : null })}>
        <option value="">Cả năm {year}</option>
        {Array.from({ length: 12 }, (_, i) => {
          const { from, to } = standardPeriod(year, i + 1);
          return <option key={i} value={i + 1}>T{i + 1} ({dayMonth(from)} – {dayMonth(to)})</option>;
        })}
      </Pick>
      <div className="flex min-w-0 items-end gap-1">
        <div className="min-w-0 flex-1"><DateField label="Ngày" value={filters.day} onChange={(day) => set({ day })} /></div>
      </div>
      <Pick label="Nhân viên" value={filters.employeeId} onChange={(employeeId) => set({ employeeId })}>
        <option value="">Tất cả</option>
        {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </Pick>
      <Pick label="Loại" value={filters.kind} onChange={(kind) => set({ kind })}>
        <option value="">Tất cả</option>
        {KINDS.map((k) => <option key={k} value={k}>{ATTENDANCE_LABEL[k]} ({k})</option>)}
      </Pick>
      <Pick label="Duyệt" value={filters.approval} onChange={(approval) => set({ approval: approval as Approval })}>
        <option value="all">Tất cả</option>
        <option value="waiting">Chờ duyệt</option>
        <option value="approved">Đã duyệt</option>
      </Pick>
      <div className="col-span-full flex items-center gap-3 xl:col-span-1 xl:justify-end">
        <span className="text-sm text-slate-600 xl:hidden">{shown} dòng</span>
        <button type="button" disabled={count === 0} onClick={() => onChange(start)} className="ts-field ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium whitespace-nowrap hover:bg-slate-100 disabled:opacity-50 xl:ml-0">
          <FilterX className="size-4 text-slate-500" />Xoá lọc{count > 0 ? ` (${count})` : ''}
        </button>
      </div>
    </div>
  );
}
