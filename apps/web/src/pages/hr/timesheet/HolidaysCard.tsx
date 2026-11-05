import { FIXED_HOLIDAYS, groupHolidays, todayInVietnam } from '@careers/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Flag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { DateField } from './DateField';
import { ConfirmDialog, Field } from './dialogs';
import { FormBox } from './MasterPanels';
import { YearNav } from './months';
import { useHolidays } from './queries';

const show = (iso: string) => iso.split('-').reverse().join('/');

type Group = ReturnType<typeof groupHolidays>[number];

function useHolidayActions(year: number, onDone: () => void) {
  const qc = useQueryClient();
  const holidays = useHolidays();
  const done = (list: { day: string; name: string }[]) => {
    qc.setQueryData(['hr', 'holidays'], list);
    void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
    onDone();
  };
  const save = useMutation({ mutationFn: (input: { from: string; to: string; name: string }) => api.hrSaveHolidayRange(input), onSuccess: done });
  const fixed = useMutation({
    mutationFn: async () => {
      const taken = new Set((holidays.data ?? []).map((h) => h.day));
      let list = holidays.data ?? [];
      for (const h of FIXED_HOLIDAYS.filter((f) => !taken.has(`${year}-${f.monthDay}`))) {
        list = await api.hrSaveHoliday({ day: `${year}-${h.monthDay}`, name: h.name });
      }
      return list;
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: (g: Group) => api.hrDeleteHolidayRange(g.from, g.to), onSuccess: done });
  return { holidays, save, fixed, remove };
}

function HolidayList({ groups, isBusy, onDelete }: { groups: readonly Group[]; isBusy: boolean; onDelete: (g: Group) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0 text-sm">
      {groups.map((g) => (
        <li key={g.from} className="flex min-h-12 items-center gap-2.5 border-b px-2 py-1.5 last:border-b-0">
          <Flag className="size-3.5 shrink-0 text-teal-600" />
          <span className="whitespace-nowrap tabular-nums">{show(g.from)}{g.to !== g.from ? ` – ${show(g.to)}` : ''}</span>
          <span className="min-w-0 flex-1 truncate">{g.name}</span>
          {g.days > 1 && <span className="rounded-full bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-600">{g.days} ngày</span>}
          <button type="button" aria-label={`Xoá ${g.name}`} disabled={isBusy} onClick={() => onDelete(g)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-white hover:bg-red-50"><Trash2 className="size-3.5 text-red-600" /></button>
        </li>
      ))}
    </ul>
  );
}

/** Holidays by year: one day, or a long break such as Tết in one go. */
export function HolidaysCard() {
  const [year, setYear] = useState(() => Number(todayInVietnam().slice(0, 4)));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<Group | null>(null);
  const { holidays, save, fixed, remove } = useHolidayActions(year, () => {
    setFrom('');
    setTo('');
    setName('');
    setDeleting(null);
  });
  const groups = groupHolidays((holidays.data ?? []).filter((h) => h.day.startsWith(`${year}-`)));
  const error = save.error ?? fixed.error ?? remove.error;
  return (
    <section className="ts-card flex flex-col gap-4 p-4">
      <FormBox label="Thêm đợt nghỉ" isEditing={false} canSave={!!from && !!name.trim()} isBusy={save.isPending} error={null} onSave={() => save.mutate({ from, to: to || from, name })} onCancel={() => undefined}>
        <DateField label="Từ ngày" value={from} onChange={setFrom} />
        <DateField label="Đến ngày (nghỉ dài)" value={to} onChange={setTo} />
        <Field label="Tên đợt nghỉ"><Input aria-label="Tên đợt nghỉ" value={name} placeholder="vd: Tết Nguyên đán" onChange={(e) => setName(e.target.value)} className="bg-white" /></Field>
      </FormBox>
      {!!error && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
      <p className="m-0 text-xs text-slate-500">Mọi người tự có NL trong kỳ đang mở. Ai đi làm thì HR sửa ô đó. Lễ rơi vào Chủ nhật tự nghỉ bù ngày kế tiếp. Tết, Giỗ Tổ và ngày liền kề 2/9: nhập theo thông báo của Chính phủ.</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1"><YearNav year={year} onChange={setYear} /></div>
        <button type="button" disabled={fixed.isPending} onClick={() => fixed.mutate()} className="ts-field inline-flex items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 max-sm:w-full"><CalendarPlus className="size-4 text-teal-600" />Thêm lễ cố định năm {year}</button>
      </div>
      {holidays.isError && <div className="ts-site-tokens"><ErrorState onRetry={() => holidays.refetch()} message={errorMessage(holidays.error)} /></div>}
      {holidays.data && groups.length === 0 && <p role="status" className="m-0 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Năm {year} chưa có ngày lễ nào.</p>}
      <HolidayList groups={groups} isBusy={remove.isPending} onDelete={setDeleting} />
      <ConfirmDialog open={!!deleting} title={`Xoá ${deleting?.name ?? ''}?`} isBusy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) remove.mutate(deleting); }} />
    </section>
  );
}
