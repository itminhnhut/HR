import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Banknote,
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  Download,
  Eye,
  History,
  IdCard,
  KeyRound,
  LockOpen,
  Pencil,
  Plus,
  Settings,
  Sheet,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import type { PayrollLogLineDto } from '../../../../api';
import type { LogGroup, LogLink } from './logModel';

/** One line of Nhật ký lương (spec 11.9): an icon by what was done, the group, who, when, old → new, and its links. */

export const LOG_GROUPS: { id: LogGroup; label: string; icon: LucideIcon; tone: string }[] = [
  { id: 'bang-luong', label: 'Bảng lương', icon: Sheet, tone: 'border-blue-200 bg-blue-50 text-blue-800' },
  { id: 'duyet', label: 'Duyệt, chuyển khoản', icon: BadgeCheck, tone: 'border-teal-200 bg-teal-50 text-teal-800' },
  { id: 'ho-so', label: 'Hồ sơ lương', icon: IdCard, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { id: 'cau-hinh', label: 'Cấu hình', icon: Settings, tone: 'border-slate-300 bg-slate-100 text-slate-700' },
  { id: 'tai-xem', label: 'Tải và xem', icon: Eye, tone: 'border-violet-200 bg-violet-50 text-violet-800' },
  { id: 'quyen', label: 'Quyền', icon: KeyRound, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  { id: 'cham-cong', label: 'Chấm công', icon: CalendarDays, tone: 'border-sky-200 bg-sky-50 text-sky-800' },
];

const ADDED = 'border-emerald-200 bg-emerald-50 text-emerald-700';
const CHANGED = 'border-blue-200 bg-blue-50 text-blue-700';
const REMOVED = 'border-red-200 bg-red-50 text-red-700';
const WARNED = 'border-amber-300 bg-amber-50 text-amber-800';
const SEALED = 'border-teal-200 bg-teal-50 text-teal-700';
const SEEN = 'border-violet-200 bg-violet-50 text-violet-700';
const PLAIN = { icon: History, tone: 'border-slate-200 bg-slate-50 text-slate-600' };

/** What was done, at a glance: by the words the action starts with. */
const ACTION_LOOKS: { starts: string; icon: LucideIcon; tone: string }[] = [
  { starts: 'Thêm', icon: Plus, tone: ADDED },
  { starts: 'Cấp quyền', icon: KeyRound, tone: ADDED },
  { starts: 'Xác nhận', icon: Check, tone: ADDED },
  { starts: 'Sửa', icon: Pencil, tone: CHANGED },
  { starts: 'Đổi quyền', icon: KeyRound, tone: CHANGED },
  { starts: 'Xoá', icon: Trash2, tone: REMOVED },
  { starts: 'Bỏ', icon: Ban, tone: REMOVED },
  { starts: 'Ngừng', icon: Ban, tone: WARNED },
  { starts: 'Mở lại', icon: LockOpen, tone: WARNED },
  { starts: 'Kỳ công mở lại', icon: LockOpen, tone: WARNED },
  { starts: 'Duyệt', icon: BadgeCheck, tone: SEALED },
  { starts: 'Đã chuyển khoản', icon: Banknote, tone: SEALED },
  { starts: 'Kỳ công chốt', icon: CalendarCheck, tone: SEALED },
  { starts: 'Tải', icon: Download, tone: SEEN },
  { starts: 'Hiện', icon: Eye, tone: SEEN },
  { starts: 'Xem', icon: Eye, tone: SEEN },
];
const lookOf = (action: string) => ACTION_LOOKS.find((l) => action.startsWith(l.starts)) ?? PLAIN;

const LINK_ICONS: Record<LogLink['kind'], LucideIcon> = {
  person: IdCard,
  month: CalendarDays,
  setting: Settings,
  cell: Sheet,
  rights: KeyRound,
  timesheet: CalendarCheck,
};

const TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "Việc của ai: A → B; C → D": the head, then one change a row, each step of a change apart. */
function detailParts(detail: string) {
  const colon = detail.indexOf(': ');
  const subject = colon > 0 ? detail.slice(0, colon) : '';
  const rest = colon > 0 ? detail.slice(colon + 2) : detail;
  return { subject, changes: rest.split('; ').map((change) => change.split(' → ')) };
}

function LogDetail({ detail }: { detail: string }) {
  const { subject, changes } = detailParts(detail);
  return (
    <div className="flex flex-col gap-0.5 text-sm text-slate-700">
      {subject && <span className="font-medium break-words text-slate-900">{subject}</span>}
      {changes.map((steps, i) => (
        <span key={i} className="flex flex-wrap items-center gap-x-1.5 break-words">
          {steps.map((step, at) => {
            const isLast = at === steps.length - 1;
            return (
              <span key={at} className="inline-flex items-center gap-x-1.5">
                <span className={isLast && steps.length > 1 ? 'font-medium text-slate-900' : ''}>{step}</span>
                {!isLast && <ArrowRight aria-label="thành" className="size-3.5 shrink-0 text-blue-600" />}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

const LINK =
  'inline-flex min-h-7 items-center gap-1 rounded-full border border-blue-200 bg-white px-2 text-xs font-medium whitespace-nowrap text-blue-700 no-underline hover:bg-blue-50 hover:text-blue-800 max-sm:min-h-9';

function LogLinks({ links }: { links: readonly LogLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {links.map((link) => {
        const Icon = LINK_ICONS[link.kind];
        return (
          <Link
            key={`${link.kind}-${link.to}`}
            to={link.to}
            aria-label={link.kind === 'person' ? `Hồ sơ lương của ${link.label}` : undefined}
            className={LINK}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

export function LogLine({ line, links }: { line: PayrollLogLineDto; links: readonly LogLink[] }) {
  const look = lookOf(line.action);
  const group = LOG_GROUPS.find((g) => g.id === line.area);
  return (
    <li className="flex gap-3 rounded-md border-b px-2 py-3 last:border-b-0 hover:bg-blue-50">
      <span
        aria-hidden="true"
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border ${look.tone}`}
      >
        <look.icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{line.action}</span>
          {group && (
            <span
              className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap ${group.tone}`}
            >
              <group.icon aria-hidden="true" className="size-3" />
              {group.label}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-3 text-xs whitespace-nowrap text-slate-600 max-sm:ml-0">
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
        <LogDetail detail={line.detail} />
        <LogLinks links={links} />
      </div>
    </li>
  );
}
