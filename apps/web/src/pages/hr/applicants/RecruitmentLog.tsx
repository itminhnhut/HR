import {
  RECRUITMENT_LOG_GROUP_LABEL,
  RECRUITMENT_LOG_GROUPS,
  type RecruitmentLogGroup,
  type RecruitmentLogLineDto,
} from '@careers/shared';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Clock,
  Eye,
  FileText,
  Gauge,
  History,
  Layers,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Tag,
  Trash2,
  Undo2,
  UserCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useRecruitmentLog } from '../../../api/queries';
import { ErrorState, LoadingStatus } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { applicantLink } from './applicantLink';

const GROUP_ICON: Record<RecruitmentLogGroup, LucideIcon> = {
  'ho-so': FileText,
  'trang-thai': Layers,
  'phong-van': CalendarClock,
  'ghi-chu': MessageSquare,
  'lien-he': Mail,
  'sep-duyet': UserCheck,
  'cham-cv': Gauge,
  nguon: Tag,
};

const ADDED = 'border-emerald-200 bg-emerald-50 text-emerald-700';
const CHANGED = 'border-blue-200 bg-blue-50 text-blue-700';
const REMOVED = 'border-red-200 bg-red-50 text-red-700';
const WARNED = 'border-amber-300 bg-amber-50 text-amber-800';

/** What was done, at a glance: by the word the action starts with. */
const ACTION_LOOKS: { starts: string; icon: LucideIcon; tone: string }[] = [
  { starts: 'Thêm', icon: Plus, tone: ADDED },
  { starts: 'Nộp', icon: Plus, tone: ADDED },
  { starts: 'Gửi', icon: Send, tone: ADDED },
  { starts: 'Sửa', icon: Pencil, tone: CHANGED },
  { starts: 'Đổi', icon: Pencil, tone: CHANGED },
  { starts: 'Soạn', icon: Mail, tone: CHANGED },
  { starts: 'Trả lời', icon: MessageSquare, tone: CHANGED },
  { starts: 'Chấm', icon: Gauge, tone: CHANGED },
  { starts: 'Sếp', icon: UserCheck, tone: 'border-teal-200 bg-teal-50 text-teal-700' },
  { starts: 'Ẩn', icon: Eye, tone: WARNED },
  { starts: 'Hiện', icon: Eye, tone: WARNED },
  { starts: 'Hoàn tác', icon: Undo2, tone: WARNED },
  { starts: 'Vẫn hẹn', icon: AlertTriangle, tone: WARNED },
  { starts: 'Xoá', icon: Trash2, tone: REMOVED },
  { starts: 'Bỏ', icon: Trash2, tone: REMOVED },
];
const lookOf = (action: string) =>
  ACTION_LOOKS.find((l) => action.startsWith(l.starts)) ?? {
    icon: History,
    tone: 'border-slate-200 bg-slate-50 text-slate-600',
  };

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
function byDay(lines: readonly RecruitmentLogLineDto[]) {
  return lines.reduce<{ day: string; lines: RecruitmentLogLineDto[] }[]>((days, line) => {
    const day = dayOf(line.at);
    const last = days.at(-1);
    return last?.day === day
      ? [...days.slice(0, -1), { day, lines: [...last.lines, line] }]
      : [...days, { day, lines: [line] }];
  }, []);
}

/** Whose application: a link to open it, "Ứng viên đã xoá" once it is gone, nothing for a source. */
function Subject({ line }: { line: RecruitmentLogLineDto }) {
  if (line.isDeleted) {
    const job = line.jobTitle ? ` (vị trí ${line.jobTitle})` : '';
    return <span className="text-sm italic text-muted">{`Ứng viên đã xoá${job}`}</span>;
  }
  if (!line.applicationId) return null;
  return (
    <Link
      to={applicantLink(line.applicationId, 'all')}
      className="w-fit text-sm font-medium text-link underline-offset-2 hover:underline [overflow-wrap:anywhere]"
    >
      {line.candidateName}
      {line.jobTitle && <span className="font-normal text-muted"> · {line.jobTitle}</span>}
    </Link>
  );
}

function Change({ line }: { line: RecruitmentLogLineDto }) {
  const { from, to } = line;
  if (!from && !to) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 whitespace-pre-line text-sm [overflow-wrap:anywhere]">
      {from && <span className={to ? 'text-muted' : 'text-muted line-through'}>{from}</span>}
      {from && to && <ArrowRight aria-label="thành" className="size-3.5 shrink-0 text-blue-600" />}
      {to && <span className="font-medium text-navy">{to}</span>}
    </span>
  );
}

