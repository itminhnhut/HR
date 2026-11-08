import { standardPeriod, type TimesheetDto } from '@careers/shared';
import { CalendarCheck, CalendarClock, CalendarPlus, Lock } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api } from '../../../api';
import { DataGrid } from '../../../vendor/shadcn-grid/components/data-grid/data-grid';
import { useDataGrid } from '../../../vendor/shadcn-grid/hooks/use-data-grid';
import { NotesContext } from '../../../vendor/shadcn-grid/lib/codes';
import { apiMessage, errorMessage } from '../parts';
import { EXTRA_COLUMN_KEYS, makeColumns, textWidthsOf } from './columns';
import { papersLink } from './AbsencePapers';
import { LeaveChangeDialog } from './LeaveChangeDialog';
import { dayToOpen } from './openDay';
import { AdjustDialog, ReopenDialog, ReviewDialog } from './dialogs';
import { exportTimesheet } from './exportExcel';
import { scrollGridTo, useGridHeight, useOverLeaveWarning, useQuickCodes, useSheetFilters, type GridTable } from './gridHooks';
import { describeFailedCells, pinnedColumns } from './gridLayout';
import { Banner, FilterBar, NoMatch, NoPeople, PageActions, PeriodStrip, SheetNotices } from './gridParts';
import { useAbsencesBetween, useSaveCells, useSheetAction, type PeriodChoice } from './queries';
import { adjustmentNotesOf, changedCells, dayColumns, dayMonth, findProblems, gridRows, notesOf, type DayColumn, type GridRow, type TimesheetProblem } from './timesheetModel';
import { CodeLegend } from './toolbar';

const PHONE_WIDTH = 640;

type SheetDialog = 'review' | 'reopen' | null;

/** The sheet itself: columns, keys, saving what changes. */
function useSheetGrid(input: { dto: TimesheetDto; days: readonly DayColumn[]; rows: readonly GridRow[]; visible: readonly GridRow[]; canEdit: boolean; save: (periodId: string, cells: Parameters<ReturnType<typeof useSaveCells>['save']>[1]) => void; onAdjust: (id: string) => void; onLeave: (id: string) => void }) {
  const { dto, days, rows, visible, canEdit, save, onAdjust, onLeave } = input;
  // A word, not a list: a new list on every key pressed would rebuild the columns under HR's hands.
  const extraKey = EXTRA_COLUMN_KEYS.filter((key) => rows.some((r) => Number(r[key]) > 0)).join(',');
  const [pinned] = useState(() => pinnedColumns(window.innerWidth));
  const [isPhone] = useState(() => window.innerWidth < PHONE_WIDTH);
  const adjustmentWords = useMemo(() => adjustmentNotesOf(dto), [dto]);
  // By the text itself, so that a key pressed in a day does not rebuild the columns.
  const textKey = rows.map((r) => `${String(r.ma)}|${String(r.ten)}|${String(r.bp)}|${String(r.loaiTen)}`).join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const widths = useMemo(() => textWidthsOf(rows), [textKey]);
  const columns = useMemo(
    () => makeColumns({ days, regions: dto.regions, today: dto.today, canAdjust: canEdit, onAdjust, adjustmentWords, pinned, holidays: dto.holidays, onLeave, widths, extras: extraKey ? (extraKey.split(',') as typeof EXTRA_COLUMN_KEYS) : [] }),
    [days, dto.regions, dto.today, canEdit, onAdjust, adjustmentWords, pinned, dto.holidays, onLeave, extraKey, widths],
  );
  const latest = useRef({ dto, days, rows, save });
  latest.current = { dto, days, rows, save };
  const onDataChange = useCallback((next: GridRow[]) => {
    const { dto: sheet, days: columnsNow, rows: before, save: send } = latest.current;
    if (!sheet.periodId) return;
    const ids = new Set(next.map((r) => r.id));
    send(sheet.periodId, changedCells(sheet, columnsNow, before.filter((r) => ids.has(r.id)), next));
  }, []);
  const firstId = dto.rows[0]?.employeeId;
  const todayKey = days.find((d) => d.iso === dto.today)?.key;
  const grid = useDataGrid<GridRow>({
    data: visible as GridRow[],
    columns: columns as never,
    onDataChange,
    enablePaste: true,
    enableSearch: true,
    readOnly: !canEdit,
    getRowId: (r: GridRow) => r.id,
    ...(firstId ? { autoFocus: { rowId: firstId, columnId: todayKey ?? days[0]?.key } } : {}),
    initialState: { columnPinning: { start: pinned, end: [] }, rowHeight: isPhone ? 'medium' : 'short' },
  } as never);
  return { grid, table: (grid as unknown as { table: GridTable }).table, todayKey, adjustmentWords, rowHeight: isPhone ? 56 : 36 };
}

