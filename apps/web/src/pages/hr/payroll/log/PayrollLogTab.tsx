import { History, Search, UserRound, Users, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { PayrollLogLineDto } from '../../../../api';
import { ErrorState } from '../../../../ui/feedback';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../../parts';
import { SELECT } from '../../timesheet/AbsenceFilterBar';
import { TabSkeleton } from '../../timesheet/skeletons';
import { MultiFilter } from '../../timesheet/toolbar';
import { PeriodControl } from '../PeriodControl';
import { monthKeyOf } from '../payrollModel';
import { useProfiles } from '../profiles/profileQueries';
import { usePayrollLog } from '../queries';
import { LOG_GROUPS, LogLine } from './LogLine';
import {
  isLogFiltered,
  linksOf,
  LOG_PARAMS,
  logFiltersFrom,
  logQueryOf,
  monthWords,
  type LogFilters,
  type LogGroup,
  type LogPerson,
} from './logModel';

/**
 * Nhật ký lương (spec-luong.md 4.1, 4.2, 4.4, 11.9): one log on the page itself. The pay month of the page by
 * default, or every month; a group, a person, who did it and typed words narrow it, all kept in the address.
 */

const VIETNAM = 'Asia/Ho_Chi_Minh';
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: VIETNAM, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayOf = (iso: string) => DAY.format(new Date(iso));

function dayHeading(day: string, now: Date) {
  const shown = day.split('-').reverse().join('/');
  if (day === dayOf(now.toISOString())) return `Hôm nay, ${shown}`;
  if (day === dayOf(new Date(now.getTime() - 86_400_000).toISOString())) return `Hôm qua, ${shown}`;
  return shown;
}

/** Newest first already: lines of one day stay together. */
function byDay(lines: readonly PayrollLogLineDto[]) {
  return lines.reduce<{ day: string; lines: PayrollLogLineDto[] }[]>((days, line) => {
    const day = dayOf(line.at);
    const last = days.at(-1);
    return last?.day === day
      ? [...days.slice(0, -1), { day, lines: [...last.lines, line] }]
      : [...days, { day, lines: [line] }];
  }, []);
}

/** The filters live in the address, so a view can be sent or reopened. */
function useLogFilters() {
  const [params, setParams] = useSearchParams();
  const write = (change: (next: URLSearchParams) => void) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        change(next);
        return next;
      },
      { replace: true },
    );
  const put = (name: string, value: string) => write((next) => (value ? next.set(name, value) : next.delete(name)));
  return {
    filters: logFiltersFrom(params),
    setGroup: (group: LogGroup | null) => put(LOG_PARAMS.group, group ?? ''),
    setEveryMonth: (isOn: boolean) => put(LOG_PARAMS.everyMonth, isOn ? '1' : ''),
    setPerson: (code: string) => put(LOG_PARAMS.person, code),
    setActor: (actor: string) => put(LOG_PARAMS.actor, actor),
    setSearch: (words: string) => put(LOG_PARAMS.search, words.trim()),
    /** A month picked is a month asked for: "Tất cả các kỳ" goes off. */
    setPeriod: (year: number, month: number) =>
      write((next) => {
        next.set('ky', monthKeyOf(year, month));
        next.delete(LOG_PARAMS.everyMonth);
      }),
    clear: () => write((next) => Object.values(LOG_PARAMS).forEach((name) => next.delete(name))),
  };
}

const SEARCH_WAIT = 300;

/** What is typed is asked for a moment after typing stops; the box follows the address when it changes elsewhere. */
function useTypedSearch(search: string, onSearch: (words: string) => void) {
  const [typed, setTyped] = useState(search);
  // The wait outlives a render: it must save over the filters of its moment, not those it started with.
  const save = useRef(onSearch);
  save.current = onSearch;
  useEffect(() => {
    if (typed.trim() === search) return undefined;
    const wait = window.setTimeout(() => save.current(typed), SEARCH_WAIT);
    return () => window.clearTimeout(wait);
    // Only what HR types starts a search.
  }, [typed]);
  useEffect(() => {
    setTyped((current) => (current.trim() === search ? current : search));
  }, [search]);
  return [typed, setTyped] as const;
}