function LogLine({ line }: { line: RecruitmentLogLineDto }) {
  const look = lookOf(line.action);
  const GroupIcon = GROUP_ICON[line.group];
  return (
    <li className="flex gap-3 border-b border-line-soft px-2 py-3 last:border-b-0">
      <span
        aria-hidden="true"
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border ${look.tone}`}
      >
        <look.icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-navy">{line.action}</span>
          <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-white px-2 text-xs text-body">
            <GroupIcon aria-hidden="true" className="size-3" />
            {RECRUITMENT_LOG_GROUP_LABEL[line.group]}
          </span>
          <span className="ml-auto inline-flex items-center gap-3 whitespace-nowrap text-xs text-muted max-sm:ml-0">
            <span className="inline-flex items-center gap-1">
              <UserRound aria-hidden="true" className="size-3.5" />
              {line.actor}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock aria-hidden="true" className="size-3.5" />
              {TIME.format(new Date(line.at))}
            </span>
          </span>
        </div>
        <Subject line={line} />
        <Change line={line} />
        {line.detail && (
          <span className="whitespace-pre-line text-sm text-body [overflow-wrap:anywhere]">{line.detail}</span>
        )}
      </div>
    </li>
  );
}

function FilterChip({
  label,
  icon: Icon,
  isOn,
  onPick,
}: {
  label: string;
  icon: LucideIcon;
  isOn: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isOn}
      onClick={onPick}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium lg:min-h-9 ${isOn ? 'border-accent bg-accent text-white' : 'border-line bg-white text-body hover:bg-tint'}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

const SEARCH_WAIT = 300;
const isGroup = (v: string | null): v is RecruitmentLogGroup => RECRUITMENT_LOG_GROUPS.some((g) => g === v);

/** Filters live in the address, so a view can be sent or reopened. */
function useLogFilters() {
  const [params, setParams] = useSearchParams();
  const asked = params.get('nhom');
  const change = (key: string, value: string | undefined) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  return {
    group: isGroup(asked) ? asked : undefined,
    search: params.get('tim') ?? '',
    setGroup: (group: RecruitmentLogGroup | undefined) => change('nhom', group),
    setSearch: (words: string) => change('tim', words.trim() || undefined),
  };
}

/** What HR types is searched a moment after typing stops. */
function useTypedSearch(search: string, setSearch: (words: string) => void) {
  const [typed, setTyped] = useState(search);
  // The wait outlives a render: it must save over the filters of its moment, not those it started with.
  const save = useRef(setSearch);
  save.current = setSearch;
  useEffect(() => {
    if (typed.trim() === search) return undefined;
    const wait = window.setTimeout(() => save.current(typed), SEARCH_WAIT);
    return () => window.clearTimeout(wait);
    // Only what HR types starts a search.
  }, [typed]);
  return [typed, setTyped] as const;
}

function Filters({
  filters,
  typed,
  onType,
}: {
  filters: ReturnType<typeof useLogFilters>;
  typed: string;
  onType: (v: string) => void;
}) {
  const { group, setGroup } = filters;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Lọc theo nhóm việc" className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
        <FilterChip label="Tất cả" icon={History} isOn={!group} onPick={() => setGroup(undefined)} />
        {RECRUITMENT_LOG_GROUPS.map((g) => (
          <FilterChip
            key={g}
            label={RECRUITMENT_LOG_GROUP_LABEL[g]}
            icon={GROUP_ICON[g]}
            isOn={group === g}
            onPick={() => setGroup(g)}
          />
        ))}
      </div>
      <label className="field-focus relative flex min-h-11 w-full items-center gap-2 rounded-control border border-field bg-white px-3 lg:ml-auto lg:w-72">
        <Search aria-hidden="true" className="size-4 shrink-0 text-slate" />
        <input
          type="search"
          aria-label="Tìm trong nhật ký"
          value={typed}
          placeholder="Tìm tên, người làm, nội dung"
          onChange={(e) => onType(e.target.value)}
          className="w-full min-w-0 flex-1 border-0 bg-transparent text-sm text-navy outline-none placeholder:text-placeholder"
        />
      </label>
    </div>
  );
}

/** "Nhật ký tuyển dụng" (spec-nhat-ky-ho-so.md): who did what in the applicants area, day by day. */
export function RecruitmentLog() {
  const filters = useLogFilters();
  const [typed, setTyped] = useTypedSearch(filters.search, filters.setSearch);
  const log = useRecruitmentLog(filters.group, filters.search);
  const lines = log.data?.pages.flatMap((p) => p.lines) ?? [];
  const isFiltered = !!filters.group || !!filters.search;
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-white p-3 sm:p-4">
      <Filters filters={filters} typed={typed} onType={setTyped} />
      {log.isPending && <LoadingStatus />}
      {log.isError && <ErrorState onRetry={() => log.refetch()} message={errorMessage(log.error)} />}
      {log.isSuccess && lines.length === 0 && (
        <p className="m-0 py-10 text-center text-sm text-muted">
          {isFiltered ? 'Không có dòng nào khớp.' : 'Chưa có thay đổi nào.'}
        </p>
      )}
      {byDay(lines).map((group) => (
        <section key={group.day} aria-label={group.day} className="flex flex-col">
          <h2 className="m-0 rounded-md bg-mist px-3 py-1.5 text-sm font-semibold text-body">
            {dayHeading(group.day, new Date())}
          </h2>
          <ol className="m-0 flex list-none flex-col p-0">
            {group.lines.map((line) => (
              <LogLine key={line.id} line={line} />
            ))}
          </ol>
        </section>
      ))}
      {log.hasNextPage && (
        <button
          type="button"
          disabled={log.isFetchingNextPage}
          onClick={() => void log.fetchNextPage()}
          className="mx-auto inline-flex min-h-11 items-center justify-center rounded-control border border-field bg-white px-4 text-sm font-medium text-navy hover:bg-tint disabled:opacity-50"
        >
          {log.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
        </button>
      )}
    </section>
  );
}
