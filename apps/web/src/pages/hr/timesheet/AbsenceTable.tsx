import { ABSENCE_COUNTING, matchesQuery, todayInVietnam, type AbsenceRowDto } from '@careers/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, ListChecks, Pencil, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { FitText } from './columns';
import { ConfirmDialog } from './dialogs';
import { KindMark } from './KindSelect';
import { YearNav } from './months';

const show = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const HEADS = ['Trạng thái', 'Nhân viên', 'Lý do', 'Thời gian', 'Số ngày', 'Tính công', 'Người duyệt', 'Bàn giao', 'Ghi chú'];

function State({ row }: { row: AbsenceRowDto }) {
  if (row.code === 'M') return <span className="inline-flex h-6 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-medium whitespace-nowrap text-amber-800"><Clock className="size-3" />Đã ghi</span>;
  return row.approvedBy
    ? <span className="inline-flex h-6 items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 text-xs font-medium whitespace-nowrap text-green-800"><CheckCircle2 className="size-3" />Đã duyệt</span>
    : <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-700"><Clock className="size-3" />Chờ duyệt</span>;
}

/** Everything written down for a year: who was away or late, why, and whether it is approved. */
export function AbsenceTable({ editingId, isRemoving, removeError, onEdit, onRemove }: {
  editingId: string | null;
  isRemoving: boolean;
  removeError: unknown;
  onEdit: (row: AbsenceRowDto) => void;
  onRemove: (row: AbsenceRowDto) => void;
}) {
  const [year, setYear] = useState(() => Number(todayInVietnam().slice(0, 4)));
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<AbsenceRowDto | null>(null);
  const list = useQuery({ queryKey: ['hr', 'absences', year], queryFn: () => api.hrAllAbsences(year) });
  const rows = (list.data ?? []).filter((r) => matchesQuery(`${r.fullName} ${r.employeeCode} ${r.label} ${r.note} ${r.approvedBy ?? ''}`, query));
  const waiting = (list.data ?? []).filter((r) => !r.approvedBy && r.code !== 'M').length;
  return (
    <section className="ts-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><ListChecks className="size-5 text-blue-600" />Danh sách <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-600">{rows.length}</span></h2>
        {waiting > 0 && <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-medium text-slate-700"><Clock className="size-3" />{waiting} chờ duyệt</span>}
        <div className="w-44"><YearNav year={year} onChange={setYear} /></div>
        <span className="relative ml-auto max-md:ml-0 max-md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Tìm trong danh sách" value={query} placeholder="Tìm tên, lý do, ghi chú" onChange={(e) => setQuery(e.target.value)} className="w-64 bg-white pl-8 max-md:w-full" />
        </span>
      </div>
      {list.isError && <div className="ts-site-tokens"><ErrorState onRetry={() => list.refetch()} message={errorMessage(list.error)} /></div>}
      {list.data && rows.length === 0 && <p className="m-0 py-6 text-center text-sm text-slate-500">{list.data.length === 0 ? `Năm ${year} chưa có ai.` : 'Không có dòng phù hợp.'}</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm whitespace-nowrap">
            <thead><tr className="border-b text-left">{HEADS.map((h) => <th key={h} className="h-10 px-2 font-medium">{h}</th>)}<th aria-label="Thao tác" className="sticky right-0 bg-white" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b ${r.id === editingId ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <td className="p-2"><State row={r} /></td>
                  <td className="max-w-48 p-2 font-medium"><FitText text={r.fullName} limit={22} /></td>
                  <td className="max-w-56 p-2"><span className="flex items-center gap-2"><KindMark code={r.code} reason={r.reason} /><FitText text={r.label} limit={24} /></span></td>
                  <td className="p-2 tabular-nums">{show(r.from)}{r.to !== r.from ? ` – ${show(r.to)}` : ''}</td>
                  <td className="p-2"><span className="inline-flex h-5 items-center rounded-full bg-blue-50 px-2 text-xs font-semibold text-blue-800 tabular-nums">{String(r.days).replace('.', ',')} ngày</span></td>
                  <td className="p-2 text-slate-600">{r.code === 'M' ? 'Vẫn 1 công, đếm 1 lần' : ABSENCE_COUNTING[r.code as keyof typeof ABSENCE_COUNTING] ?? ''}</td>
                  <td className="max-w-36 p-2"><FitText text={r.approvedBy ?? '-'} limit={16} /></td>
                  <td className="max-w-44 p-2"><FitText text={r.handover || '-'} limit={20} /></td>
                  <td className="max-w-52 p-2"><FitText text={r.note || '-'} limit={24} /></td>
                  <td className={`sticky right-0 p-2 text-right ${r.id === editingId ? 'bg-blue-50' : 'bg-white'}`}>
                    <span className="inline-flex gap-1">
                      <button type="button" aria-label={`Sửa ${r.fullName} ${show(r.from)}`} onClick={() => onEdit(r)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50 max-md:size-11 max-md:justify-center max-md:px-0"><Pencil className="size-3.5 text-blue-600" /><span className="max-md:sr-only">Sửa</span></button>
                      <button type="button" aria-label={`Huỷ ${r.fullName} ${show(r.from)}`} disabled={isRemoving} onClick={() => setRemoving(r)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-red-50 max-md:size-11 max-md:justify-center max-md:px-0"><Trash2 className="size-3.5 text-red-600" /><span className="max-md:sr-only">Huỷ</span></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!removeError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(removeError)}</p>}
      <ConfirmDialog open={!!removing} title={`Huỷ ${removing?.label ?? ''} của ${removing?.fullName ?? ''}? Bảng công về như cũ.`} confirmLabel="Huỷ dòng này" isBusy={isRemoving} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) onRemove(removing); setRemoving(null); }} />
    </section>
  );
}
