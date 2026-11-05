import { ATTENDANCE_LABEL, type AttendanceCode, type TimesheetLogArea, type TimesheetLogLineDto } from '@careers/shared';
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarDays, CalendarOff, CalendarPlus, Clock, Flag, History, Lock, LockOpen, Pencil, Plus, Search, Settings, SlidersHorizontal, Trash2, UserRound, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { useTimesheetLog } from './queries';
import { TabSkeleton } from './skeletons';

const AREAS: { id: TimesheetLogArea; label: string; icon: LucideIcon; tone: string }[] = [
  { id: 'bang-cong', label: 'Bảng công', icon: CalendarDays, tone: 'border-blue-200 bg-blue-50 text-blue-800' },
  { id: 'nghi', label: 'Nghỉ, đi muộn', icon: CalendarOff, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  { id: 'nhan-vien', label: 'Nhân viên', icon: Users, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { id: 'cau-hinh', label: 'Cấu hình', icon: Settings, tone: 'border-slate-300 bg-slate-100 text-slate-700' },
];

const ADDED = 'border-emerald-200 bg-emerald-50 text-emerald-700';
const CHANGED = 'border-blue-200 bg-blue-50 text-blue-700';
const REMOVED = 'border-red-200 bg-red-50 text-red-700';
const WARNED = 'border-amber-300 bg-amber-50 text-amber-800';

/** What was done, at a glance: by the word the action starts with. */
const ACTION_LOOKS: { starts: string; icon: LucideIcon; tone: string }[] = [
  { starts: 'Thêm', icon: Plus, tone: ADDED },
  { starts: 'Đăng ký', icon: CalendarPlus, tone: ADDED },
  { starts: 'Lưu', icon: Flag, tone: ADDED },
  { starts: 'Chấm công', icon: CalendarCheck, tone: CHANGED },
  { starts: 'Sửa', icon: Pencil, tone: CHANGED },
  { starts: 'Xoá', icon: Trash2, tone: REMOVED },
  { starts: 'Huỷ', icon: Trash2, tone: REMOVED },
  { starts: 'Bỏ', icon: Trash2, tone: REMOVED },
  { starts: 'Điều chỉnh', icon: SlidersHorizontal, tone: WARNED },
  { starts: 'Chênh lệch', icon: AlertTriangle, tone: WARNED },
  { starts: 'Mở lại', icon: LockOpen, tone: WARNED },
  { starts: 'Chốt', icon: Lock, tone: 'border-teal-200 bg-teal-50 text-teal-700' },
];
const lookOf = (action: string) => ACTION_LOOKS.find((l) => action.startsWith(l.starts)) ?? { icon: History, tone: 'border-slate-200 bg-slate-50 text-slate-600' };

const VIETNAM = 'Asia/Ho_Chi_Minh';
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: VIETNAM, year: 'numeric', month: '2-digit', day: '2-digit' });
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: VIETNAM, hour: '2-digit', minute: '2-digit', hour12: false });
const dayOf = (iso: string) => DAY.format(new Date(iso));

function dayHeading(day: string, now: Date) {
  const shown = day.split('-').reverse().join('/');
  if (day === dayOf(now.toISOString())) return `Hôm nay, ${shown}`;
  if (day === dayOf(new Date(now.getTime() - 86_400_000).toISOString())) return `Hôm qua, ${shown}`;
  return shown;
}

/** Newest first already: lines of one day stay together. */
function byDay(lines: readonly TimesheetLogLineDto[]) {
  return lines.reduce<{ day: string; lines: TimesheetLogLineDto[] }[]>((days, line) => {
    const day = dayOf(line.at);
    const last = days.at(-1);
    return last?.day === day ? [...days.slice(0, -1), { day, lines: [...last.lines, line] }] : [...days, { day, lines: [line] }];
  }, []);
}

/** "Mã Tên: Bộ phận A → B; Ngày C → D" reads as who, then one change a line. */
export function detailParts(detail: string) {
  const colon = detail.indexOf(': ');
  const subject = colon > 0 ? detail.slice(0, colon) : '';
  const rest = colon > 0 ? detail.slice(colon + 2) : detail;
  return { subject, changes: rest.split('; ').map((part) => part.split(' → ')) };
}

/** A code on the sheet, with what it means. */
const inWords = (code: string) => {
  const label = ATTENDANCE_LABEL[code as AttendanceCode];
  return label ? `${code} (${label})` : code;
};

