import type { EmployeeDto, StaffKindDto, TimesheetRegionDto } from '@careers/shared';
import { FilterX, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { filtersOn, START_FILTERS, type PeopleFilters, type WorkStatus } from './peopleFilters';

const SELECT = 'ts-field h-9 min-w-0 rounded-md border bg-white pl-3 text-sm font-normal';
const STATUSES: { value: WorkStatus; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'working', label: 'Đang làm' },
  { value: 'left', label: 'Đã nghỉ' },
];

function Pick({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      {label}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
        {children}
      </select>
    </label>
  );
}

/** Name, employee code or title, tones ignored; it sits in the header, as on the leave list. */
export function PeopleSearch({ value, onChange }: { value: string; onChange: (query: string) => void }) {
  return (
    <span className="relative ml-auto max-md:order-last max-md:ml-0 max-md:w-full">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
      <Input type="search" aria-label="Tìm nhân viên" value={value} placeholder="Tìm tên, mã NV, chức danh" onChange={(e) => onChange(e.target.value)} className="w-64 bg-white pl-8 max-md:w-full" />
    </span>
  );
}

const departmentsOf = (people: readonly EmployeeDto[]) =>
  [...new Set(people.map((p) => p.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

/** Region, department, kind and whether they still work here: how HR narrows the staff list. */
export function PeopleFilterBar({ people, regions, kinds, filters, shown, onChange }: {
  /** Everyone: the departments that can be picked. */
  people: readonly EmployeeDto[];
  regions: readonly TimesheetRegionDto[];
  kinds: readonly StaffKindDto[];
  filters: PeopleFilters;
  shown: number;
  onChange: (next: PeopleFilters) => void;
}) {
  const set = (patch: Partial<PeopleFilters>) => onChange({ ...filters, ...patch });
  const count = filtersOn(filters);
  return (
    <div role="group" aria-label="Lọc danh sách nhân viên" className="grid grid-cols-2 items-end gap-3 rounded-lg border bg-slate-50 p-3 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <Pick label="Khu vực" value={filters.regionId} onChange={(regionId) => set({ regionId })}>
        <option value="">Tất cả</option>
        {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </Pick>
      <Pick label="Bộ phận" value={filters.department} onChange={(department) => set({ department })}>
        <option value="">Tất cả</option>
        {departmentsOf(people).map((d) => <option key={d} value={d}>{d}</option>)}
      </Pick>
      <Pick label="Loại NV" value={filters.staffKindId} onChange={(staffKindId) => set({ staffKindId })}>
        <option value="">Tất cả</option>
        {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
      </Pick>
      <Pick label="Trạng thái" value={filters.status} onChange={(v) => set({ status: STATUSES.find((s) => s.value === v)?.value ?? 'all' })}>
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </Pick>
      <div className="col-span-full flex items-center gap-3 xl:col-span-1 xl:justify-end">
        <span className="text-sm text-slate-600 xl:hidden">{shown} người</span>
        <button type="button" disabled={count === 0} onClick={() => onChange(START_FILTERS)} className="ts-field ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium whitespace-nowrap hover:bg-slate-100 disabled:opacity-50 xl:ml-0">
          <FilterX className="size-4 text-slate-500" />Xoá lọc{count > 0 ? ` (${count})` : ''}
        </button>
      </div>
    </div>
  );
}
