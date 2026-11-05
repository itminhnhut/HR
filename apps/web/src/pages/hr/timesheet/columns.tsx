import type { TimesheetRegionDto, RegionTone, StaffType } from '@careers/shared';
import { STAFF_TYPE_LABEL } from '@careers/shared';
import {
  Ban, CalendarCheck, CalendarDays, Check, CheckCircle2, Clock, Coins, Flag, MapPin, ShieldCheck, Sun, Target, TrendingUp, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';
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
    <span className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold whitespace-nowrap ${region ? REGION_TONE[region.tone] : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
      <MapPin className="size-3" />
      {region?.name ?? '—'}
    </span>
  );
}

export function StaffBadge({ type }: { type: unknown }) {
  const isTrial = type === 'probation';
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap ${isTrial ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-green-300 bg-green-50 text-green-800'}`}>
      {isTrial ? <Clock className="size-3" /> : <ShieldCheck className="size-3" />}
      {STAFF_TYPE_LABEL[type as StaffType]}
    </span>
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

const band = (label: string, tone: string, Icon: LucideIcon, isLong = false) =>
  function Band() {
    return (
      <div className={`-mx-3 -my-1.5 flex h-8 items-center gap-1.5 text-xs font-bold tracking-wide ${isLong ? 'pl-3' : 'justify-center'} ${tone}`}>
        <span className={`inline-flex items-center gap-1.5 ${isLong ? 'sticky left-[524px] max-[899px]:left-[182px]' : ''}`}>
          <Icon className="size-3.5" />
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

const CONG = 'bg-orange-50!';
const LUONG = 'bg-green-50!';
const PHEP = 'bg-yellow-50!';

export function makeColumns(args: {
  days: readonly DayColumn[];
  regions: readonly TimesheetRegionDto[];
  today: string;
  canAdjust: boolean;
  onAdjust: (employeeId: string) => void;
  adjustmentWords: Record<string, string>;
}) {
  const { days, regions, today, canAdjust, onAdjust, adjustmentWords } = args;
  const options = CODES.map((c) => ({ value: c.value, label: c.name }));
  const off = (d: DayColumn) => (d.iso === today ? 'bg-blue-50!' : d.isWeekend ? 'bg-amber-50!' : '');
  return [
    {
      id: 'gInfo', enableSorting: false, header: band('THÔNG TIN NHÂN VIÊN', 'bg-red-600 text-white', Users),
      columns: [
        info('stt', 'STT', 60, (v) => <span className="block text-center text-sm text-slate-600">{String(v)}</span>),
        info('ma', 'MNV', 64, (v) => <span className="block truncate text-sm text-slate-600">{String(v)}</span>),
        info('ten', 'Họ và tên', 170, (v) => <span className="block truncate text-sm font-medium">{String(v)}</span>),
        info('bp', 'Bộ phận', 134, (v) => <span className="block truncate text-sm">{String(v)}</span>),
        info('regionId', 'Địa điểm', 84, (v) => <RegionBadge regionId={v} regions={regions} />),
      ],
    },
    {
      id: 'gMore', enableSorting: false, header: band('LOẠI', 'bg-slate-200 text-slate-700', ShieldCheck),
      columns: [info('loai', 'Nhân viên', 122, (v) => <StaffBadge type={v} />)],
    },
    {
      id: 'gDays', enableSorting: false, header: band('NGÀY CÔNG TRONG KỲ', 'bg-blue-600 text-white', CalendarDays, true),
      columns: days.map((d) => ({
        id: d.key, accessorKey: d.key, size: 62, enableSorting: false, enableHiding: false, enablePinning: false, enableResizing: false,
        header: function Day() {
          return (
            <div className={`flex h-full w-full flex-col items-center justify-center text-xs leading-4 ${d.iso === today ? 'font-bold text-blue-700' : d.isWeekend ? 'text-amber-700' : 'text-slate-700'}`}>
              <span>{d.weekday}</span>
              <span>{d.label}</span>
            </div>
          );
        },
        meta: { label: `${d.weekday} ${d.label}`, variant: 'select', options, iso: d.iso, cellClass: off(d) },
      })),
    },
    {
      id: 'gCong', enableSorting: false, header: band('TỔNG HỢP CÔNG', 'bg-orange-200 text-orange-900', CheckCircle2, true),
      columns: [
        total('thucTe', 'Công thực tế', CONG, Check, 'text-green-600'),
        total('diTre', 'Đi trễ/về sớm (lần)', CONG, Clock, 'text-amber-600'),
        total('nghiPhep', 'Nghỉ phép', CONG, Sun, 'text-sky-600'),
        total('khongLuong', 'Nghỉ không lương', CONG, Wallet, 'text-orange-600'),
        total('khongPhep', 'Nghỉ không phép', CONG, Ban, 'text-red-600'),
        total('le', 'Nghỉ lễ', CONG, Flag, 'text-teal-600'),
      ],
    },
    {
      id: 'gLuong', enableSorting: false, header: band('TÍNH LƯƠNG', 'bg-green-200 text-green-900', Coins),
      columns: [
        total('chuan', 'Công chuẩn', LUONG, Target, 'text-slate-500'),
        {
          ...total('huong', 'Công hưởng lương', LUONG, Coins, 'text-red-600'),
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
        },
        total('ot', 'Công vượt chuẩn (OT)', LUONG, TrendingUp, 'text-blue-600'),
      ],
    },
    {
      id: 'gPhep', enableSorting: false, header: band('PHÉP NĂM', 'bg-yellow-200 text-yellow-900', Sun),
      columns: [
        total('tonDau', 'Phép tồn đầu kỳ', PHEP, CalendarDays, 'text-amber-600'),
        total('tonCuoi', 'Phép tồn cuối kỳ', PHEP, CalendarCheck, 'text-amber-600'),
      ],
    },
  ];
}
