import { SHEET_APPROVER, standardPeriod, todayInVietnam, type AbsenceRowDto, type EmployeeDto } from '@careers/shared';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle2, Clock, Download, FileWarning, ListChecks, Paperclip, Pencil, Search, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useState } from 'react';
import { api } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { FitText } from './columns';
import { paperTargetOf, type PaperTarget } from './AbsencePapers';
import { CopyValue } from './CopyValue';
import { ConfirmDialog } from './dialogs';
import { KindMark } from './KindSelect';
import { sheetLineForm } from './sheetLineForm';
import { AbsenceFilterBar } from './AbsenceFilterBar';
import { filterAbsences, filtersFromLink, isWaiting, NO_FILTERS, sheetLink, startFilters, type AbsenceFilters } from './absenceFilters';
import { YearNav } from './months';
import { crowdedDepartments } from './departmentAway';
import { countingWords, exportLeaveList } from './exportLeave';
import { useEmployees } from './queries';

const show = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
/** A press on a button, a link or a copy inside the line does its own thing; anywhere else opens the sheet. */
const isOwnControl = (target: EventTarget) => target instanceof Element && !!target.closest('button, a, input, [role="button"]');
const HEADS = ['Nhân viên', 'Lý do', 'Thời gian', 'Số ngày', 'Tính công', 'Người duyệt', 'Bàn giao', 'Ghi chú'];
const timeWords = (from: string, to: string) => `${show(from)}${to !== from ? ` – ${show(to)}` : ''}`;

interface DaysGroup { key: string; from: string; to: string; rows: AbsenceRowDto[] }

/** Lines on the same days, in the list's order (newest first): their "Thời gian" is one cell, so who is away together shows. */
function byDays(rows: readonly AbsenceRowDto[]): DaysGroup[] {
  const groups = new Map<string, DaysGroup>();
  for (const r of rows) {
    const key = `${r.from}|${r.to}`;
    const group = groups.get(key);
    groups.set(key, group ? { ...group, rows: [...group.rows, r] } : { key, from: r.from, to: r.to, rows: [r] });
  }
  return [...groups.values()];
}

/** A department with two or more people away on a day of these dates: a light mark, never a block. */
function CrowdChips({ crowded }: { crowded: readonly { department: string; count: number; day: string }[] }) {
  if (crowded.length === 0) return null;
  return (
    <span className="mt-1 flex flex-col items-start gap-1">
      {crowded.map((c) => (
        <span key={c.department} title={`Ngày ${show(c.day)}: ${c.department} có ${c.count} người nghỉ`} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 text-[11px] whitespace-nowrap font-medium text-amber-900 ring-1 ring-amber-200">
          <Building2 aria-hidden="true" className="size-3" />{`${c.department} · ${c.count}`}
        </span>
      ))}
    </span>
  );
}

/** "Thời gian" once for every line on those days; it opens the sheet on that day. */
function TimeCell({ group, crowded }: { group: DaysGroup; crowded: readonly { department: string; count: number; day: string }[] }) {
  const sheet = sheetLink(group.from, group.rows[0]?.employeeId);
  const count = group.rows.length;
  return (
    <td rowSpan={count} className="border-x bg-white p-2 align-middle tabular-nums">
      <Link to={sheet} aria-label={`Mở bảng công ngày ${show(group.from)}`} title="Mở bảng công ngày này" className="font-medium text-blue-700 underline-offset-2 hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center">{timeWords(group.from, group.to)}</Link>
      {count > 1 && <span className="mt-0.5 block text-xs text-amber-800">{count} người</span>}
      <CrowdChips crowded={crowded} />
    </td>
  );
}

/** Departments of a group's people crowded on its days, counted over the whole year's lines. */
function crowdOf(group: DaysGroup, all: readonly AbsenceRowDto[], people: readonly EmployeeDto[]) {
  const own = new Set(group.rows.map((r) => people.find((p) => p.id === r.employeeId)?.department ?? ''));
  return crowdedDepartments(all, people, group.from, group.to).filter((c) => own.has(c.department));
}

/** A line a company day off wrote: its name, linking to it in tab Nghỉ công ty, where it is changed. */
function BatchMark({ row }: { row: AbsenceRowDto }) {
  if (!row.batch) return null;
  return (
    <Link to={`/hr/cham-cong/nghi-cong-ty?dot=${row.batch.id}&nam=${row.from.slice(0, 4)}`} aria-label={`Đợt nghỉ công ty: ${row.batch.name}`} className="inline-flex h-6 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 text-xs font-medium whitespace-nowrap text-violet-800 no-underline hover:bg-violet-100 max-md:h-11">
      <Building2 className="size-3" />Đợt: {row.batch.name}
    </Link>
  );
}