function Chip(p: { label: string; icon: LucideIcon; isOn: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={p.isOn}
      onClick={p.onPick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap max-sm:h-11 ${p.isOn ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
    >
      <p.icon aria-hidden="true" className="size-4" />
      {p.label}
    </button>
  );
}

function Choice(p: {
  label: string;
  icon: LucideIcon;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  // What the address asks for stays a choice even when the list does not have it (yet).
  const options =
    p.value && !p.options.some((o) => o.value === p.value)
      ? [...p.options, { value: p.value, label: p.value }]
      : p.options;
  return (
    <label className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-700 max-md:w-full">
      <p.icon aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
      <select
        aria-label={p.label}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        className={`${SELECT} max-w-96 max-md:max-w-none max-md:flex-1`}
      >
        <option value="">{`${p.label}: tất cả`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The people of the popover picker (as Bảng lương's): a name is never cut, which a phone's own select does. The log
 * asks for one person, so picking another replaces the one picked. A code the address asks for stays a choice.
 */
function personItems(people: readonly LogPerson[], picked: string) {
  const items = people.map((p) => ({ value: p.code, label: `${p.code} · ${p.fullName}` }));
  return picked && !items.some((i) => i.value === picked) ? [...items, { value: picked, label: picked }] : items;
}

interface FilterBarProps {
  period: { year: number; month: number };
  filters: LogFilters;
  people: readonly LogPerson[];
  actors: readonly string[];
  set: ReturnType<typeof useLogFilters>;
}

function SearchBox({ search, onSearch }: { search: string; onSearch: (words: string) => void }) {
  const [typed, setTyped] = useTypedSearch(search, onSearch);
  return (
    <label className="relative ml-auto w-64 max-w-full max-md:ml-0 max-md:w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500"
      />
      <Input
        aria-label="Tìm trong nhật ký"
        value={typed}
        placeholder="Tìm mã, tên, việc, người làm"
        onChange={(e) => setTyped(e.target.value)}
        className="bg-white pl-8"
      />
    </label>
  );
}

function GroupChips({ group, onGroup }: { group: LogGroup | null; onGroup: (group: LogGroup | null) => void }) {
  return (
    <div role="group" aria-label="Lọc theo nhóm" className="flex min-w-0 gap-2 overflow-x-auto">
      <Chip label="Tất cả" icon={History} isOn={!group} onPick={() => onGroup(null)} />
      {LOG_GROUPS.map((g) => (
        <Chip key={g.id} label={g.label} icon={g.icon} isOn={group === g.id} onPick={() => onGroup(g.id)} />
      ))}
    </div>
  );
}

function LogFilterBar({ period, filters, people, actors, set }: FilterBarProps) {
  return (
    <section aria-label="Lọc nhật ký" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={filters.isEveryMonth ? 'opacity-60' : ''}>
          <PeriodControl year={period.year} month={period.month} onPeriod={set.setPeriod} />
        </span>
        <Chip
          label="Tất cả các kỳ"
          icon={History}
          isOn={filters.isEveryMonth}
          onPick={() => set.setEveryMonth(!filters.isEveryMonth)}
        />
        <MultiFilter
          label="Nhân viên"
          icon={Users}
          items={personItems(people, filters.personCode)}
          picked={filters.personCode ? [filters.personCode] : []}
          onChange={(next) => set.setPerson(next.find((code) => code !== filters.personCode) ?? '')}
          isSearchable
        />
        <Choice
          label="Người làm"
          icon={UserRound}
          value={filters.actor}
          options={actors.map((a) => ({ value: a, label: a }))}
          onChange={set.setActor}
        />
        <SearchBox search={filters.search} onSearch={set.setSearch} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GroupChips group={filters.group} onGroup={set.setGroup} />
        {isLogFiltered(filters) && <ClearButton onClear={set.clear} />}
      </div>
    </section>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="ts-field inline-flex items-center gap-1.5 rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
    >
      <X aria-hidden="true" className="size-4" />
      Xoá lọc
    </button>
  );
}

const WIDE =
  'ts-field inline-flex items-center justify-center rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-50';

/** Nothing to show: say whether the filters or the month are why, with the way out next to it. */
function Nothing({ filters, pageMonth, set }: { filters: LogFilters; pageMonth: string; set: FilterBarProps['set'] }) {
  const isNarrowed =
    filters.group !== null || filters.personCode !== '' || filters.actor !== '' || filters.search !== '';
  const words = () => {
    if (isNarrowed) return 'Không có dòng nào khớp.';
    return filters.isEveryMonth ? 'Chưa có thay đổi nào.' : `Chưa có thay đổi nào trong kỳ ${monthWords(pageMonth)}.`;
  };
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-600">
      <p className="m-0 text-center">{words()}</p>
      {isNarrowed && <ClearButton onClear={set.clear} />}
      {!isNarrowed && !filters.isEveryMonth && (
        <button type="button" onClick={() => set.setEveryMonth(true)} className={WIDE}>
          Xem tất cả các kỳ
        </button>
      )}
    </div>
  );
}

export function PayrollLogTab({ period }: { period: { year: number; month: number } }) {
  const set = useLogFilters();
  const { filters } = set;
  const pageMonth = monthKeyOf(period.year, period.month);
  const { offset: _, ...query } = logQueryOf(filters, pageMonth, 0);
  const log = usePayrollLog(query);
  const profiles = useProfiles().data;
  const people = useMemo<LogPerson[]>(
    () => [...(profiles?.people ?? [])].sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })),
    [profiles],
  );
  const lines = log.data?.pages.flatMap((p) => p.lines) ?? [];
  const actors = log.data?.pages[0]?.actors ?? [];
  return (
    <section aria-label="Nhật ký lương" className="ts-card flex flex-col gap-3 p-4 max-sm:p-3">
      <LogFilterBar period={period} filters={filters} people={people} actors={actors} set={set} />
      {log.isPending && <TabSkeleton />}
      {log.isError && (
        <div className="ts-site-tokens">
          <ErrorState onRetry={() => void log.refetch()} message={errorMessage(log.error)} />
        </div>
      )}
      {log.isSuccess && lines.length === 0 && <Nothing filters={filters} pageMonth={pageMonth} set={set} />}
      {byDay(lines).map((group) => (
        <section key={group.day} aria-label={group.day} className="flex flex-col">
          <h3 className="m-0 rounded-md bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
            {dayHeading(group.day, new Date())}
          </h3>
          <ol className="m-0 flex list-none flex-col p-0">
            {group.lines.map((line) => (
              <LogLine key={line.id} line={line} links={linksOf(line, people, pageMonth)} />
            ))}
          </ol>
        </section>
      ))}
      {log.hasNextPage && (
        <button
          type="button"
          disabled={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
          className={`${WIDE} mx-auto`}
        >
          {log.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
