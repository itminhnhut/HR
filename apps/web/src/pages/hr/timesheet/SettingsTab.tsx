import { periodMonthOf, REGION_TONES, saturdaysFor, todayInVietnam, type RegionTone, type TimesheetRegionDto } from '@careers/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../vendor/shadcn-grid/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MapPin } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { REGION_TONE } from './columns';
import { ConfirmDialog, Field } from './dialogs';
import { FormBox, MasterRow } from './MasterPanels';
import { useConfigRefresh, useRegions } from './queries';
import { TabSkeleton } from './skeletons';

const TONE_NAME: Record<RegionTone, string> = { blue: 'xanh dương', rose: 'hồng', emerald: 'xanh lá', amber: 'vàng', cyan: 'xanh ngọc', orange: 'cam' };

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

function useRegionForm() {
  const qc = useQueryClient();
  const refresh = useConfigRefresh();
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
    refresh();
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

/** Saturdays now, then any change already planned. */
function saturdaysWord(region: TimesheetRegionDto) {
  const later = region.saturdayChanges.filter((c) => c.from > keyOf(0)).map((c) => `từ ${monthWord(c.from)}: +${c.saturdays}`);
  return [`+${saturdaysFor(region, keyOf(0))} thứ Bảy`, ...later].join(' · ');
}

function Regions({ regions }: { regions: readonly TimesheetRegionDto[] }) {
  const form = useRegionForm();
  const { editingId, save, remove } = form;
  const [deleting, setDeleting] = useState<TimesheetRegionDto | null>(null);
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  return (
    <section className="ts-card flex flex-col gap-4 p-4">
      <FormBox label={editingId ? 'Lưu khu vực' : 'Thêm khu vực'} isEditing={!!editingId} canSave={!!form.name.trim()} isBusy={save.isPending} error={save.error} onSave={() => save.mutate()} onCancel={form.cancel}>
        <Field label="Tên khu vực" error={errors.name}><Input aria-label="Tên khu vực" value={form.name} placeholder="vd: Đà Nẵng" onChange={(e) => form.setName(e.target.value)} className="bg-white" /></Field>
        <Field label="Số thứ Bảy" error={errors.saturdays}><Input aria-label="Số thứ Bảy" inputMode="numeric" value={form.saturdays} onChange={(e) => form.setSaturdays(e.target.value)} className="bg-white" /></Field>
        {editingId && (
          <Field label="Áp dụng từ">
            <Select value={form.saturdaysFrom} onValueChange={(v) => form.setSaturdaysFrom(String(v))} items={MONTHS_AHEAD.map((k) => ({ value: k, label: monthWord(k) }))}>
              <SelectTrigger aria-label="Số thứ Bảy áp dụng từ" className="w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS_AHEAD.map((k) => <SelectItem key={k} value={k}>{monthWord(k)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        )}
        <div className="flex flex-col gap-1.5 text-sm font-medium">Màu<TonePicker value={form.tone} onChange={form.setTone} /></div>
      </FormBox>
      <p className="m-0 text-xs text-slate-500">Định mức gợi ý = T2–T6 của kỳ + số thứ Bảy. Sửa một tháng thì sửa ngay trên bảng công.</p>
      {remove.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {regions.map((r) => (
          <MasterRow key={r.id} icon={MapPin} tone={REGION_TONE[r.tone]} name={r.name} detail={saturdaysWord(r)} count={r.employees} isEditing={r.id === editingId} lockedReason={r.employees > 0 ? `Đang có ${r.employees} nhân viên` : null} onEdit={() => form.edit(r)} onRemove={() => setDeleting(r)} />
        ))}
      </ul>
      <ConfirmDialog open={!!deleting} title={`Xoá khu vực ${deleting?.name ?? ''}?`} isBusy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }} />
    </section>
  );
}

export function RegionsPanel() {
  const regions = useRegions();
  if (regions.isPending) return <TabSkeleton />;
  if (regions.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => regions.refetch()} message={errorMessage(regions.error)} /></div>;
  return <Regions regions={regions.data} />;
}
