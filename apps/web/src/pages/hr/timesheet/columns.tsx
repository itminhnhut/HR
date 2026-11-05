import type { RegionTone, StaffType, TimesheetRegionDto } from '@careers/shared';
import { STAFF_TYPE_LABEL } from '@careers/shared';
import { Baby, Ban, Banknote, Calculator, CalendarCheck, CalendarDays, Check, CheckCircle2, Clock, Flag, Gift, Hourglass, Info, MapPin, Plane, ShieldCheck, Sun, Target, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { CODES } from '../../../vendor/shadcn-grid/lib/codes';
import { asNumber, type DayColumn, type GridRow } from './timesheetModel';

export const REGION_TONE: Record<RegionTone, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  rose: 'bg-rose-100 text-rose-800 border-rose-300',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  cyan: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
};

export function RegionBadge({ regionId, regions }: { regionId: unknown; regions: readonly TimesheetRegionDto[] }) {
  const region = regions.find((r) => r.id === regionId);
  return (
    <span className={`inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full border px-2 text-xs font-semibold whitespace-nowrap ${region ? REGION_TONE[region.tone] : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
      <MapPin className="size-3 shrink-0" />
      <span className="truncate">{region?.name ?? '—'}</span>
    </span>
  );
}

export function StaffBadge({ type }: { type: unknown }) {
  const isTrial = type === 'probation';
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap ${isTrial ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-green-300 bg-green-50 text-green-800'}`}>
      {isTrial ? <Hourglass className="size-3" /> : <ShieldCheck className="size-3" />}
      {STAFF_TYPE_LABEL[type as StaffType]}
    </span>
  );
}

