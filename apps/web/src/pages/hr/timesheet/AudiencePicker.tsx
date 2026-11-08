import { matchesQuery, type EmployeeDto, type TimesheetRegionDto } from '@careers/shared';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { AUDIENCE_KINDS, type BatchForm } from './companyLeave';

const PILL = 'ts-field inline-flex cursor-pointer items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-800';

function CheckList({ label, items, chosen, onChange }: { label: string; items: { id: string; label: string; hint?: string }[]; chosen: readonly string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string, isOn: boolean) => onChange(isOn ? [...chosen, id] : chosen.filter((c) => c !== id));
  if (items.length === 0) return <p className="m-0 text-sm text-slate-500">Chưa có {label.toLowerCase()} nào.</p>;
  return (
    <div role="group" aria-label={label} className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
      {items.map((item) => (
        <label key={item.id} className={PILL}>
          <input type="checkbox" checked={chosen.includes(item.id)} onChange={(e) => toggle(item.id, e.target.checked)} className="size-4 accent-blue-600" />
          <span>{item.label}</span>
          {item.hint && <span className="text-xs font-normal text-slate-500">{item.hint}</span>}
        </label>
      ))}
    </div>
  );
}

function PeoplePick({ people, chosen, onChange }: { people: readonly EmployeeDto[]; chosen: readonly string[]; onChange: (ids: string[]) => void }) {
  const [typed, setTyped] = useState('');
  const matches = people.filter((p) => matchesQuery(`${p.fullName} ${p.code} ${p.department}`, typed));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Tìm người" value={typed} placeholder="Tìm tên, mã NV, bộ phận" onChange={(e) => setTyped(e.target.value)} className="bg-white pl-8" />
        </span>
        <button type="button" onClick={() => onChange([...new Set([...chosen, ...matches.map((p) => p.id)])])} className="ts-field rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50">Chọn hết{typed ? ' kết quả' : ''}</button>
        <button type="button" disabled={chosen.length === 0} onClick={() => onChange([])} className="ts-field rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Bỏ chọn</button>
      </div>
      <CheckList label="Người" items={matches.map((p) => ({ id: p.id, label: p.fullName, hint: p.code }))} chosen={chosen} onChange={onChange} />
    </div>
  );
}

/** Who a company day off is for: everyone at work, some regions, some departments, or people picked. */
export function AudiencePicker({ form, people, regions, onChange }: { form: BatchForm; people: readonly EmployeeDto[]; regions: readonly TimesheetRegionDto[]; onChange: (patch: Partial<BatchForm>) => void }) {
  const departments = [...new Set(people.map((p) => p.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-medium">Áp dụng cho</legend>
      <div role="radiogroup" aria-label="Áp dụng cho" className="flex flex-wrap gap-2">
        {AUDIENCE_KINDS.map((k) => (
          <label key={k.kind} className={PILL}>
            <input type="radio" name="batch-audience" checked={form.kind === k.kind} onChange={() => onChange({ kind: k.kind })} className="size-4 accent-blue-600" />
            {k.label}
          </label>
        ))}
      </div>
      {form.kind === 'region' && <CheckList label="Khu vực" items={regions.map((r) => ({ id: r.id, label: r.name }))} chosen={form.regionIds} onChange={(regionIds) => onChange({ regionIds })} />}
      {form.kind === 'department' && <CheckList label="Bộ phận" items={departments.map((d) => ({ id: d, label: d }))} chosen={form.departments} onChange={(ids) => onChange({ departments: ids })} />}
      {form.kind === 'people' && <PeoplePick people={people} chosen={form.employeeIds} onChange={(employeeIds) => onChange({ employeeIds })} />}
    </fieldset>
  );
}
