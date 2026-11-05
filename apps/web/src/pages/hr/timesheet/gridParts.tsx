import { standardPeriod, type TimesheetDto } from '@careers/shared';
import { useState } from 'react';
import { AlertTriangle, Building2, CalendarCheck, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CloudOff, Download, FileSpreadsheet, Loader2, Lock, LockOpen, MapPin, Pencil, Search, SearchX, Sigma, Target, UserPlus, X, Zap } from 'lucide-react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { Link } from 'react-router';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { RegionBadge } from './columns';
import { ExportMonthsDialog } from './ExportMonthsDialog';
import { PeriodPicker } from './PeriodPicker';
import type { SaveState } from './queries';
import { dayMonth } from './timesheetModel';
import { MultiFilter, ShortcutHelp } from './toolbar';

const PILL = 'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap';
export const OUTLINE = 'ts-field inline-flex items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium whitespace-nowrap hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50';

/** A control that cannot be used says why: a disabled button itself gets no mouse events. */
export function WithReason({ reason, children }: { reason: string | null; children: ReactElement }) {
  if (!reason) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="inline-flex max-md:flex-1" />}>{children}</TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'saving') return <span className={`${PILL} border-slate-300 bg-slate-50 text-slate-700`}><Loader2 className="size-3.5 animate-spin" />Đang lưu</span>;
  if (state === 'saved') return <span data-testid="saved" className={`${PILL} border-green-300 bg-green-50 text-green-800`}><CheckCircle2 className="size-3.5" />Đã lưu</span>;
  if (state === 'failed') return <span className={`${PILL} border-red-300 bg-red-50 text-red-700`}><CloudOff className="size-3.5" />Chưa lưu được</span>;
  return null;
}

function PeriodPill({ dto, isFuture }: { dto: TimesheetDto; isFuture: boolean }) {
  if (dto.status === 'closed') return <span data-testid="period-status" className={`${PILL} border-red-300 bg-red-50 text-red-700`}><Lock className="size-3.5" />Đã chốt</span>;
  if (isFuture) return <span data-testid="period-status" className={`${PILL} border-slate-300 bg-slate-50 text-slate-700`}><CalendarClock className="size-3.5" />Chưa đến kỳ</span>;
  return <span data-testid="period-status" className={`${PILL} border-green-300 bg-green-50 text-green-800`}><LockOpen className="size-3.5" />Đang mở</span>;
}

export function PageActions({ dto, problems, entered, hasPeople, onReview, onReopen }: {
  dto: TimesheetDto;
  problems: number;
  entered: number;
  hasPeople: boolean;
  onReview: () => void;
  onReopen: () => void;
}) {
  const isClosed = dto.status === 'closed';
  const canEdit = !!dto.periodId && !isClosed;
  const isFuture = dto.from > dto.today;
  const isRunning = dto.from <= dto.today && dto.today <= dto.to;
  if (!dto.periodId) return null;
  return (
    <>
      <PeriodPill dto={dto} isFuture={isFuture} />
      {canEdit && isRunning && (
        <Tooltip>
          <TooltipTrigger render={<span data-testid="auto" tabIndex={0} className={`${PILL} border-blue-300 bg-blue-50 text-blue-800`} />}><Zap className="size-3.5" />Tự chấm đến {dayMonth(dto.today)}</TooltipTrigger>
          <TooltipContent>T2–T6 máy tự chấm đến hôm nay</TooltipContent>
        </Tooltip>
      )}
      <span data-testid="entered" className={`${PILL} border-slate-300 bg-slate-50 text-slate-700`}><Pencil className="size-3.5" />Đã điền {entered} ô</span>
      {canEdit && !isFuture && (
        <WithReason reason={hasPeople ? null : 'Chưa có nhân viên'}>
          <button type="button" disabled={!hasPeople} onClick={onReview} className="ts-field inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50">
            <CheckCircle2 className="size-4" />
            Rà soát &amp; chốt
            {problems > 0 && <span className="rounded-full bg-white/90 px-1.5 text-xs font-semibold text-blue-800">{problems}</span>}
          </button>
        </WithReason>
      )}
      {isClosed && dto.canReopen && <button type="button" onClick={onReopen} className={OUTLINE}><LockOpen className="size-4 text-blue-600" />Mở lại kỳ</button>}
    </>
  );
}

function NormField({ region, dto, canEdit, onNorm, onInvalid }: { region: TimesheetDto['regions'][number]; dto: TimesheetDto; canEdit: boolean; onNorm: (regionId: string, norm: number) => void; onInvalid: () => void }) {
  const current = dto.norms[region.id] ?? 0;
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="max-w-40"><RegionBadge regionId={region.id} regions={dto.regions} /></span>
      <Input
        key={current}
        aria-label={`Định mức ${region.name}`}
        disabled={!canEdit}
        inputMode="decimal"
        defaultValue={String(current).replace('.', ',')}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onBlur={(e) => {
          const value = Number(e.target.value.trim().replace(',', '.') || NaN);
          if (Number.isFinite(value) && value > 0) {
            if (value !== current) onNorm(region.id, value);
            return;
          }
          e.target.value = String(current).replace('.', ',');
          onInvalid();
        }}
        className="w-14 bg-white text-center font-semibold"
      />
    </label>
  );
}

