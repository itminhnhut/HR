import type { TimesheetDto } from '@careers/shared';
import { AlertTriangle, Building2, CalendarCheck, CheckCircle2, CloudOff, Coins, Download, History, Loader2, Lock, LockOpen, MapPin, Pencil, Search, SearchX, Target, UserPlus, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { api } from '../../../api';
import { DataGrid } from '../../../vendor/shadcn-grid/components/data-grid/data-grid';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { useDataGrid } from '../../../vendor/shadcn-grid/hooks/use-data-grid';
import { NotesContext } from '../../../vendor/shadcn-grid/lib/codes';
import { errorMessage } from '../parts';
import { makeColumns, RegionBadge } from './columns';
import { AdjustDialog, LogDialog, ReopenDialog, ReviewDialog } from './dialogs';
import { exportTimesheet } from './exportExcel';
import { PeriodPicker } from './PeriodPicker';
import { useSaveCells, useSheetAction, type PeriodChoice, type SaveState } from './queries';
import { changedCells, dayColumns, dayMonth, findProblems, gridRows, notesOf, type GridRow, type TimesheetProblem } from './timesheetModel';
import { CodeLegend, MultiFilter, ShortcutHelp } from './toolbar';

const QUICK_KEYS: Record<string, string> = { '1': '1', p: 'P', h: 'P/2', m: 'M', k: 'KL', l: 'NL', x: 'KP' };

interface GridTable {
  setFocusedCell(rowId: string, columnId: string): void;
  getSelectedCells(): { rowId: string; columnId: string }[];
  atoms: { cellSelection: { get(): { focusRowId: string; focusColumnId: string }[] } };
  updateCells(cells: { rowId: string; columnId: string; value: string }[]): void;
  stopEditing(): void;
}

const PILL = 'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap';
const OUTLINE = 'inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50';

function SaveStatus({ state, error }: { state: SaveState; error: unknown }) {
  if (state === 'saving') return <span className={`${PILL} border-slate-300 bg-slate-50 text-slate-700`}><Loader2 className="size-3.5 animate-spin" />Đang lưu</span>;
  if (state === 'saved') return <span data-testid="saved" className={`${PILL} border-green-300 bg-green-50 text-green-800`}><CheckCircle2 className="size-3.5" />Đã lưu</span>;
  if (state === 'failed') return <span role="alert" title={errorMessage(error)} className={`${PILL} border-red-300 bg-red-50 text-red-700`}><CloudOff className="size-3.5" />Chưa lưu được</span>;
  return null;
}

function PeriodStrip({ dto, canEdit, onPeriod, onNorm }: { dto: TimesheetDto; canEdit: boolean; onPeriod: (p: { from: string; to: string }) => void; onNorm: (regionId: string, norm: number) => void }) {
  return (
    <section aria-label="Thông tin kỳ công" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-white px-4 py-2">
      <dl className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5"><dt className="text-slate-500">Năm</dt><dd className="m-0 font-semibold">{dto.year}</dd></span>
        <span className="flex items-center gap-1.5"><dt className="text-slate-500">Tháng</dt><dd className="m-0 font-semibold">{dto.month}</dd></span>
        <span className="flex items-center gap-1.5"><dt className="text-slate-500">Kỳ công</dt><dd className="m-0"><PeriodPicker value={dto} today={dto.today} onApply={onPeriod} /></dd></span>
      </dl>
      <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 md:block" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-slate-500"><Target className="size-4" />Định mức công</span>
        {dto.regions.map((r) => (
          <label key={r.id} className="flex items-center gap-1.5 text-sm">
            <RegionBadge regionId={r.id} regions={dto.regions} />
            <Input
              key={dto.norms[r.id]}
              aria-label={`Định mức ${r.name}`}
              disabled={!canEdit}
              inputMode="decimal"
              defaultValue={String(dto.norms[r.id] ?? 0).replace('.', ',')}
              onBlur={(e) => {
                const value = Number(e.target.value.trim().replace(',', '.') || NaN);
                if (Number.isFinite(value) && value > 0) {
                  if (value !== dto.norms[r.id]) onNorm(r.id, value);
                  return;
                }
                e.target.value = String(dto.norms[r.id] ?? 0).replace('.', ',');
              }}
              className="h-8 w-14 bg-white text-center font-semibold"
            />
          </label>
        ))}
      </div>
      <h2 className="m-0 ml-auto text-base font-bold tracking-wide text-red-600">
        {dto.periodId ? `BẢNG CHẤM CÔNG THÁNG ${dto.month}` : `BẢNG CHẤM CÔNG ${dayMonth(dto.from)} – ${dayMonth(dto.to)}`}
      </h2>
    </section>
  );
}

function Banner({ tone, icon, children }: { tone: string; icon: ReactNode; children: ReactNode }) {
  return <p role="status" className={`m-0 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}>{icon}<span className="flex-1">{children}</span></p>;
}

export function GridTab({ dto, choice, onPeriod, actionsSlot }: { dto: TimesheetDto; choice: PeriodChoice; onPeriod: (p: { from: string; to: string }) => void; actionsSlot: HTMLElement | null }) {
  const days = useMemo(() => dayColumns(dto), [dto]);
  const rows = useMemo(() => gridRows(dto, days), [dto, days]);
  const notes = useMemo(() => notesOf(dto, days), [dto, days]);
  const periodId = dto.periodId;
  const isClosed = dto.status === 'closed';
  const canEdit = !!periodId && !isClosed;
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pickedRegions, setPickedRegions] = useState<string[]>([]);
  const [pickedDepts, setPickedDepts] = useState<string[]>([]);
  const [warning, setWarning] = useState('');
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const saving = useSaveCells(choice);
  const close = useSheetAction<void>(choice, () => api.hrTimesheetClose(periodId ?? ''));
  const reopen = useSheetAction<string>(choice, (reason) => api.hrTimesheetReopen(periodId ?? '', reason));
  const norms = useSheetAction<Record<string, number>>(choice, (next) => api.hrTimesheetNorms(periodId ?? '', next));
  const addAdjust = useSheetAction<{ employeeId: string; amount: number; reason: string; isRecurring: boolean }>(choice, (input) => api.hrTimesheetAddAdjustment(periodId ?? '', input));
  const removeAdjust = useSheetAction<string>(choice, (id) => api.hrTimesheetRemoveAdjustment(periodId ?? '', id));

  const adjustmentWords = useMemo(() => {
    const words: Record<string, string> = {};
    for (const row of dto.rows) {
      if (row.adjustments.length === 0) continue;
      const list = row.adjustments.map((a) => `${String(a.amount).replace('.', ',')} công: ${a.reason}`).join('; ');
      words[row.employeeId] = `Điều chỉnh ${list}`;
    }
    return words;
  }, [dto]);
  const columns = useMemo(
    () => makeColumns({ days, regions: dto.regions, today: dto.today, canAdjust: canEdit, onAdjust: setAdjustingId, adjustmentWords }),
    [days, dto.regions, dto.today, canEdit, adjustmentWords],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      (!q || `${r.ten} ${r.ma}`.toLowerCase().includes(q)) &&
      (pickedRegions.length === 0 || pickedRegions.includes(String(r.regionId))) &&
      (pickedDepts.length === 0 || pickedDepts.includes(String(r.bp))));
  }, [rows, query, pickedRegions, pickedDepts]);

  const latest = useRef({ dto, days, rows, save: saving.save });
  latest.current = { dto, days, rows, save: saving.save };
  const onDataChange = useCallback((next: GridRow[]) => {
    const { dto: sheet, days: columnsNow, rows: before, save } = latest.current;
    if (!sheet.periodId) return;
    const ids = new Set(next.map((r) => r.id));
    save(sheet.periodId, changedCells(sheet, columnsNow, before.filter((r) => ids.has(r.id)), next));
  }, []);
  const firstId = dto.rows[0]?.employeeId;
  const todayKey = days.find((d) => d.iso === dto.today)?.key;
  const grid = useDataGrid<GridRow>({
    data: visible,
    columns: columns as never,
    onDataChange,
    enablePaste: true,
    enableSearch: true,
    readOnly: !canEdit,
    getRowId: (r: GridRow) => r.id,
    ...(firstId ? { autoFocus: { rowId: firstId, columnId: todayKey ?? days[0]?.key } } : {}),
    initialState: { columnPinning: { start: window.innerWidth < 900 ? ['ten'] : ['stt', 'ma', 'ten', 'bp', 'regionId'], end: [] } },
  } as never);
  const table = (grid as unknown as { table: GridTable }).table;

  const scrollToColumn = (columnId: string, side: 'center' | 'end' = 'center') => {
    const header = document.querySelector<HTMLElement>(`[data-slot="data-grid-header-cell"][data-column-id="${columnId}"]`);
    const root = document.querySelector<HTMLElement>('[role="grid"]');
    const box = root && [root, ...root.querySelectorAll<HTMLElement>('*')].find((e) => e.scrollWidth > e.clientWidth + 50);
    if (!header || !box) return;
    const left = header.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft;
    box.scrollLeft = side === 'end' ? box.scrollWidth : left - box.clientWidth / 2;
  };
  useEffect(() => {
    if (!todayKey) return undefined;
    const timer = window.setTimeout(() => scrollToColumn(todayKey), 300);
    return () => window.clearTimeout(timer);
    // Only on opening a period: later edits must not move the table under HR's hands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overLeave = useRef(new Set(rows.filter((r) => Number(r.phepVuot) > 0).map((r) => r.id)));
  useEffect(() => {
    const now = rows.filter((r) => Number(r.phepVuot) > 0);
    const fresh = now.find((r) => !overLeave.current.has(r.id));
    overLeave.current = new Set(now.map((r) => r.id));
    if (fresh) setWarning(`${fresh.ten}: vượt ${String(fresh.phepVuot).replace('.', ',')} ngày phép, phần vượt không được trả lương. Đổi sang KL nếu đúng là nghỉ không lương.`);
  }, [rows]);

  const onQuickCode = (event: KeyboardEvent<HTMLDivElement>) => {
    const code = QUICK_KEYS[event.key.toLowerCase()];
    if (!code || !canEdit || event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.target as HTMLElement).closest('textarea, input')) return;
    const selected = table.getSelectedCells();
    const ranges = table.atoms.cellSelection.get();
    const focus = ranges[ranges.length - 1];
    const cells = selected.length > 0 ? selected : focus ? [{ rowId: focus.focusRowId, columnId: focus.focusColumnId }] : [];
    const dayCells = cells.filter((c) => {
      const day = days.find((d) => d.key === c.columnId);
      const person = rows.find((r) => r.id === c.rowId);
      return !!day && !!person && (!person.ngayVao || day.iso >= String(person.ngayVao)) && (!person.ngayNghi || day.iso <= String(person.ngayNghi));
    });
    if (dayCells.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    table.updateCells(dayCells.map((c) => ({ ...c, value: code })));
    table.stopEditing();
  };

  const noteApi = useMemo(() => ({
    notes,
    setNote: (key: string, text: string) => {
      const [employeeId = '', columnId] = key.split(':');
      const day = days.find((d) => d.key === columnId);
      if (!day || !periodId || !canEdit || (notes[key] ?? '') === text) return;
      saving.save(periodId, [{ employeeId, day: day.iso, note: text || null }]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [notes, days, periodId, canEdit]);

  const problems = useMemo(() => (periodId ? findProblems(dto, days, rows) : []), [dto, days, rows, periodId]);
  const entered = dto.rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.entered).length, 0);
  const clearFilters = () => {
    setQuery('');
    setPickedRegions([]);
    setPickedDepts([]);
  };
  const jump = (p: TimesheetProblem) => {
    setIsReviewOpen(false);
    clearFilters();
    window.setTimeout(() => {
      table.setFocusedCell(p.employeeId, p.columnId);
      scrollToColumn(p.columnId);
    }, 250);
  };
  const download = () => {
    setDownloadError(null);
    exportTimesheet({
      rows, days, notes, adjustmentNotes: adjustmentWords, isClosed, isFreeRange: !periodId,
      from: dto.from, to: dto.to, year: dto.year, month: dto.month,
      regions: dto.regions.map((r) => ({ id: r.id, name: r.name, norm: dto.norms[r.id] ?? 0 })),
    }).catch(setDownloadError);
  };
  const isFiltered = !!query.trim() || pickedRegions.length > 0 || pickedDepts.length > 0;
  const depts = [...new Set(rows.map((r) => String(r.bp)).filter(Boolean))].map((d) => ({ value: d, label: d }));
  const adjustingRow = dto.rows.find((r) => r.employeeId === adjustingId) ?? null;

  return (
    <NotesContext.Provider value={noteApi}>
      {actionsSlot && createPortal(
        <>
          <SaveStatus state={saving.state} error={saving.error} />
          {!periodId ? null : isClosed ? (
            <span data-testid="period-status" className={`${PILL} border-red-300 bg-red-50 text-red-700`}><Lock className="size-3.5" />Đã chốt</span>
          ) : (
            <span data-testid="period-status" className={`${PILL} border-green-300 bg-green-50 text-green-800`}><LockOpen className="size-3.5" />Đang mở</span>
          )}
          {canEdit && todayKey && <span data-testid="auto" className={`${PILL} border-blue-300 bg-blue-50 text-blue-800`}><Zap className="size-3.5" />T2–T6 tự chấm đến {dayMonth(dto.today)}</span>}
          {periodId && <span data-testid="entered" className={`${PILL} border-slate-300 bg-slate-50 text-slate-700`}><Pencil className="size-3.5" />HR đã điền {entered} ô</span>}
          {periodId && <button type="button" onClick={() => setIsLogOpen(true)} className={OUTLINE}><History className="size-4 text-slate-500" />Nhật ký</button>}
          {canEdit && (
            <button type="button" onClick={() => setIsReviewOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
              <CheckCircle2 className="size-4" />
              Rà soát &amp; chốt
              {problems.length > 0 && <span className="rounded-full bg-white/90 px-1.5 text-xs font-semibold text-blue-800">{problems.length}</span>}
            </button>
          )}
          {isClosed && dto.canReopen && <button type="button" onClick={() => setIsReopenOpen(true)} className={OUTLINE}><LockOpen className="size-4 text-blue-600" />Mở lại kỳ</button>}
        </>,
        actionsSlot,
      )}
      <div className="contents max-md:order-3 max-md:flex max-md:flex-col max-md:gap-3">
        <PeriodStrip dto={dto} canEdit={canEdit} onPeriod={onPeriod} onNorm={(regionId, norm) => norms.mutate({ [regionId]: norm })} />
        <CodeLegend rows={rows} days={days} />
      </div>
      <section aria-label="Lọc và tải" className="flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 max-md:order-1">
        <span className="relative max-md:w-full">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" />
          <Input aria-label="Tìm nhân viên" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, mã NV" className="h-9 w-52 bg-white pl-8 max-md:w-full" />
        </span>
        <MultiFilter label="Khu vực" icon={MapPin} items={dto.regions.map((r) => ({ value: r.id, label: r.name }))} picked={pickedRegions} onChange={setPickedRegions} mark={(id) => <RegionBadge regionId={id} regions={dto.regions} />} />
        <MultiFilter label="Bộ phận" icon={Building2} items={depts} picked={pickedDepts} onChange={setPickedDepts} isSearchable />
        {isFiltered && (
          <>
            <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100"><X className="size-4" />Xoá lọc</button>
            <span data-testid="showing" className="text-sm text-slate-500">Đang xem {visible.length}/{rows.length} người</span>
          </>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Hôm nay" disabled={!todayKey} onClick={() => todayKey && scrollToColumn(todayKey)} className={OUTLINE}><CalendarCheck className="size-4 text-blue-600" /><span className="max-md:sr-only">Hôm nay</span></button>
          <button type="button" aria-label="Cột tổng" onClick={() => scrollToColumn('tonCuoi', 'end')} className={OUTLINE}><Coins className="size-4 text-red-600" /><span className="max-md:sr-only">Cột tổng</span></button>
          <ShortcutHelp />
          <button type="button" aria-label="Tải Excel" onClick={download} className={OUTLINE}><Download className="size-4 text-green-600" /><span className="max-md:sr-only">Tải Excel</span></button>
        </span>
      </section>
      {!periodId && <Banner tone="border-blue-200 bg-blue-50 text-blue-900" icon={<CalendarCheck className="size-4 shrink-0" />}>Khoảng ngày tự chọn chỉ để xem và tải về. Chấm và chốt ở kỳ 26 → 25. Phép năm không tính ở đây.</Banner>}
      {isClosed && <Banner tone="border-red-200 bg-red-50 text-red-800" icon={<Lock className="size-4 shrink-0" />}>Kỳ đã chốt, chỉ xem.{dto.canReopen ? ' Muốn sửa bấm Mở lại kỳ.' : ' Sai ở kỳ này thì điều chỉnh công ở kỳ hiện tại.'}</Banner>}
      {!!downloadError && <p role="alert" className="m-0 text-sm text-red-600">Chưa tải được file Excel. {errorMessage(downloadError)}</p>}
      {!!(norms.error ?? removeAdjust.error) && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(norms.error ?? removeAdjust.error)}</p>}
      {saving.state === 'failed' && <p role="alert" className="m-0 text-sm text-red-600">Chưa lưu được: {errorMessage(saving.error)} Bảng đã được tải lại.</p>}
      {warning && (
        <p role="alert" className="m-0 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{warning}</span>
          <button type="button" aria-label="Đóng cảnh báo" onClick={() => setWarning('')} className="rounded p-1 hover:bg-amber-100"><X className="size-4" /></button>
        </p>
      )}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border bg-white py-14 text-sm text-slate-600 max-md:order-2">
          <UserPlus className="size-7 text-blue-500" />
          Kỳ này chưa có nhân viên nào.
          <Link to="/hr/cham-cong/nhan-vien" className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white no-underline hover:text-white"><UserPlus className="size-4" />Thêm nhân viên</Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border bg-white py-12 text-sm text-slate-600 max-md:order-2">
          <SearchX className="size-6 text-slate-400" />
          Không có nhân viên phù hợp.
          <button type="button" onClick={clearFilters} className={OUTLINE}>Xoá lọc</button>
        </div>
      ) : (
        <div className="max-md:order-2" onKeyDownCapture={onQuickCode}>
          <DataGrid {...grid} height={Math.min(560, 56 + 44 + visible.length * 36 + 4)} />
        </div>
      )}
      <ReviewDialog open={isReviewOpen} onClose={() => setIsReviewOpen(false)} closableFrom={dto.today < dto.to ? dayMonth(dto.to) : null} problems={problems} onJump={jump} isBusy={close.isPending} error={close.error} onLock={() => close.mutate(undefined, { onSuccess: () => setIsReviewOpen(false) })} />
      <ReopenDialog open={isReopenOpen} onClose={() => setIsReopenOpen(false)} isBusy={reopen.isPending} error={reopen.error} onReopen={(reason) => reopen.mutate(reason, { onSuccess: () => setIsReopenOpen(false) })} />
      <AdjustDialog
        row={adjustingRow}
        onClose={() => setAdjustingId(null)}
        isBusy={addAdjust.isPending || removeAdjust.isPending}
        error={addAdjust.error}
        onAdd={(input) => adjustingId && addAdjust.mutate({ employeeId: adjustingId, ...input })}
        onRemove={(id) => removeAdjust.mutate(id)}
      />
      <LogDialog periodId={periodId} open={isLogOpen} onClose={() => setIsLogOpen(false)} />
    </NotesContext.Provider>
  );
}
