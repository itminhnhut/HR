import { Building2, Filter, Layers, Search, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';
import { MultiFilter } from '../../timesheet/toolbar';
import { PeriodControl } from '../PeriodControl';
import { profileFiltersOn, type ProfileFilters, type ProfileRow, type ProfileStatus } from './profileModel';

/** The Lương filter bar on Hồ sơ lương (spec 4.1, 11.5): period, search, status, department, block, "Thiếu hồ sơ". */

const STATUSES: { value: ProfileStatus; label: string }[] = [
  { value: 'working', label: 'Đang làm' },
  { value: 'left', label: 'Đã nghỉ' },
  { value: 'all', label: 'Tất cả' },
];
const BLOCK_LABEL: Record<string, string> = { BO: 'BO · Văn phòng', KD: 'KD · Kinh doanh' };
const unique = (values: readonly string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

export interface ProfileFilterBarProps {
  period: { year: number; month: number };
  rows: readonly ProfileRow[];
  filters: ProfileFilters;
  shown: number;
  onPeriod: (year: number, month: number) => void;
  onChange: (patch: Partial<ProfileFilters>) => void;
  onClear: () => void;
}

export function ProfileFilterBar(p: ProfileFilterBarProps) {
  const [isOpenOnPhone, setIsOpenOnPhone] = useState(false);
  const count = profileFiltersOn(p.filters);
  const depts = unique(p.rows.map((r) => r.department)).map((d) => ({ value: d, label: d }));
  const blocks = unique(p.rows.map((r) => r.block ?? '')).map((b) => ({ value: b, label: BLOCK_LABEL[b] ?? b }));
  const missing = p.filters.onlyMissing;
  return (
    <section aria-label="Lọc" className="ts-card flex flex-wrap items-center gap-2 px-3 py-1.5">
      <PeriodControl year={p.period.year} month={p.period.month} onPeriod={p.onPeriod} />
      <button
        type="button"
        aria-expanded={isOpenOnPhone}
        onClick={() => setIsOpenOnPhone((v) => !v)}
        className="ts-field ml-auto inline-flex items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium md:hidden"
      >
        <Filter className="size-4 text-slate-500" />
        Lọc{count > 0 ? ` (${count})` : ''}
      </button>
      <div className={`flex flex-wrap items-center gap-2 max-md:w-full ${isOpenOnPhone ? '' : 'max-md:hidden'}`}>
        <span className="relative max-md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Tìm nhân viên"
            value={p.filters.query}
            onChange={(e) => p.onChange({ query: e.target.value })}
            placeholder="Tìm tên, mã NV"
            className="w-48 bg-white pl-8 max-md:w-full"
          />
        </span>
        <select
          aria-label="Trạng thái"
          value={p.filters.status}
          onChange={(e) => p.onChange({ status: STATUSES.find((s) => s.value === e.target.value)?.value ?? 'working' })}
          className="ts-field rounded-md border bg-white px-2 text-sm max-md:flex-1"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <MultiFilter
          label="Bộ phận"
          icon={Building2}
          items={depts}
          picked={p.filters.depts}
          onChange={(v) => p.onChange({ depts: v })}
        />
        <MultiFilter
          label="Khối"
          icon={Layers}
          items={blocks}
          picked={p.filters.blocks}
          onChange={(v) => p.onChange({ blocks: v })}
        />
        <button
          type="button"
          aria-pressed={missing}
          onClick={() => p.onChange({ onlyMissing: !missing })}
          className={`ts-field inline-flex items-center gap-1.5 rounded-md border px-3 text-sm font-medium whitespace-nowrap ${missing ? 'border-red-300 bg-red-50 text-red-700' : 'bg-white hover:bg-slate-50'}`}
        >
          <UserX className="size-4" />
          Thiếu hồ sơ
        </button>
        {count > 0 && (
          <>
            <button
              type="button"
              onClick={p.onClear}
              className="ts-field inline-flex items-center gap-1.5 rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <X className="size-4" />
              Xoá lọc
            </button>
            <span className="text-sm whitespace-nowrap text-slate-500">{`Đang xem ${p.shown}/${p.rows.length} người`}</span>
          </>
        )}
      </div>
    </section>
  );
}