const exportTitle = (year: number, period: number | null) => {
  if (!period) return `Năm ${year}`;
  const { from, to } = standardPeriod(year, period);
  return `Kỳ T${period} (${show(from)} – ${show(to)}/${year})`;
};

/** "Người duyệt" says the state too: who approved, or that it waits; lateness needs nobody. HR approved what HR typed. */
function Approval({ row }: { row: AbsenceRowDto }) {
  if (row.code === 'M') return <span className="text-slate-500">Không cần duyệt</span>;
  const by = row.source === 'sheet' ? (row.approvedBy ?? SHEET_APPROVER) : row.approvedBy;
  if (by) return <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 shrink-0 text-green-600" />{by}</span>;
  return <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-700"><Clock className="size-3" />Chờ duyệt</span>;
}

/** The reason asks for papers (Cấu hình) and none are kept yet: a reminder, never a block on closing. */
const isMissingPaper = (row: AbsenceRowDto) => row.source !== 'sheet' && row.needsPaper && row.files.length === 0;

function MissingPaper() {
  return <span className="inline-flex h-6 items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 text-xs font-medium whitespace-nowrap text-orange-800"><FileWarning className="size-3" />Thiếu giấy</span>;
}

/** Everything written down for a year: who was away or late, why, and whether it is approved. */
export function AbsenceTable({ editingId, isRemoving, removeError, onEdit, onRemove, onPapers }: {
  editingId: string | null;
  /** Opens the Giấy tờ dialog of a line. */
  onPapers: (target: PaperTarget) => void;
  isRemoving: boolean;
  removeError: unknown;
  onEdit: (row: AbsenceRowDto) => void;
  onRemove: (row: AbsenceRowDto) => void;
}) {
  // A link from the leave calendar or the yearly report opens already filtered (`?ngay=`, `?nguoi=&nam=&loai=`).
  const [params] = useSearchParams();
  const [linked] = useState(() => filtersFromLink(params, todayInVietnam()));
  const [year, setYear] = useState(() => linked?.year ?? Number(todayInVietnam().slice(0, 4)));
  // Opens on the period running today; another year starts on the whole year.
  const start = startFilters(todayInVietnam());
  const yearStart = (y: number) => (y === Number(todayInVietnam().slice(0, 4)) ? start : NO_FILTERS);
  const [filters, setFilters] = useState<AbsenceFilters>(linked?.filters ?? start);
  const [removing, setRemoving] = useState<AbsenceRowDto | null>(null);
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['hr', 'absences', year], queryFn: () => api.hrAllAbsences(year) });
  const people = useEmployees().data ?? [];
  const rows = filterAbsences(list.data ?? [], year, filters);
  const departmentOf = (id: string) => people.find((p) => p.id === id)?.department ?? '';
  const waiting = (list.data ?? []).filter(isWaiting).length;
  return (
    <section className="ts-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><ListChecks className="size-5 text-blue-600" />Danh sách <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-600">{rows.length}</span></h2>
        {waiting > 0 && <button type="button" onClick={() => setFilters({ ...filters, approval: 'waiting' })} className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200"><Clock className="size-3" />{waiting} chờ duyệt</button>}
        <div className="w-44"><YearNav year={year} onChange={(y) => { setYear(y); setFilters({ ...filters, period: yearStart(y).period, day: '' }); }} /></div>
        <button type="button" disabled={rows.length === 0} onClick={() => void exportLeaveList(rows, departmentOf, year, filters.period, exportTitle(year, filters.period))} className="ts-field inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium whitespace-nowrap hover:bg-slate-50 disabled:opacity-50"><Download className="size-4 text-green-700" />Tải Excel</button>
        <span className="relative ml-auto max-md:ml-0 max-md:w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Tìm trong danh sách" value={filters.query} placeholder="Tìm tên, lý do, ghi chú" onChange={(e) => setFilters({ ...filters, query: e.target.value })} className="w-64 bg-white pl-8 max-md:w-full" />
        </span>
      </div>
      <AbsenceFilterBar year={year} rows={list.data ?? []} filters={filters} start={yearStart(year)} shown={rows.length} onChange={setFilters} />
      {list.isError && <div className="ts-site-tokens"><ErrorState onRetry={() => list.refetch()} message={errorMessage(list.error)} /></div>}
      {list.data && rows.length === 0 && <p className="m-0 py-6 text-center text-sm text-slate-500">{list.data.length === 0 ? `Năm ${year} chưa có ai.` : 'Không có dòng phù hợp.'}</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm whitespace-nowrap">
            <thead><tr className="border-b text-left">{HEADS.map((h) => <th key={h} className="h-10 px-2 font-medium">{h}</th>)}<th aria-label="Thao tác" className="sticky right-0 bg-white" /></tr></thead>
            {byDays(rows).map((group) => (
            <tbody key={group.key} aria-label={`${timeWords(group.from, group.to)}: ${group.rows.length} người nghỉ`}>
              {group.rows.map((r, i) => (
                <tr key={r.id} title="Mở bảng công ngày này" onClick={(e) => { if (!isOwnControl(e.target)) navigate(sheetLink(r.from, r.employeeId)); }} className={`cursor-pointer border-b ${r.id === editingId ? 'bg-blue-50' : ''}`}>
                  <td className="p-2 font-medium"><CopyValue text={r.fullName} label="họ tên"><span className="pr-7">{r.fullName}</span></CopyValue></td>
                  <td className="p-2"><span className="flex items-center gap-2"><KindMark code={r.code} reason={r.reason} /><span>{r.label}</span>{isMissingPaper(r) && <MissingPaper />}<BatchMark row={r} /></span></td>
                  {i === 0 && <TimeCell group={group} crowded={crowdOf(group, list.data ?? [], people)} />}
                  <td className="p-2"><span className="inline-flex h-5 items-center rounded-full bg-blue-50 px-2 text-xs font-semibold text-blue-800 tabular-nums">{String(r.days).replace('.', ',')} ngày</span></td>
                  <td className="p-2 text-slate-600">{countingWords(r.code)}</td>
                  <td className="p-2"><Approval row={r} /></td>
                  <td className="max-w-80 p-2"><CopyValue text={r.handover} label="bàn giao"><FitText text={r.handover || '-'} limit={40} className="min-w-0 pr-7" /></CopyValue></td>
                  <td className="max-w-80 p-2"><CopyValue text={r.note} label="ghi chú"><FitText text={r.note || '-'} limit={40} className="min-w-0 pr-7" /></CopyValue></td>
                  <td className={`sticky right-0 p-2 text-right ${r.id === editingId ? 'bg-blue-50' : 'bg-white'}`}>
                    <span className="inline-flex gap-1">
                        {r.source !== 'sheet' && <button type="button" aria-label={`Giấy tờ (${r.files.length}) ${r.fullName} ${show(r.from)}`} onClick={() => onPapers(paperTargetOf(r))} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50 max-md:h-11 max-md:min-w-11 max-md:justify-center"><Paperclip className="size-3.5 text-blue-600" /><span className="max-md:sr-only">Giấy tờ </span>({r.files.length})</button>}
                        {!r.batch && (r.source !== 'sheet' || sheetLineForm(r)) && <button type="button" aria-label={`Sửa ${r.fullName} ${show(r.from)}`} onClick={() => onEdit(r)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-slate-50 max-md:size-11 max-md:justify-center max-md:px-0"><Pencil className="size-3.5 text-blue-600" /><span className="max-md:sr-only">Sửa</span></button>}
                        {!r.batch && <button type="button" aria-label={`${r.source === 'sheet' ? 'Xoá' : 'Huỷ'} ${r.fullName} ${show(r.from)}`} disabled={isRemoving} onClick={() => setRemoving(r)} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium hover:bg-red-50 max-md:size-11 max-md:justify-center max-md:px-0"><Trash2 className="size-3.5 text-red-600" /><span className="max-md:sr-only">{r.source === 'sheet' ? 'Xoá' : 'Huỷ'}</span></button>}
                      </span>
                  </td>
                </tr>
              ))}
            </tbody>
            ))}
          </table>
        </div>
      )}
      {!!removeError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(removeError)}</p>}
      <ConfirmDialog open={!!removing} title={removing?.source === 'sheet' ? `Xoá ${removing.label} của ${removing.fullName}, ${show(removing.from)}${removing.to !== removing.from ? `–${show(removing.to)}` : ''}? Các ô trên bảng công về trống.` : `Huỷ ${removing?.label ?? ''} của ${removing?.fullName ?? ''}? Bảng công về như cũ.`} confirmLabel={removing?.source === 'sheet' ? 'Xoá các ô này' : 'Huỷ dòng này'} isBusy={isRemoving} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) onRemove(removing); setRemoving(null); }} />
    </section>
  );
}