export function PeriodStrip({ dto, canEdit, saveState, onPeriod, onNorm, onNormInvalid }: {
  dto: TimesheetDto;
  canEdit: boolean;
  saveState: SaveState;
  onPeriod: (p: { from: string; to: string }) => void;
  onNorm: (regionId: string, norm: number) => void;
  onNormInvalid: () => void;
}) {
  return (
    <section aria-label="Thông tin kỳ công" className="ts-card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-1.5">
      <dl className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5"><dt className="text-slate-500">Năm</dt><dd className="m-0 font-semibold">{dto.year}</dd></span>
        <span className="flex items-center gap-1.5"><dt className="text-slate-500">Tháng</dt><dd className="m-0 font-semibold">{dto.month}</dd></span>
        <span className="flex items-center gap-1.5"><dt className="text-slate-500">Kỳ công</dt><dd className="m-0 flex items-center gap-1"><button type="button" aria-label="Tháng trước" onClick={() => onPeriod(standardPeriod(dto.year, dto.month - 1))} className="ts-field inline-flex items-center rounded-md border bg-white px-1.5 hover:bg-slate-50"><ChevronLeft className="size-4" /></button><PeriodPicker value={dto} today={dto.today} onApply={onPeriod} /><button type="button" aria-label="Tháng sau" onClick={() => onPeriod(standardPeriod(dto.year, dto.month + 1))} className="ts-field inline-flex items-center rounded-md border bg-white px-1.5 hover:bg-slate-50"><ChevronRight className="size-4" /></button></dd></span>
      </dl>
      <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 lg:block" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm whitespace-nowrap text-slate-500"><Target className="size-4" />Định mức công</span>
        {dto.regions.map((r) => <NormField key={r.id} region={r} dto={dto} canEdit={canEdit} onNorm={onNorm} onInvalid={onNormInvalid} />)}
      </div>
      <div className="ml-auto flex items-center gap-3">
        {/* It floats in the free space beside the title, so nothing moves when it shows or hides. */}
        <span className="relative hidden md:block"><span className="absolute top-1/2 right-0 -translate-y-1/2"><SaveStatus state={saveState} /></span></span>
        <h2 className="m-0 text-base font-bold tracking-wide whitespace-nowrap text-red-600">
          {dto.periodId ? `BẢNG CHẤM CÔNG THÁNG ${dto.month}` : `BẢNG CHẤM CÔNG ${dayMonth(dto.from)} – ${dayMonth(dto.to)}`}
        </h2>
      </div>
    </section>
  );
}

export function Banner({ tone, icon, children }: { tone: string; icon: ReactNode; children: ReactNode }) {
  return <p role="status" className={`m-0 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${tone}`}>{icon}<span className="flex-1">{children}</span></p>;
}

export interface FilterProps {
  query: string;
  onQuery: (q: string) => void;
  onSearchEnter: (e: KeyboardEvent<HTMLInputElement>) => void;
  regions: TimesheetDto['regions'];
  pickedRegions: string[];
  onRegions: (next: string[]) => void;
  depts: { value: string; label: string }[];
  pickedDepts: string[];
  onDepts: (next: string[]) => void;
  isFiltered: boolean;
  onClear: () => void;
  shown: number;
  total: number;
}

function Filters(p: FilterProps) {
  return (
    <>
      <span className="relative max-md:w-full">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
        <Input aria-label="Tìm nhân viên" value={p.query} onChange={(e) => p.onQuery(e.target.value)} onKeyDown={p.onSearchEnter} placeholder="Tìm tên, mã NV" className="w-52 bg-white pl-8 max-md:w-full" />
      </span>
      <MultiFilter label="Khu vực" icon={MapPin} items={p.regions.map((r) => ({ value: r.id, label: r.name }))} picked={p.pickedRegions} onChange={p.onRegions} mark={(id) => <RegionBadge regionId={id} regions={p.regions} />} />
      <MultiFilter label="Bộ phận" icon={Building2} items={p.depts} picked={p.pickedDepts} onChange={p.onDepts} isSearchable />
      {p.isFiltered && (
        <>
          <button type="button" onClick={p.onClear} className="ts-field inline-flex items-center gap-1.5 rounded-md px-2 text-sm font-medium text-slate-600 shadow-none hover:bg-slate-100"><X className="size-4" />Xoá lọc</button>
          <span data-testid="showing" className="text-sm whitespace-nowrap text-slate-500">Đang xem {p.shown}/{p.total} người</span>
        </>
      )}
    </>
  );
}

