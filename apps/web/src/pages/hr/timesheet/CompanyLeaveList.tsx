import { ABSENCE_COUNTING, standardPeriod, type AbsenceBatchDto, type AbsenceKindDto, type EmployeeDto, type TimesheetRegionDto } from '@careers/shared';
import { CheckCircle2, Clock, ListChecks, Pencil, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { audienceWords, filterBatches, type BatchFilters } from './companyLeave';
import { YearNav } from './months';

const SELECT = 'ts-field h-9 min-w-0 rounded-md border bg-white px-2 text-sm font-normal';
const show = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const timeWords = (from: string, to: string) => `${show(from)}${to !== from ? ` – ${show(to)}` : ''}`;

function Pick({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      {label}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>{children}</select>
    </label>
  );
}

function Filters({ year, filters, kinds, regions, departments, onChange }: { year: number; filters: BatchFilters; kinds: readonly AbsenceKindDto[]; regions: readonly TimesheetRegionDto[]; departments: readonly string[]; onChange: (f: BatchFilters) => void }) {
  const set = (patch: Partial<BatchFilters>) => onChange({ ...filters, ...patch });
  return (
    <div role="group" aria-label="Lọc đợt nghỉ" className="grid grid-cols-2 items-end gap-3 rounded-lg border bg-slate-50 p-3 md:grid-cols-4">
      <Pick label="Kỳ công" value={filters.period ? String(filters.period) : ''} onChange={(v) => set({ period: v ? Number(v) : null })}>
        <option value="">Cả năm {year}</option>
        {Array.from({ length: 12 }, (_, i) => {
          const { from, to } = standardPeriod(year, i + 1);
          return <option key={i} value={i + 1}>T{i + 1} ({show(from)} – {show(to)})</option>;
        })}
      </Pick>
      <Pick label="Lý do" value={filters.reason} onChange={(reason) => set({ reason })}>
        <option value="">Tất cả</option>
        {kinds.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
      </Pick>
      <Pick label="Khu vực" value={filters.regionId} onChange={(regionId) => set({ regionId })}>
        <option value="">Tất cả</option>
        {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </Pick>
      <Pick label="Bộ phận" value={filters.department} onChange={(department) => set({ department })}>
        <option value="">Tất cả</option>
        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
      </Pick>
    </div>
  );
}

function Approval({ by }: { by: string | null }) {
  if (by) return <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 shrink-0 text-green-600" />{by}</span>;
  return <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-700"><Clock className="size-3" />Chờ duyệt</span>;
}

function BatchRow({ batch: b, regions, tone, rowRef, onEdit, onRemove }: { batch: AbsenceBatchDto; regions: readonly TimesheetRegionDto[]; tone: string; rowRef?: React.Ref<HTMLTableRowElement>; onEdit: (b: AbsenceBatchDto) => void; onRemove: (b: AbsenceBatchDto) => void }) {
  return (
    <tr ref={rowRef} className={`border-b ${tone}`}>
      <td className="p-2 font-medium tabular-nums">{timeWords(b.from, b.to)}</td>
      <td className="p-2"><span className="font-medium">{b.name}</span><span className="block text-xs text-slate-500">{b.label}{b.note ? ` · ${b.note}` : ''}</span></td>
      <td className="p-2"><span className="inline-flex h-5 items-center rounded-full bg-blue-50 px-2 text-xs font-semibold text-blue-800 tabular-nums">{`${b.employeeIds.length} người`}</span></td>
      <td className="p-2 text-slate-600">{ABSENCE_COUNTING[b.code as keyof typeof ABSENCE_COUNTING] ?? b.code}</td>
      <td className="p-2"><Approval by={b.approvedBy} /></td>
      <td className="p-2 text-slate-600">{audienceWords(b.audience, regions)}</td>
      <td className={`sticky right-0 p-2 text-right ${tone}`}>
        <span className="inline-flex gap-1">
          <button type="button" aria-label={`Sửa ${b.name}`} onClick={() => onEdit(b)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50 max-md:size-11 max-md:justify-center max-md:px-0"><Pencil className="size-3.5 text-blue-600" /><span className="max-md:sr-only">Sửa</span></button>
          <button type="button" aria-label={`Xoá ${b.name}`} onClick={() => onRemove(b)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-red-50 max-md:size-11 max-md:justify-center max-md:px-0"><Trash2 className="size-3.5 text-red-600" /><span className="max-md:sr-only">Xoá</span></button>
        </span>
      </td>
    </tr>
  );
}

/** The company days off of a year, filtered; the one a link points to is picked out. */
export function CompanyLeaveList({ year, batches, filters, kinds, regions, people, editingId, pickedId, onYear, onFilters, onEdit, onRemove }: {
  year: number;
  batches: readonly AbsenceBatchDto[];
  filters: BatchFilters;
  kinds: readonly AbsenceKindDto[];
  regions: readonly TimesheetRegionDto[];
  people: readonly EmployeeDto[];
  editingId: string | null;
  /** From a line of "Nghỉ, đi muộn": ?dot= */
  pickedId: string | null;
  onYear: (year: number) => void;
  onFilters: (f: BatchFilters) => void;
  onEdit: (b: AbsenceBatchDto) => void;
  onRemove: (b: AbsenceBatchDto) => void;
}) {
  const rows = filterBatches(batches, year, filters, people);
  const departments = [...new Set(people.map((p) => p.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const picked = useRef<HTMLTableRowElement>(null);
  useEffect(() => picked.current?.scrollIntoView?.({ block: 'center' }), [pickedId, batches.length]);
  return (
    <section className="ts-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><ListChecks className="size-5 text-blue-600" />Các đợt nghỉ công ty <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-600">{rows.length}</span></h2>
        <div className="w-44"><YearNav year={year} onChange={onYear} /></div>
        <span className="relative ml-auto max-md:ml-0 max-md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Tìm đợt nghỉ" value={filters.query} placeholder="Tìm tên đợt, lý do, ghi chú" onChange={(e) => onFilters({ ...filters, query: e.target.value })} className="w-64 bg-white pl-8 max-md:w-full" />
        </span>
      </div>
      <Filters year={year} filters={filters} kinds={kinds} regions={regions} departments={departments} onChange={onFilters} />
      {rows.length === 0 && <p className="m-0 py-6 text-center text-sm text-slate-500">{batches.length === 0 ? `Năm ${year} chưa có đợt nghỉ công ty.` : 'Không có đợt phù hợp.'}</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm whitespace-nowrap">
            <thead><tr className="border-b text-left">{['Thời gian', 'Tên đợt', 'Số người', 'Cách tính', 'Người duyệt', 'Áp dụng'].map((h) => <th key={h} className="h-10 px-2 font-medium">{h}</th>)}<th aria-label="Thao tác" className="sticky right-0 bg-white" /></tr></thead>
            <tbody>
              {rows.map((b) => <BatchRow key={b.id} batch={b} regions={regions} tone={b.id === editingId ? 'bg-blue-50' : b.id === pickedId ? 'bg-violet-50' : 'bg-white'} rowRef={b.id === pickedId ? picked : undefined} onEdit={onEdit} onRemove={onRemove} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