function LogDetail({ detail, isCell }: { detail: string; isCell: boolean }) {
  const { subject, changes } = detailParts(detail);
  const shown = (value: string) => (isCell ? inWords(value) : value);
  return (
    <div className="flex flex-col gap-0.5 text-sm text-slate-700">
      {subject && <span className="font-medium text-slate-900">{subject}</span>}
      {changes.map(([before, after], i) => (
        <span key={i} className="flex flex-wrap items-center gap-x-1.5 break-words">
          <span className={after ? 'text-slate-500' : ''}>{after ? shown(before ?? '') : before}</span>
          {after && <ArrowRight aria-label="thành" className="size-3.5 shrink-0 text-blue-600" />}
          {after && <span className="font-medium text-slate-900">{shown(after)}</span>}
        </span>
      ))}
    </div>
  );
}

function LogLine({ line }: { line: TimesheetLogLineDto }) {
  const look = lookOf(line.action);
  const area = AREAS.find((a) => a.id === line.area);
  return (
    <li className="flex gap-3 border-b py-3 last:border-b-0">
      <span aria-hidden="true" className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border ${look.tone}`}><look.icon className="size-4" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{line.action}</span>
          {area && <span className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap ${area.tone}`}><area.icon className="size-3" />{area.label}</span>}
          {line.periodMonth && <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-white px-2 text-xs font-medium whitespace-nowrap text-slate-700">Kỳ T{Number(line.periodMonth.slice(5))}/{line.periodMonth.slice(0, 4)}</span>}
          <span className="ml-auto inline-flex items-center gap-3 text-xs whitespace-nowrap text-slate-600 max-sm:ml-0">
            <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{line.actor}</span>
            <span className="inline-flex items-center gap-1 tabular-nums"><Clock className="size-3.5" />{TIME.format(new Date(line.at))}</span>
          </span>
        </div>
        <LogDetail detail={line.detail} isCell={line.action === 'Chấm công'} />
      </div>
    </li>
  );
}

function FilterChip({ label, icon: Icon, isOn, onPick }: { label: string; icon: LucideIcon; isOn: boolean; onPick: () => void }) {
  return (
    <button type="button" aria-pressed={isOn} onClick={onPick} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap ${isOn ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
      <Icon className="size-4" />{label}
    </button>
  );
}

const SEARCH_WAIT = 300;

/** Filters live in the address, so a view can be sent or reopened. */
function useLogFilters() {
  const [params, setParams] = useSearchParams();
  const asked = params.get('nhom');
  const area = AREAS.find((a) => a.id === asked)?.id;
  const search = params.get('tim') ?? '';
  const change = (key: string, value: string | undefined) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  };
  return { area, search, setArea: (id: TimesheetLogArea | undefined) => change('nhom', id), setSearch: (words: string) => change('tim', words.trim() || undefined) };
}

export function LogTab() {
  const { area, search, setArea, setSearch } = useLogFilters();
  const [typed, setTyped] = useState(search);
  // The wait outlives a render: it must save over the filters of its moment, not those it started with.
  const saveSearch = useRef(setSearch);
  saveSearch.current = setSearch;
  useEffect(() => {
    if (typed.trim() === search) return undefined;
    const wait = window.setTimeout(() => saveSearch.current(typed), SEARCH_WAIT);
    return () => window.clearTimeout(wait);
    // Only what HR types starts a search.
  }, [typed]);
  const log = useTimesheetLog(area, search);
  const lines = log.data?.pages.flatMap((p) => p.lines) ?? [];
  const isFiltered = !!area || !!search;
  return (
    <section className="ts-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Lọc theo nơi thao tác" className="flex min-w-0 gap-2 overflow-x-auto">
          <FilterChip label="Tất cả" icon={History} isOn={!area} onPick={() => setArea(undefined)} />
          {AREAS.map((a) => <FilterChip key={a.id} label={a.label} icon={a.icon} isOn={area === a.id} onPick={() => setArea(a.id)} />)}
        </div>
        <label className="relative ml-auto w-72 max-w-full max-md:ml-0 max-md:w-full">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" />
          <Input aria-label="Tìm trong nhật ký" value={typed} placeholder="Tìm mã, tên, người làm" onChange={(e) => setTyped(e.target.value)} className="pl-8" />
        </label>
      </div>
      {log.isPending && <TabSkeleton />}
      {log.isError && <div className="ts-site-tokens"><ErrorState onRetry={() => log.refetch()} message={errorMessage(log.error)} /></div>}
      {log.isSuccess && lines.length === 0 && <p className="m-0 py-10 text-center text-sm text-slate-500">{isFiltered ? 'Không có dòng nào khớp.' : 'Chưa có thay đổi nào.'}</p>}
      {byDay(lines).map((group) => (
        <section key={group.day} aria-label={group.day} className="flex flex-col">
          <h3 className="m-0 rounded-md bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">{dayHeading(group.day, new Date())}</h3>
          <ol className="m-0 flex list-none flex-col p-0">{group.lines.map((line) => <LogLine key={line.id} line={line} />)}</ol>
        </section>
      ))}
      {log.hasNextPage && (
        <button type="button" disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()} className="ts-field mx-auto inline-flex items-center justify-center rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
          {log.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
