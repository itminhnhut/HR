import { periodMonthOf, REGION_TONES, saturdaysFor, todayInVietnam, type RegionTone, type TimesheetRegionDto } from '@careers/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../vendor/shadcn-grid/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { REGION_TONE, RegionBadge } from './columns';
import { HolidaysCard } from './HolidaysCard';
import { ConfirmDialog, Field } from './dialogs';
import { useRegions } from './queries';
import { TabSkeleton } from './skeletons';

const TONE_NAME: Record<RegionTone, string> = { blue: 'xanh dương', rose: 'hồng', emerald: 'xanh lá', amber: 'vàng', cyan: 'xanh ngọc', orange: 'cam' };
const ICON_BUTTON = 'inline-flex size-8 items-center justify-center rounded-md border bg-white';

function TonePicker({ value, onChange }: { value: RegionTone; onChange: (t: RegionTone) => void }) {
  return (
    <div role="group" aria-label="Màu" className="flex h-9 items-center gap-1.5">
      {REGION_TONES.map((tone) => (
        <button key={tone} type="button" aria-label={`Màu ${TONE_NAME[tone]}`} aria-pressed={value === tone} onClick={() => onChange(tone)} className={`flex size-7 items-center justify-center rounded-full border ${REGION_TONE[tone]} ${value === tone ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
          {value === tone && <Check className="size-3.5" />}
        </button>
      ))}
    </div>
  );
}

/** YYYY-MM of the period `ahead` months after this one. */
const keyOf = (ahead: number) => {
  const { year, month } = periodMonthOf(todayInVietnam());
  const total = year * 12 + month - 1 + ahead;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};
const MONTHS_AHEAD = Array.from({ length: 18 }, (_, i) => keyOf(i));
const monthWord = (key: string) => `T${Number(key.slice(5))}/${key.slice(0, 4)}`;

function RegionRow({ region, regions, isEditing, isBusy, onEdit, onDelete }: { region: TimesheetRegionDto; regions: readonly TimesheetRegionDto[]; isEditing: boolean; isBusy: boolean; onEdit: () => void; onDelete: () => void }) {
  const hasPeople = region.employees > 0;
  return (
    <tr className={`border-b ${isEditing ? 'bg-blue-50' : ''}`}>
      <td className="max-w-64 p-2">
        <span className="flex items-center gap-2">
          <RegionBadge regionId={region.id} regions={regions} />
          {isEditing && <span className="text-xs font-medium whitespace-nowrap text-blue-800">Đang sửa</span>}
        </span>
      </td>
      <td className="p-2 whitespace-nowrap">
        +{saturdaysFor(region, keyOf(0))}
        {region.saturdayChanges.filter((c) => c.from > keyOf(0)).map((c) => <span key={c.from} className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">Từ T{Number(c.from.slice(5))}/{c.from.slice(0, 4)}: +{c.saturdays}</span>)}
      </td>
      <td className="p-2">{region.employees}</td>
      <td className="p-2 text-right">
        <span className="inline-flex gap-1">
          <button type="button" aria-label={`Sửa ${region.name}`} onClick={onEdit} className={`${ICON_BUTTON} hover:bg-slate-50`}><Pencil className="size-3.5 text-blue-600" /></button>
          {hasPeople ? (
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} className="inline-flex" />}>
                <button type="button" aria-label={`Xoá ${region.name}`} disabled className={`${ICON_BUTTON} pointer-events-none opacity-40`}><Trash2 className="size-3.5 text-red-600" /></button>
              </TooltipTrigger>
              <TooltipContent>Đang có nhân viên, chưa xoá được</TooltipContent>
            </Tooltip>
          ) : (
            <button type="button" aria-label={`Xoá ${region.name}`} disabled={isBusy} onClick={onDelete} className={`${ICON_BUTTON} hover:bg-red-50`}><Trash2 className="size-3.5 text-red-600" /></button>
          )}
        </span>
      </td>
    </tr>
  );
}

function RegionTable({ regions, editingId, isBusy, onEdit, onDelete }: { regions: readonly TimesheetRegionDto[]; editingId: string | null; isBusy: boolean; onEdit: (r: TimesheetRegionDto) => void; onDelete: (r: TimesheetRegionDto) => void }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead><tr className="border-b text-left">{['Khu vực', 'Thứ Bảy', 'Nhân viên', ''].map((h) => <th key={h} className="h-10 px-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>
        {regions.map((r) => <RegionRow key={r.id} region={r} regions={regions} isEditing={r.id === editingId} isBusy={isBusy} onEdit={() => onEdit(r)} onDelete={() => onDelete(r)} />)}
      </tbody>
    </table>
  );
}

function useRegionForm() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saturdays, setSaturdays] = useState('2');
  const [tone, setTone] = useState<RegionTone>('cyan');
  const [saturdaysFrom, setSaturdaysFrom] = useState(MONTHS_AHEAD[0] ?? '');
  const reset = () => {
    setEditingId(null);
    setName('');
    setSaturdays('2');
  };
  const done = (list: TimesheetRegionDto[]) => {
    qc.setQueryData(['hr', 'regions'], list);
    void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
    reset();
  };
  const save = useMutation({
    mutationFn: () => {
      const input = { name, saturdays: Number(saturdays) || 0, tone };
      return editingId ? api.hrUpdateRegion(editingId, { ...input, saturdaysFrom }) : api.hrCreateRegion(input);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.hrDeleteRegion(id), onSuccess: done });
  const edit = (r: TimesheetRegionDto) => {
    setEditingId(r.id);
    setName(r.name);
    setSaturdays(String(saturdaysFor(r, keyOf(0))));
    setSaturdaysFrom(MONTHS_AHEAD[0] ?? '');
    setTone(r.tone);
  };
  const cancel = () => {
    reset();
    save.reset();
  };
  return { editingId, name, setName, saturdays, setSaturdays, tone, setTone, saturdaysFrom, setSaturdaysFrom, save, remove, edit, cancel };
}

function Regions({ regions }: { regions: readonly TimesheetRegionDto[] }) {
  const form = useRegionForm();
  const { editingId, save, remove } = form;
  const [deleting, setDeleting] = useState<TimesheetRegionDto | null>(null);
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  return (
    <section className="ts-card flex flex-col gap-3 p-4">
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><MapPin className="size-5 text-rose-600" />Khu vực</h2>
      <p className="m-0 text-sm text-slate-500">Định mức gợi ý = T2–T6 của kỳ + số thứ Bảy. Sửa một tháng thì sửa ngay trên bảng công.</p>
      <RegionTable regions={regions} editingId={editingId} isBusy={remove.isPending} onEdit={form.edit} onDelete={setDeleting} />
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label="Tên khu vực" error={errors.name}><Input aria-label="Tên khu vực" value={form.name} placeholder="vd: Đà Nẵng" onChange={(e) => form.setName(e.target.value)} /></Field>
        <Field label="Số thứ Bảy" error={errors.saturdays}><Input aria-label="Số thứ Bảy" inputMode="numeric" value={form.saturdays} onChange={(e) => form.setSaturdays(e.target.value)} /></Field>
        {editingId && (
          <Field label="Số thứ Bảy áp dụng từ">
            <Select value={form.saturdaysFrom} onValueChange={(v) => form.setSaturdaysFrom(String(v))} items={MONTHS_AHEAD.map((k) => ({ value: k, label: monthWord(k) }))}>
              <SelectTrigger aria-label="Số thứ Bảy áp dụng từ" className="w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS_AHEAD.map((k) => <SelectItem key={k} value={k}>{monthWord(k)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        )}
        <div className="flex flex-col gap-1.5 text-sm font-medium">Màu<TonePicker value={form.tone} onChange={form.setTone} /></div>
        <div className={`flex flex-col gap-1.5 text-sm font-medium sm:items-end ${editingId ? 'sm:col-span-2' : ''}`}>
          {!editingId && <span aria-hidden="true" className="max-sm:hidden">&nbsp;</span>}
          <span className="flex gap-2 max-sm:w-full">
            {editingId && <button type="button" onClick={form.cancel} className="ts-field rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50 max-sm:flex-1">Huỷ</button>}
            <button type="button" aria-label={editingId ? 'Lưu khu vực' : 'Thêm khu vực'} disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()} className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50 max-sm:flex-1">
              {editingId ? <Check className="size-4" /> : <Plus className="size-4" />}
              {editingId ? 'Lưu' : 'Thêm'}
            </button>
          </span>
        </div>
      </div>
      {(save.isError && Object.keys(errors).length === 0) && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(save.error)}</p>}
      {remove.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
      <ConfirmDialog open={!!deleting} title={`Xoá khu vực ${deleting?.name ?? ''}?`} isBusy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }} />
    </section>
  );
}

export function SettingsTab() {
  const regions = useRegions();
  if (regions.isPending) return <TabSkeleton />;
  if (regions.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => regions.refetch()} message={errorMessage(regions.error)} /></div>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Regions regions={regions.data} />
      <HolidaysCard />
    </div>
  );
}