function useNoteApi(input: { notes: Record<string, string>; days: readonly DayColumn[]; periodId: string | null; canEdit: boolean; save: (periodId: string, cells: { employeeId: string; day: string; note: string | null }[]) => void }) {
  const { notes, days, periodId, canEdit, save } = input;
  return useMemo(() => ({
    notes,
    setNote: (key: string, text: string) => {
      const [employeeId = '', columnId] = key.split(':');
      const day = days.find((d) => d.key === columnId);
      if (!day || !periodId || !canEdit || (notes[key] ?? '') === text) return;
      save(periodId, [{ employeeId, day: day.iso, note: text || null }]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [notes, days, periodId, canEdit]);
}

function useSheetActions(choice: PeriodChoice, periodId: string | null) {
  const id = periodId ?? '';
  return {
    close: useSheetAction<void>(choice, () => api.hrTimesheetClose(id)),
    reopen: useSheetAction<string>(choice, (reason) => api.hrTimesheetReopen(id, reason)),
    norms: useSheetAction<Record<string, number>>(choice, (next) => api.hrTimesheetNorms(id, next)),
    addAdjust: useSheetAction<{ employeeId: string; amount: number; reason: string; isRecurring: boolean }>(choice, (input) => api.hrTimesheetAddAdjustment(id, input)),
    removeAdjust: useSheetAction<string>(choice, (adjustmentId) => api.hrTimesheetRemoveAdjustment(id, adjustmentId)),
    addLeave: useSheetAction<{ employeeId: string; amount: number; reason: string }>(choice, (input) => api.hrTimesheetAddLeaveChange(id, input)),
    removeLeave: useSheetAction<string>(choice, (changeId) => api.hrTimesheetRemoveLeaveChange(id, changeId)),
    openAhead: useSheetAction<void>(choice, () => (choice.kind === 'month' ? api.hrOpenPeriodAhead(choice.year, choice.month) : Promise.reject(new Error('Không phải một kỳ')))),
  };
}

/** Only on opening a period: later edits must not move the table under HR's hands. */
/** Opens on today, or on the day and person a link asks for (`?ngay=…&nv=…`, from the leave list). */
function useOpenOnDay(dayKey: string | undefined, scrollTo: (columnId: string) => void, focus: (columnId: string) => void) {
  useEffect(() => {
    if (!dayKey) return undefined;
    const timer = window.setTimeout(() => {
      scrollTo(dayKey);
      focus(dayKey);
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** A month whose period has not started and is not stored: only to look at until HR opens it. */
const isAhead = (dto: TimesheetDto) => {
  const standard = standardPeriod(dto.year, dto.month);
  return !dto.periodId && dto.from === standard.from && dto.to === standard.to && dto.from > dto.today;
};

export function PeriodBanners({ dto, onOpenAhead, isOpening }: { dto: TimesheetDto; onOpenAhead: () => void; isOpening: boolean }) {
  if (isAhead(dto)) {
    return (
      <Banner tone="border-slate-200 bg-slate-50 text-slate-800" icon={<CalendarClock className="size-4 shrink-0" />}>
        Kỳ T{dto.month}/{dto.year} chưa bắt đầu, đang chỉ xem. Cần ghi trước (vd nghỉ đã duyệt) thì mở kỳ.
        <button type="button" disabled={isOpening} onClick={onOpenAhead} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-50"><CalendarPlus className="size-3.5" />Mở kỳ để nhập trước</button>
      </Banner>
    );
  }
  if (!dto.periodId) {
    return <Banner tone="border-blue-200 bg-blue-50 text-blue-900" icon={<CalendarCheck className="size-4 shrink-0" />}>Khoảng tự chọn: chỉ xem và tải. Phép đầu kỳ lấy từ kỳ có ngày đầu tiên.</Banner>;
  }
  if (dto.status !== 'closed') return null;
  return <Banner tone="border-red-200 bg-red-50 text-red-800" icon={<Lock className="size-4 shrink-0" />}>Kỳ đã chốt, chỉ xem.{dto.canReopen ? ' Muốn sửa bấm Mở lại kỳ.' : ' Sai ở kỳ này thì điều chỉnh công ở kỳ hiện tại.'}</Banner>;
}

interface Props {
  dto: TimesheetDto;
  choice: PeriodChoice;
  onPeriod: (p: { from: string; to: string }) => void;
  actionsSlot: HTMLElement | null;
}

type SheetFilters = ReturnType<typeof useSheetFilters>;
type Saving = ReturnType<typeof useSaveCells>;
type SheetActions = ReturnType<typeof useSheetActions>;

/** Everything that may need to be said over the sheet. */
function useSheetMessages(dto: TimesheetDto, saving: Saving, actions: SheetActions, notice: string, onClearNotice: () => void) {
  const failure = saving.failed ? [describeFailedCells(saving.failed.cells, dto.rows), apiMessage(saving.error)].filter(Boolean).join('. ') : null;
  const removeError = actions.removeAdjust.error;
  const errors = [
    ...(notice ? [{ id: 'notice', text: notice, onDismiss: onClearNotice }] : []),
    ...(removeError ? [{ id: 'remove', text: errorMessage(removeError), onDismiss: () => actions.removeAdjust.reset() }] : []),
    ...(saving.state === 'failed' && !saving.failed ? [{ id: 'save', text: `Chưa lưu định mức. ${errorMessage(saving.error)}`, onDismiss: saving.dismiss }] : []),
  ];
  return { failure, errors };
}

function SheetDialogs({ dto, dialog, onDialog, adjustingId, onAdjusting, leaveId, onLeaveId, problems, onJump, actions, closableFrom }: {
  leaveId: string | null;
  onLeaveId: (id: string | null) => void;
  dto: TimesheetDto;
  dialog: SheetDialog;
  onDialog: (next: SheetDialog) => void;
  adjustingId: string | null;
  onAdjusting: (id: string | null) => void;
  problems: readonly TimesheetProblem[];
  onJump: (p: TimesheetProblem) => void;
  actions: SheetActions;
  closableFrom: string | null;
}) {
  const close = () => onDialog(null);
  return (
    <>
      <ReviewDialog open={dialog === 'review'} isClosed={dto.status === 'closed'} onClose={close} closableFrom={closableFrom} problems={problems} onJump={onJump} isBusy={actions.close.isPending} error={actions.close.error} onLock={() => actions.close.mutate(undefined, { onSuccess: close })} />
      <ReopenDialog open={dialog === 'reopen'} onClose={close} isBusy={actions.reopen.isPending} error={actions.reopen.error} onReopen={(reason) => actions.reopen.mutate(reason, { onSuccess: close })} />
      <AdjustDialog
        row={dto.rows.find((r) => r.employeeId === adjustingId) ?? null}
        onClose={() => onAdjusting(null)}
        isBusy={actions.addAdjust.isPending || actions.removeAdjust.isPending}
        error={actions.addAdjust.error}
        onAdd={(input) => adjustingId && actions.addAdjust.mutate({ employeeId: adjustingId, ...input })}
        onRemove={(id) => actions.removeAdjust.mutate(id)}
      />
      <LeaveChangeDialog
        row={dto.rows.find((r) => r.employeeId === leaveId) ?? null}
        onClose={() => onLeaveId(null)}
        isBusy={actions.addLeave.isPending || actions.removeLeave.isPending}
        error={actions.addLeave.error ?? actions.removeLeave.error}
        onAdd={(input) => leaveId && actions.addLeave.mutate({ employeeId: leaveId, ...input })}
        onRemove={(id) => actions.removeLeave.mutate(id)}
      />
    </>
  );
}

function SheetFilterBar({ dto, rows, filters, table, days, todayKey, onScroll, onDownload }: {
  dto: TimesheetDto;
  rows: readonly GridRow[];
  filters: SheetFilters;
  table: GridTable;
  days: readonly DayColumn[];
  todayKey: string | undefined;
  onScroll: (columnId: string, side?: 'center' | 'start') => void;
  onDownload: () => void;
}) {
  const onSearchEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    const first = filters.visible[0];
    if (e.key !== 'Enter' || !first) return;
    e.currentTarget.blur();
    const column = todayKey ?? days[0]?.key;
    if (column) table.setFocusedCell(first.id, column);
  };
  return (
    <FilterBar
      filters={{ query: filters.query, onQuery: filters.setQuery, onSearchEnter, regions: dto.regions, pickedRegions: filters.regions, onRegions: filters.setRegions, depts: filters.deptItems, pickedDepts: filters.depts, onDepts: filters.setDepts, isFiltered: filters.isFiltered, onClear: filters.clear, shown: filters.visible.length, total: rows.length }}
      hasToday={!!todayKey}
      onToday={() => todayKey && onScroll(todayKey)}
      onTotals={() => onScroll('thucTe', 'start')}
      onDownload={onDownload}
      year={dto.year}
    />
  );
}

function useDownload(dto: TimesheetDto, days: readonly DayColumn[], notes: Record<string, string>, adjustmentWords: Record<string, string>, visible: readonly GridRow[], onError: (text: string) => void) {
  return () => {
    exportTimesheet({
      rows: visible, days, notes, adjustmentNotes: adjustmentWords, isClosed: dto.status === 'closed', isFreeRange: !dto.periodId,
      from: dto.from, to: dto.to, year: dto.year, month: dto.month,
      regions: dto.regions.map((r) => ({ id: r.id, name: r.name, norm: dto.norms[r.id] ?? 0 })),
    }).then(() => toast.success('Đã tải file Excel')).catch((e: unknown) => onError(`Chưa tải được file Excel. ${errorMessage(e)}`));
  };
}

export function GridTab({ dto, choice, onPeriod, actionsSlot }: Props) {
  const days = useMemo(() => dayColumns(dto), [dto]);
  const rows = useMemo(() => gridRows(dto, days), [dto, days]);
  const notes = useMemo(() => notesOf(dto, days), [dto, days]);
  const periodId = dto.periodId;
  const canEdit = !!periodId && dto.status !== 'closed';
  const [dialog, setDialog] = useState<SheetDialog>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [leaveId, setLeaveId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const saving = useSaveCells(choice);
  const actions = useSheetActions(choice, periodId);
  const regionIds = useMemo(() => dto.regions.map((r) => r.id), [dto.regions]);
  const filters = useSheetFilters(rows, regionIds);
  const leave = useOverLeaveWarning(rows);
  const { grid, table, todayKey, adjustmentWords, rowHeight } = useSheetGrid({ dto, days, rows, visible: filters.visible, canEdit, save: saving.save, onAdjust: setAdjustingId, onLeave: setLeaveId });
  const onQuickCode = useQuickCodes({ table, days, rows, canEdit });
  const noteApi = useNoteApi({ notes, days, periodId, canEdit, save: saving.save });
  const host = useRef<HTMLDivElement>(null);
  const height = useGridHeight(host, filters.visible.length, rowHeight);
  const scrollTo = (columnId: string, side?: 'center' | 'start') => scrollGridTo(table, host.current?.querySelector<HTMLElement>('[role="grid"]'), columnId, side);
  const [params] = useSearchParams();
  const askedPerson = params.get('nv');
  useOpenOnDay(dayToOpen(days, params.get('ngay'), todayKey), scrollTo, (columnId) => {
    if (askedPerson && dto.rows.some((r) => r.employeeId === askedPerson)) table.setFocusedCell(askedPerson, columnId);
  });
  const absences = useAbsencesBetween(dto.from, dto.to, !!periodId);
  const problems = useMemo(() => (periodId ? findProblems(dto, days, rows, absences) : []), [dto, days, rows, periodId, absences]);
  const navigate = useNavigate();
  const entered = dto.rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.entered).length, 0);
  const jump = (p: TimesheetProblem) => {
    setDialog(null);
    // Papers are kept on the Nghỉ tab: open that absence's Giấy tờ there.
    if (p.absence) {
      void navigate(papersLink(p.absence));
      return;
    }
    filters.clear();
    window.setTimeout(() => {
      table.setFocusedCell(p.employeeId, p.columnId);
      scrollTo(p.columnId);
    }, 250);
  };
  const download = useDownload(dto, days, notes, adjustmentWords, filters.visible, setNotice);
  const { failure, errors } = useSheetMessages(dto, saving, actions, notice, () => setNotice(''));
  return (
    <NotesContext.Provider value={noteApi}>
      {actionsSlot && createPortal(<PageActions dto={dto} problems={problems.length} entered={entered} hasPeople={rows.length > 0} onReview={() => setDialog('review')} onReopen={() => setDialog('reopen')} />, actionsSlot)}
      <div className="contents max-md:order-3 max-md:flex max-md:flex-col max-md:gap-2.5">
        <PeriodStrip dto={dto} canEdit={canEdit} saveState={saving.state} onPeriod={onPeriod} onNorm={(regionId, norm) => saving.track(actions.norms.mutateAsync({ [regionId]: norm }))} onNormInvalid={() => setNotice('Định mức phải là số lớn hơn 0.')} />
        <CodeLegend rows={filters.visible} days={days} />
      </div>
      <SheetFilterBar dto={dto} rows={rows} filters={filters} table={table} days={days} todayKey={todayKey} onScroll={scrollTo} onDownload={download} />
      <PeriodBanners dto={dto} onOpenAhead={() => actions.openAhead.mutate()} isOpening={actions.openAhead.isPending} />
      <SheetNotices failure={failure} onRetry={saving.retry} onDismissFailure={saving.dismiss} warning={leave.warning} onDismissWarning={leave.dismiss} errors={errors} saveState={saving.state} />
      {rows.length === 0 ? <NoPeople /> : filters.visible.length === 0 ? <NoMatch onClear={filters.clear} /> : (
        <div ref={host} className="max-md:order-2" onKeyDownCapture={onQuickCode}><DataGrid {...grid} height={height} /></div>
      )}
      <SheetDialogs dto={dto} dialog={dialog} onDialog={setDialog} adjustingId={adjustingId} onAdjusting={setAdjustingId} leaveId={leaveId} onLeaveId={setLeaveId} problems={problems} onJump={jump} actions={actions} closableFrom={dto.today < dto.to ? dayMonth(dto.to) : null} />
    </NotesContext.Provider>
  );
}
