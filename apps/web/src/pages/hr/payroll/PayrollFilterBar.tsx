import { Building2, Filter, Layers, MapPin, Search, ShieldCheck, User, X } from 'lucide-react';
import { useState } from 'react';
import type { PayrollMonthDto } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { RegionBadge } from '../timesheet/columns';
import { MultiFilter } from '../timesheet/toolbar';
import { PeriodControl } from './PeriodControl';
import { FILTER_PARAMS, isFiltered, type PayrollFilters } from './payrollModel';

/** One filter bar for every Lương tab (spec 4.1): period, person, department, region, contract type, block, search. */

type ListKey = keyof typeof FILTER_PARAMS;

export interface PayrollFilterBarProps {
  period: { year: number; month: number };
  month: PayrollMonthDto | undefined;
  filters: PayrollFilters;
  shown: number | null;
  onPeriod: (year: number, month: number) => void;
  onList: (key: ListKey, values: string[]) => void;
  onQuery: (query: string) => void;
  onClear: () => void;
}

const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function choicesOf(month: PayrollMonthDto | undefined) {
  const lines = month?.lines ?? [];
  return {
    people: lines.map((l) => ({ value: l.employeeId, label: `${l.fullName} · ${l.code}` })),
    depts: unique(lines.map((l) => l.department)).map((d) => ({ value: d, label: d })),
    regions: (month?.regions ?? []).map((r) => ({ value: r.id, label: r.name })),
    contracts: (month?.contractTypes ?? []).map((t) => ({ value: t.id, label: t.name })),
    blocks: unique(lines.map((l) => l.block ?? '')).map((b) => ({ value: b, label: b === 'BO' ? 'BO · Văn phòng' : b === 'KD' ? 'KD · Kinh doanh' : b })),
  };
}

const activeCount = (f: PayrollFilters) =>
  [f.people, f.depts, f.regions, f.contracts, f.blocks].filter((l) => l.length > 0).length + (f.query.trim() ? 1 : 0) + (f.only ? 1 : 0);

function Lists({ month, filters, onList }: Pick<PayrollFilterBarProps, 'month' | 'filters' | 'onList'>) {
  const choices = choicesOf(month);
  const regions = month?.regions ?? [];
  return (
    <>
      <MultiFilter label="Nhân viên" icon={User} items={choices.people} picked={filters.people} onChange={(v) => onList('people', v)} isSearchable />
      <MultiFilter label="Bộ phận" icon={Building2} items={choices.depts} picked={filters.depts} onChange={(v) => onList('depts', v)} />
      <MultiFilter label="Khu vực" icon={MapPin} items={choices.regions} picked={filters.regions} onChange={(v) => onList('regions', v)} mark={(id) => <RegionBadge regionId={id} regions={regions} />} />
      <MultiFilter label="Loại HĐ" icon={ShieldCheck} items={choices.contracts} picked={filters.contracts} onChange={(v) => onList('contracts', v)} />
      <MultiFilter label="Khối" icon={Layers} items={choices.blocks} picked={filters.blocks} onChange={(v) => onList('blocks', v)} />
    </>
  );
}

export function PayrollFilterBar(p: PayrollFilterBarProps) {
  const [isOpenOnPhone, setIsOpenOnPhone] = useState(false);
  const total = p.month?.lines.length ?? 0;
  const count = activeCount(p.filters);
  return (
    <section aria-label="Lọc" className="ts-card flex flex-wrap items-center gap-2 px-3 py-1.5">
      <PeriodControl year={p.period.year} month={p.period.month} onPeriod={p.onPeriod} />
      <button type="button" aria-expanded={isOpenOnPhone} onClick={() => setIsOpenOnPhone((v) => !v)} className="ts-field ml-auto inline-flex items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium md:hidden">
        <Filter className="size-4 text-slate-500" />
        Lọc{count > 0 ? ` (${count})` : ''}
      </button>
      <div className={`flex flex-wrap items-center gap-2 max-md:w-full ${isOpenOnPhone ? '' : 'max-md:hidden'}`}>
        <span className="relative max-md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Tìm nhân viên" value={p.filters.query} onChange={(e) => p.onQuery(e.target.value)} placeholder="Tìm tên, mã NV" className="w-48 bg-white pl-8 max-md:w-full" />
        </span>
        <Lists month={p.month} filters={p.filters} onList={p.onList} />
        {isFiltered(p.filters) && (
          <>
            <button type="button" onClick={p.onClear} className="ts-field inline-flex items-center gap-1.5 rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              <X className="size-4" />
              Xoá lọc
            </button>
            {p.shown !== null && <span className="text-sm whitespace-nowrap text-slate-500">{`Đang xem ${p.shown}/${total} người`}</span>}
          </>
        )}
      </div>
    </section>
  );
}