export function FilterBar({ filters, hasToday, onToday, onTotals, onDownload, year }: {
  year: number;
  filters: FilterProps;
  hasToday: boolean;
  onToday: () => void;
  onTotals: () => void;
  onDownload: () => void;
}) {
  const { isFiltered, shown, total } = filters;
  const excelLabel = isFiltered ? `Tải Excel (${shown}/${total} người)` : 'Tải Excel';
  const excelReason = shown === 0 ? (total === 0 ? 'Chưa có nhân viên' : 'Không có người nào đang lọc') : null;
  const [isMonthsOpen, setIsMonthsOpen] = useState(false);
  return (
    <section aria-label="Lọc và tải" className="ts-card flex flex-wrap items-center gap-2 px-3 py-1.5 max-md:order-1">
      <Filters {...filters} />
      <span className="ml-auto flex flex-wrap items-center gap-2 max-md:ml-0 max-md:w-full">
        <WithReason reason={hasToday ? null : 'Hôm nay không thuộc kỳ này'}>
          <button type="button" disabled={!hasToday} onClick={onToday} className={`${OUTLINE} max-md:flex-1 max-md:px-2`}><CalendarCheck className="size-4 text-blue-600" />Hôm nay</button>
        </WithReason>
        <button type="button" onClick={onTotals} className={`${OUTLINE} max-md:flex-1 max-md:px-2`}><Sigma className="size-4 text-red-600" />Cột tổng</button>
        <ShortcutHelp />
        <WithReason reason={excelReason}>
          <button type="button" disabled={shown === 0} onClick={onDownload} className={`${OUTLINE} max-md:flex-1 max-md:px-2`}><Download className="size-4 text-green-600" />{excelLabel}</button>
        </WithReason>
        <button type="button" onClick={() => setIsMonthsOpen(true)} className={`${OUTLINE} max-md:flex-1 max-md:px-2`}><FileSpreadsheet className="size-4 text-green-600" />Tải nhiều tháng</button>
      </span>
      {isMonthsOpen && <ExportMonthsDialog open year={year} onClose={() => setIsMonthsOpen(false)} />}
    </section>
  );
}

/** Messages float over the sheet: the table must not jump under HR's hands while they work. */
export function SheetNotices({ failure, onRetry, onDismissFailure, warning, onDismissWarning, errors, saveState }: {
  failure: string | null;
  onRetry: () => void;
  onDismissFailure: () => void;
  warning: string;
  onDismissWarning: () => void;
  errors: { id: string; text: string; onDismiss: () => void }[];
  saveState: SaveState;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 flex w-[min(760px,calc(100vw-24px))] -translate-x-1/2 flex-col items-center gap-2 *:pointer-events-auto">
      <span className="md:hidden"><SaveStatus state={saveState} /></span>
      {failure !== null && (
        <p role="alert" className="m-0 flex w-full items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-800 shadow-lg">
          <CloudOff className="size-4 shrink-0" />
          <span className="flex-1">Chưa lưu: {failure}</span>
          <button type="button" onClick={onRetry} className="ts-field rounded-md border border-red-300 bg-white px-3 font-medium hover:bg-red-100">Thử lại</button>
          <button type="button" aria-label="Đóng thông báo" onClick={onDismissFailure} className="rounded p-1 hover:bg-red-100"><X className="size-4" /></button>
        </p>
      )}
      {errors.map((e) => (
        <p key={e.id} role="alert" className="m-0 flex w-full items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-800 shadow-lg">
          <CloudOff className="size-4 shrink-0" />
          <span className="flex-1">{e.text}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={e.onDismiss} className="rounded p-1 hover:bg-red-100"><X className="size-4" /></button>
        </p>
      ))}
      {warning && (
        <p role="alert" className="m-0 flex w-full items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 shadow-lg">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{warning}</span>
          <button type="button" aria-label="Đóng cảnh báo" onClick={onDismissWarning} className="rounded p-1 hover:bg-amber-100"><X className="size-4" /></button>
        </p>
      )}
    </div>
  );
}

export function NoPeople() {
  return (
    <div className="ts-card flex flex-col items-center gap-3 py-14 text-sm text-slate-600 max-md:order-2">
      <UserPlus className="size-7 text-blue-500" />
      Kỳ này chưa có nhân viên nào.
      <Link to="/hr/cham-cong/nhan-vien" className="ts-field inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white no-underline hover:text-white"><UserPlus className="size-4" />Thêm nhân viên</Link>
    </div>
  );
}

export function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="ts-card flex flex-col items-center gap-2 py-12 text-sm text-slate-600 max-md:order-2">
      <SearchX className="size-6 text-slate-400" />
      Không có nhân viên phù hợp.
      <button type="button" onClick={onClear} className={OUTLINE}>Xoá lọc</button>
    </div>
  );
}