/** Text cut to fit a column: the whole of it on hover, only when something was cut. */
export function FitText({ text, limit, className = '' }: { text: string; limit: number; className?: string }) {
  if (text.length <= limit) return <span className={`block truncate ${className}`}>{text}</span>;
  return (
    <Tooltip>
      <TooltipTrigger delay={200} render={<span className={`block truncate ${className}`} />}>{text}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

const head = (label: string, Icon?: LucideIcon, tone = 'text-slate-500') =>
  function Head() {
    return (
      <div className="flex h-full w-full items-center justify-center gap-1.5 text-xs font-medium leading-4 whitespace-nowrap">
        {Icon && <Icon className={`size-3.5 shrink-0 ${tone}`} />}
        <span>{label}</span>
      </div>
    );
  };

/** `stickyLeft`: a long band keeps its words next to the frozen columns while the days scroll under it. */
const band = (label: string, tone: string, Icon: LucideIcon, stickyLeft?: number) =>
  function Band() {
    const isSticky = stickyLeft !== undefined;
    return (
      <div className={`-mx-3 -my-1.5 flex h-8 items-center gap-1.5 text-xs font-bold tracking-wide whitespace-nowrap ${isSticky ? 'pl-2' : 'justify-center'} ${tone}`}>
        <span className="inline-flex items-center gap-1.5" style={isSticky ? { position: 'sticky', left: stickyLeft } : undefined}>
          <Icon className="size-3.5 shrink-0" />
          {label}
        </span>
      </div>
    );
  };

const plain = { enableSorting: false, enableHiding: false, enableResizing: false, enableCellEditing: false };
type CellArgs = { getValue: () => unknown; row: { original: GridRow } };

const info = (id: string, label: string, size: number, render: (value: unknown, row: GridRow) => ReactNode) => ({
  id, accessorKey: id, size, ...plain, header: head(label),
  cell: ({ getValue, row }: CellArgs) => render(getValue(), row.original),
});

const total = (id: string, label: string, cellClass: string, Icon: LucideIcon, iconTone: string) => ({
  id, accessorKey: id, size: Math.max(96, label.length * 6.6 + 50), ...plain, header: head(label, Icon, iconTone), meta: { label, cellClass },
  cell: ({ getValue }: CellArgs) => <span className="block text-right text-sm text-slate-800 tabular-nums">{asNumber(getValue())}</span>,
});

// Column tints give way to the selection: `!` would otherwise hide it.
const CONG = 'not-data-selected:bg-orange-50!';
const LUONG = 'not-data-selected:bg-green-50!';
const PHEP = 'not-data-selected:bg-yellow-50!';
const REGION_FULL_NAME = 6;

function infoColumns(regions: readonly TimesheetRegionDto[]) {
  const nameOf = (id: unknown) => regions.find((r) => r.id === id)?.name ?? '';
  return [
    info('stt', 'STT', 60, (v) => <span className="block text-center text-sm text-slate-600">{String(v)}</span>),
    info('ma', 'Mã NV', 72, (v) => <FitText text={String(v)} limit={8} className="text-sm text-slate-600" />),
    info('ten', 'Họ và tên', 176, (v) => <FitText text={String(v)} limit={22} className="text-sm font-medium" />),
    info('bp', 'Bộ phận', 120, (v) => <FitText text={String(v)} limit={15} className="text-sm" />),
    info('regionId', 'Khu vực', 96, (v) => nameOf(v).length <= REGION_FULL_NAME ? <RegionBadge regionId={v} regions={regions} /> : (
      <Tooltip>
        <TooltipTrigger delay={200} render={<span className="flex min-w-0" />}><RegionBadge regionId={v} regions={regions} /></TooltipTrigger>
        <TooltipContent>{nameOf(v)}</TooltipContent>
      </Tooltip>
    )),
  ];
}

function peopleGroups(regions: readonly TimesheetRegionDto[], pinned: readonly string[]) {
  const all = infoColumns(regions);
  const frozen = all.filter((c) => pinned.includes(c.id));
  const rest = all.filter((c) => !pinned.includes(c.id));
  return [
    { id: 'gInfo', enableSorting: false, header: band('THÔNG TIN NHÂN VIÊN', 'bg-red-600 text-white', Users), columns: frozen },
    {
      id: 'gMore', enableSorting: false, header: band(rest.length > 0 ? 'THÔNG TIN THÊM' : 'LOẠI', 'bg-slate-200 text-slate-700', rest.length > 0 ? Info : ShieldCheck),
      columns: [...rest, info('loai', 'Loại NV', 122, (v) => <StaffBadge type={v} />)],
    },
  ];
}

function dayGroup(days: readonly DayColumn[], today: string, stickyLeft: number, holidays: readonly { day: string; name: string }[]) {
  const holidayOn = (d: DayColumn) => holidays.find((h) => h.day === d.iso)?.name;
  const options = CODES.map((c) => ({ value: c.value, label: c.name }));
  const tint = (d: DayColumn) => (d.iso === today ? 'not-data-selected:bg-blue-50!' : holidayOn(d) ? 'not-data-selected:bg-teal-50!' : d.isWeekend ? 'not-data-selected:bg-amber-50!' : '');
  return {
    id: 'gDays', enableSorting: false, header: band('NGÀY CÔNG TRONG KỲ', 'bg-blue-600 text-white', CalendarDays, stickyLeft),
    columns: days.map((d) => ({
      id: d.key, accessorKey: d.key, size: 62, enableSorting: false, enableHiding: false, enablePinning: false, enableResizing: false,
      header: function Day() {
        const holiday = holidayOn(d);
        if (holiday) {
          return (
            <Tooltip>
              <TooltipTrigger render={<div data-holiday className="flex h-full w-full flex-col items-center justify-center text-xs leading-4 font-semibold whitespace-nowrap text-teal-700" />}>
                <span className="inline-flex items-center gap-0.5"><Flag className="size-3" />{d.weekday}</span>
                <span>{d.label}</span>
              </TooltipTrigger>
              <TooltipContent>{holiday}</TooltipContent>
            </Tooltip>
          );
        }
        return (
          <div className={`flex h-full w-full flex-col items-center justify-center text-xs leading-4 whitespace-nowrap ${d.iso === today ? 'font-bold text-blue-700' : d.isWeekend ? 'text-amber-700' : 'text-slate-700'}`}>
            <span>{d.weekday}</span>
            <span>{d.label}</span>
          </div>
        );
      },
      meta: { label: `${d.weekday} ${d.label}`, variant: 'select', options, iso: d.iso, cellClass: tint(d) },
    })),
  };
}

function paidColumn(canAdjust: boolean, onAdjust: (employeeId: string) => void, adjustmentWords: Record<string, string>) {
  return {
    ...total('huong', 'Công hưởng lương', LUONG, Banknote, 'text-red-600'),
    cell: function Paid({ getValue, row }: CellArgs) {
      const words = adjustmentWords[row.original.id];
      return (
        <Tooltip>
          <TooltipTrigger render={<button type="button" disabled={!canAdjust} aria-label={`Điều chỉnh công ${row.original.ten}`} onClick={() => onAdjust(row.original.id)} className="relative block w-full text-right text-sm font-bold text-red-600 tabular-nums enabled:cursor-pointer enabled:hover:underline" />}>
            {asNumber(getValue())}
            {words && <span data-adjust-mark aria-hidden="true" className="absolute -top-1 -right-2 size-2.5 bg-red-600 [clip-path:polygon(0_0,100%_0,100%_100%)]" />}
          </TooltipTrigger>
          <TooltipContent>{words ?? (canAdjust ? 'Bấm để điều chỉnh công, có ghi lý do' : 'Công hưởng lương')}</TooltipContent>
        </Tooltip>
      );
    },
  };
}

function leaveColumn(canEdit: boolean, onLeave: (employeeId: string) => void) {
  return {
    ...total('tonCuoi', 'Phép tồn cuối kỳ', PHEP, CalendarCheck, 'text-amber-600'),
    cell: function Leave({ getValue, row }: CellArgs) {
      const changed = Number(row.original.doiPhep);
      return (
        <Tooltip>
          <TooltipTrigger render={<button type="button" disabled={!canEdit} aria-label={`Điều chỉnh phép ${row.original.ten}`} onClick={() => onLeave(row.original.id)} className="relative block w-full text-right text-sm text-slate-800 tabular-nums enabled:cursor-pointer enabled:hover:underline" />}>
            {asNumber(getValue())}
            {changed !== 0 && <span aria-hidden="true" className="absolute -top-1 -right-2 size-2.5 bg-amber-500 [clip-path:polygon(0_0,100%_0,100%_100%)]" />}
          </TooltipTrigger>
          <TooltipContent>{changed !== 0 ? `Đã điều chỉnh ${String(changed).replace('.', ',')} ngày` : canEdit ? 'Bấm để điều chỉnh phép' : 'Phép tồn cuối kỳ'}</TooltipContent>
        </Tooltip>
      );
    },
  };
}

/** Columns only a month that used them shows, so that the others stay as HR's sheet. */
const EXTRA_COLUMNS = {
  coLuong: () => total('coLuong', 'Nghỉ có lương', CONG, Gift, 'text-indigo-600'),
  bhxh: () => total('bhxh', 'Nghỉ BHXH', CONG, Baby, 'text-pink-600'),
  lamCN: () => total('lamCN', 'Làm Chủ nhật', CONG, Sun, 'text-amber-600'),
  lamLe: () => total('lamLe', 'Làm ngày lễ', CONG, Flag, 'text-teal-600'),
};
export const EXTRA_COLUMN_KEYS = Object.keys(EXTRA_COLUMNS) as (keyof typeof EXTRA_COLUMNS)[];

function totalGroups(paid: ReturnType<typeof paidColumn>, leave: ReturnType<typeof leaveColumn>, stickyLeft: number, extras: readonly (keyof typeof EXTRA_COLUMNS)[]) {
  return [
    {
      id: 'gCong', enableSorting: false, header: band('TỔNG HỢP CÔNG', 'bg-orange-200 text-orange-900', CheckCircle2, stickyLeft),
      columns: [
        total('thucTe', 'Công thực tế', CONG, Check, 'text-green-600'),
        total('diTre', 'Đi muộn/về sớm (lần)', CONG, Clock, 'text-amber-600'),
        total('nghiPhep', 'Nghỉ phép', CONG, Plane, 'text-sky-600'),
        total('khongLuong', 'Nghỉ không lương', CONG, Wallet, 'text-orange-600'),
        total('khongPhep', 'Nghỉ không phép', CONG, Ban, 'text-red-600'),
        total('le', 'Nghỉ lễ', CONG, Flag, 'text-teal-600'),
        ...extras.map((key) => EXTRA_COLUMNS[key]()),
      ],
    },
    {
      id: 'gLuong', enableSorting: false, header: band('TÍNH LƯƠNG', 'bg-green-200 text-green-900', Calculator, stickyLeft),
      columns: [
        total('chuan', 'Công chuẩn', LUONG, Target, 'text-slate-500'),
        paid,
        total('ot', 'Công vượt chuẩn (OT)', LUONG, TrendingUp, 'text-blue-600'),
      ],
    },
    {
      id: 'gPhep', enableSorting: false, header: band('PHÉP NĂM', 'bg-yellow-200 text-yellow-900', Plane, stickyLeft),
      columns: [
        total('tonDau', 'Phép tồn đầu kỳ', PHEP, CalendarDays, 'text-amber-600'),
        leave,
      ],
    },
  ];
}

export function makeColumns(args: {
  days: readonly DayColumn[];
  regions: readonly TimesheetRegionDto[];
  today: string;
  canAdjust: boolean;
  onAdjust: (employeeId: string) => void;
  adjustmentWords: Record<string, string>;
  pinned: readonly string[];
  holidays: readonly { day: string; name: string }[];
  onLeave: (employeeId: string) => void;
  extras: readonly (keyof typeof EXTRA_COLUMNS)[];
}) {
  const { days, regions, today, canAdjust, onAdjust, adjustmentWords, pinned, holidays, onLeave, extras } = args;
  const pinnedWidth = infoColumns(regions).filter((c) => pinned.includes(c.id)).reduce((sum, c) => sum + c.size, 0);
  const stickyLeft = pinnedWidth + 8;
  return [
    ...peopleGroups(regions, pinned),
    dayGroup(days, today, stickyLeft, holidays),
    ...totalGroups(paidColumn(canAdjust, onAdjust, adjustmentWords), leaveColumn(canAdjust, onLeave), stickyLeft, extras),
  ];
}
