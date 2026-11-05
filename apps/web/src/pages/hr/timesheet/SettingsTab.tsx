import { REGION_TONES, type RegionTone, type TimesheetRegionDto } from '@careers/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Flag, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { ErrorState, LoadingStatus } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { REGION_TONE, RegionBadge } from './columns';
import { DateField } from './DateField';
import { Field } from './dialogs';
import { useHolidays, useRegions } from './queries';

function TonePicker({ value, onChange }: { value: RegionTone; onChange: (t: RegionTone) => void }) {
  return (
    <div role="group" aria-label="Màu" className="flex h-9 items-center gap-1.5">
      {REGION_TONES.map((tone) => (
        <button key={tone} type="button" aria-label={`Màu ${tone}`} aria-pressed={value === tone} onClick={() => onChange(tone)} className={`flex size-7 items-center justify-center rounded-full border ${REGION_TONE[tone]} ${value === tone ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
          {value === tone && <Check className="size-3.5" />}
        </button>
      ))}
    </div>
  );
}

function Regions({ regions }: { regions: readonly TimesheetRegionDto[] }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saturdays, setSaturdays] = useState('2');
  const [tone, setTone] = useState<RegionTone>('cyan');
  const done = (list: TimesheetRegionDto[]) => {
    qc.setQueryData(['hr', 'regions'], list);
    void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
    setEditingId(null);
    setName('');
    setSaturdays('2');
  };
  const save = useMutation({
    mutationFn: () => {
      const input = { name, saturdays: Number(saturdays) || 0, tone };
      return editingId ? api.hrUpdateRegion(editingId, input) : api.hrCreateRegion(input);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.hrDeleteRegion(id), onSuccess: done });
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><MapPin className="size-5 text-rose-600" />Khu vực</h2>
      <p className="m-0 text-sm text-slate-500">Định mức gợi ý = T2–T6 của kỳ + số thứ Bảy.</p>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="border-b text-left">{['Khu vực', 'Thứ Bảy', 'Nhân viên', ''].map((h) => <th key={h} className="h-10 px-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {regions.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2"><RegionBadge regionId={r.id} regions={regions} /></td>
              <td className="p-2">+{r.saturdays}</td>
              <td className="p-2">{r.employees}</td>
              <td className="p-2 text-right">
                <span className="inline-flex gap-1">
                  <button type="button" aria-label={`Sửa ${r.name}`} onClick={() => { setEditingId(r.id); setName(r.name); setSaturdays(String(r.saturdays)); setTone(r.tone); }} className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-slate-50"><Pencil className="size-3.5 text-blue-600" /></button>
                  <button type="button" aria-label={`Xoá ${r.name}`} disabled={r.employees > 0 || remove.isPending} title={r.employees > 0 ? 'Đang có nhân viên' : undefined} onClick={() => remove.mutate(r.id)} className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="size-3.5 text-red-600" /></button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label="Tên khu vực" error={errors.name}><Input aria-label="Tên khu vực" value={name} placeholder="vd: Đà Nẵng" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Số thứ Bảy" error={errors.saturdays}><Input aria-label="Số thứ Bảy" inputMode="numeric" value={saturdays} onChange={(e) => setSaturdays(e.target.value)} /></Field>
        <div className="flex flex-col gap-1.5 text-sm font-medium">Màu<TonePicker value={tone} onChange={setTone} /></div>
        <div className="flex flex-col gap-1.5 text-sm font-medium sm:items-end">
          <span aria-hidden="true" className="max-sm:hidden">&nbsp;</span>
          <button type="button" aria-label={editingId ? 'Lưu khu vực' : 'Thêm khu vực'} disabled={!name.trim() || save.isPending} onClick={() => save.mutate()} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50 max-sm:w-full">
            {editingId ? <Check className="size-4" /> : <Plus className="size-4" />}
            {editingId ? 'Lưu' : 'Thêm'}
          </button>
        </div>
      </div>
      {(save.isError && Object.keys(errors).length === 0) && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(save.error)}</p>}
      {remove.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
    </section>
  );
}

function Holidays() {
  const qc = useQueryClient();
  const holidays = useHolidays();
  const [day, setDay] = useState('');
  const [name, setName] = useState('');
  const done = (list: { day: string; name: string }[]) => {
    qc.setQueryData(['hr', 'holidays'], list);
    void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
    setDay('');
    setName('');
  };
  const save = useMutation({ mutationFn: () => api.hrSaveHoliday({ day, name }), onSuccess: done });
  const remove = useMutation({ mutationFn: (d: string) => api.hrDeleteHoliday(d), onSuccess: done });
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><Flag className="size-5 text-teal-600" />Ngày lễ</h2>
      <p className="m-0 text-sm text-slate-500">Mọi người tự có NL trong các kỳ đang mở.</p>
      {holidays.isError && <ErrorState onRetry={() => holidays.refetch()} message={errorMessage(holidays.error)} />}
      {holidays.data?.length === 0 && <p className="m-0 text-sm text-slate-500">Chưa có ngày lễ nào.</p>}
      <ul className="m-0 flex list-none flex-col p-0 text-sm">
        {holidays.data?.map((h) => (
          <li key={h.day} className="flex items-center gap-2 border-b py-1.5 last:border-b-0">
            <Flag className="size-3.5 text-teal-600" />
            <span className="tabular-nums">{h.day.split('-').reverse().join('/')}</span>
            <span className="flex-1">{h.name}</span>
            <button type="button" aria-label={`Xoá ${h.name}`} disabled={remove.isPending} onClick={() => remove.mutate(h.day)} className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-red-50"><Trash2 className="size-3.5 text-red-600" /></button>
          </li>
        ))}
      </ul>
      <div className="grid items-end gap-3 sm:grid-cols-[170px_1fr_auto]">
        <DateField label="Ngày lễ" value={day} onChange={setDay} />
        <Field label="Tên ngày lễ"><Input aria-label="Tên ngày lễ" value={name} placeholder="vd: Quốc khánh" onChange={(e) => setName(e.target.value)} /></Field>
        <button type="button" aria-label="Thêm ngày lễ" disabled={!day || !name.trim() || save.isPending} onClick={() => save.mutate()} className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50"><Plus className="size-4" />Thêm</button>
      </div>
      {(save.isError || remove.isError) && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(save.error ?? remove.error)}</p>}
    </section>
  );
}

export function SettingsTab() {
  const regions = useRegions();
  if (regions.isPending) return <LoadingStatus />;
  if (regions.isError) return <ErrorState onRetry={() => regions.refetch()} message={errorMessage(regions.error)} />;
  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <Regions regions={regions.data} />
      <Holidays />
    </div>
  );
}
