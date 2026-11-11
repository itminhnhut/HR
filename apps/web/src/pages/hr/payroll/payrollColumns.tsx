import {
  Banknote,
  Calculator,
  Clock,
  Coins,
  CirclePlus,
  Info,
  Landmark,
  Pencil,
  ReceiptText,
  ShieldCheck,
  StickyNote,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { PayrollLineDto, PayrollMonthDto } from '../../../api';
import { FitText } from '../timesheet/columns';
import { CopyValue } from '../timesheet/CopyValue';
import { fitColumnWidth, textMeasurer } from '../timesheet/gridLayout';
import { PAYSLIP_LINK_WIDTH, PayslipLink } from './download/PayslipDrawer';
import { PayrollInputCell } from './PayrollInputCell';
import { BracketCell, DependantsCell } from './PayrollSheetCells';
import {
  BlockCell,
  CodeCell,
  ContractChip,
  PayrollValueCell,
  RegionChip,
  TotalCell,
  type PayrollMonthContext,
} from './PayrollCell';
import {
  columnTotals,
  formatValue,
  printedNote,
  type PayrollBand,
  type PayrollBandId,
  type PayrollColumnSpec,
  type PayrollGridRow,
} from './payrollModel';

/** The payroll grid's columns for the vendor data grid: bands A–H, the frozen name columns, cells (spec 11.2). */

const BAND_ICON: Record<PayrollBandId, LucideIcon> = {
  info: Users,
  more: Info,
  A: Banknote,
  B: Calculator,
  B2: Clock,
  B3: CirclePlus,
  C: Coins,
  D: ShieldCheck,
  E: ReceiptText,
  F: Wallet,
  G: Landmark,
  H: StickyNote,
};

const plain = { enableSorting: false, enableHiding: false, enableResizing: false, enableCellEditing: false };
type CellArgs = { row: { original: PayrollGridRow } };

/** `stickyLeft`: a long band keeps its words next to the frozen columns while the rest scrolls under it (spec 4.22). */
const band = (label: string, tone: string, Icon: LucideIcon, stickyLeft?: number) =>
  function Band() {
    const isSticky = stickyLeft !== undefined;
    return (
      <div
        className={`-mx-3 -my-1.5 flex h-8 items-center gap-1.5 text-xs font-bold tracking-wide whitespace-nowrap ${isSticky ? 'pl-2' : 'justify-center'} ${tone}`}
      >
        <span
          className="inline-flex items-center gap-1.5"
          style={isSticky ? { position: 'sticky', left: stickyLeft } : undefined}
        >
          <Icon className="size-3.5 shrink-0" />
          {label}
        </span>
      </div>
    );
  };

/** `canType`: a month input still open carries a small pencil next to its number (F10). */
const head = (spec: PayrollColumnSpec, canType: boolean) =>
  function Head() {
    return (
      <div
        title={spec.title}
        className="flex h-full w-full flex-col items-center justify-center text-xs leading-4 font-medium whitespace-nowrap"
      >
        {spec.no && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 tabular-nums">
            {canType && <Pencil aria-label="Cột gõ được" className="size-2.5 text-blue-500" />}({spec.no})
          </span>
        )}
        <span>{spec.label}</span>
      </div>
    );
  };

const MEASURE_FONT = '400 14px "Be Vietnam Pro", system-ui, sans-serif';

function widthOf(
  spec: PayrollColumnSpec,
  lines: readonly PayrollLineDto[],
  totals: Readonly<Record<string, number>>,
): number {
  const measure = textMeasurer(MEASURE_FONT);
  const total = totals[spec.id];
  const texts = [
    ...lines.map((l) => formatValue(spec.kind, spec.value(l))),
    ...(total === undefined ? [] : [formatValue(spec.kind, total)]),
  ];
  // A typed cell shows a pencil before its number.
  const valueWidth = fitColumnWidth(texts, { min: 72, max: 200, measure }) + (spec.input ? 16 : 0);
  return Math.max(valueWidth, Math.ceil(measure(spec.label) * 0.86) + 28);
}

const textCell = (text: string, label: string, className = 'text-sm') => (
  <CopyValue inGrid text={text} label={label}>
    <FitText text={text} limit={60} className={`min-w-0 ${className}`} />
  </CopyValue>
);

function infoRenderer(id: string, month: PayrollMonthDto): (line: PayrollLineDto, stt: number) => ReactNode {
  const contract = (l: PayrollLineDto) =>
    month.contractTypes.find((t) => t.id === l.contractTypeId)?.name ?? l.contractTypeId;
  const renderers: Record<string, (l: PayrollLineDto, stt: number) => ReactNode> = {
    stt: (_l, stt) => <span className="block text-center text-sm text-slate-600">{stt}</span>,
    ma: (l) => <CodeCell line={l} />,
    ten: (l) => (
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 flex-1">{textCell(l.fullName, 'họ tên', 'text-sm font-medium')}</span>
        <PayslipLink line={l} />
      </span>
    ),
    cd: (l) => textCell(l.sheet?.title ?? '', 'chức danh'),
    npt: (l) => <DependantsCell line={l} />,
    bp: (l) => textCell(l.department, 'bộ phận'),
    kv: (l) => <RegionChip regionId={l.regionId} regions={month.regions} />,
    hd: (l) => <ContractChip name={contract(l)} isProbation={l.probation} />,
    khoi: (l) => <BlockCell line={l} />,
    ghiChu: (l) => textCell(printedNote(l.note), 'ghi chú', 'text-xs text-slate-600'),
  };
  return renderers[id] ?? (() => null);
}

/** The heading of a group row and the words of the total row sit in the name column. */
function SpecialCell({ row, id }: { row: Exclude<PayrollGridRow, { kind: 'line' }>; id: string }) {
  if (id !== 'ten') return <span data-row-kind={row.kind} />;
  if (row.kind === 'total')
    return (
      <span data-row-kind="total" className="block truncate text-sm font-bold text-slate-900">
        {row.label}
      </span>
    );
  return (
    <span data-row-kind="group" className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-700">
      <FitText text={row.label} limit={22} className="min-w-0" />
      <span className="shrink-0 rounded-full bg-white px-1.5 text-[11px] text-slate-600 tabular-nums">{row.count}</span>
    </span>
  );
}

const INFO_WIDTH: Record<string, number> = {
  stt: 52,
  ma: 96,
  ten: 168,
  cd: 120,
  bp: 120,
  npt: 64,
  bracket: 72,
  kv: 88,
  hd: 152,
  khoi: 116,
  ghiChu: 240,
};

const GROUP_FONT = '600 12px "Be Vietnam Pro", system-ui, sans-serif';
/** Cell padding, the gap and the count chip next to a group heading. */
const GROUP_EXTRA = 16 + 6 + 28;
const NAME_MAX = 260;

const NAME_FONT = '500 14px "Be Vietnam Pro", system-ui, sans-serif';
const TEXT_FONT = '400 14px "Be Vietnam Pro", system-ui, sans-serif';
const TEXT_MAX = 320;

/** Wide enough for the longest value, so a name or a department is never cut; at least the usual width. */
function textWidth(values: readonly string[], font: string, min = 120): number {
  const measure = textMeasurer(font);
  const widest = Math.max(0, ...values.map((v) => Math.ceil(measure(v))));
  return Math.min(TEXT_MAX, Math.max(min, widest + 44));
}

/** The name column fits the longest group heading ("HCM · HĐLĐ 12 tháng · KD"), so no heading is cut. */
function nameWidth(groupLabels: readonly string[]): number {
  const measure = textMeasurer(GROUP_FONT);
  const widest = Math.max(0, ...groupLabels.map((l) => Math.ceil(measure(l))));
  return Math.min(NAME_MAX, Math.max(INFO_WIDTH.ten ?? 168, widest + GROUP_EXTRA));
}

interface ColumnContext {
  month: PayrollMonthDto;
  infoWidths: Readonly<Record<string, number>>;
  context: PayrollMonthContext;
  tint: string;
  /** The whole month's lines and totals: widths stay put while the filters change. */
  lines: readonly PayrollLineDto[];
  widthTotals: Readonly<Record<string, number>>;
  /** Totals of the rows shown. */
  totals: Readonly<Record<string, number>>;
}

function columnOf(spec: PayrollColumnSpec, ctx: ColumnContext) {
  const { month, infoWidths, context, tint, lines, widthTotals, totals } = ctx;
  const render = infoRenderer(spec.id, month);
  const size = spec.kind === 'info' ? (infoWidths[spec.id] ?? 120) : widthOf(spec, lines, widthTotals);
  return {
    id: spec.id,
    accessorFn: (r: PayrollGridRow) => r.id,
    size,
    ...plain,
    header: head(spec, !!spec.input && !context.isLocked),
    meta: { label: spec.label, cellClass: tint },
    cell: ({ row }: CellArgs) => {
      const r = row.original;
      if (r.kind === 'total' && spec.kind !== 'info') return <TotalCell column={spec} value={totals[spec.id]} />;
      if (r.kind !== 'line') return <SpecialCell row={r} id={spec.id} />;
      if (spec.id === 'bracket') return <BracketCell line={r.line} bracket={spec.value(r.line)} />;
      if (spec.kind === 'info') return render(r.line, r.stt);
      return spec.input ? (
        <PayrollInputCell line={r.line} column={spec} month={context} />
      ) : (
        <PayrollValueCell line={r.line} column={spec} month={context} />
      );
    },
  };
}

/** Columns the narrowest screens keep frozen, like Chấm công: room for the numbers on a phone. */
export function payrollPins(viewportWidth: number): string[] {
  if (viewportWidth < 640) return ['ten'];
  return viewportWidth < 1280 ? ['ma', 'ten'] : ['stt', 'ma', 'ten'];
}

export interface PayrollColumnsArgs {
  bands: readonly PayrollBand[];
  month: PayrollMonthDto;
  context: PayrollMonthContext;
  pinned: readonly string[];
  /** Totals of the rows shown (the total row). */
  totals: Readonly<Record<string, number>>;
  /** Every group heading of the month, filtered or not: the name column fits them. */
  groupLabels: readonly string[];
}

export function makePayrollColumns(args: PayrollColumnsArgs) {
  const { bands, month, context, pinned, totals, groupLabels } = args;
  const widthTotals = columnTotals(month.lines, bands);
  const infoWidths = {
    ...INFO_WIDTH,
    ten: Math.max(
      nameWidth(groupLabels),
      textWidth(
        month.lines.map((l) => l.fullName),
        NAME_FONT,
        INFO_WIDTH.ten,
      ) + PAYSLIP_LINK_WIDTH,
    ),
    bp: textWidth(
      month.lines.map((l) => l.department),
      TEXT_FONT,
      INFO_WIDTH.bp,
    ),
    cd: textWidth(
      month.lines.map((l) => l.sheet?.title ?? ''),
      TEXT_FONT,
      INFO_WIDTH.cd,
    ),
  };
  const ctx = (tint: string): ColumnContext => ({
    month,
    infoWidths,
    context,
    tint,
    lines: month.lines,
    widthTotals,
    totals,
  });
  const all = bands.flatMap((b) => b.columns.map((spec) => ({ band: b, column: columnOf(spec, ctx(b.tint)) })));
  const frozen = all.filter((c) => pinned.includes(c.column.id));
  const stickyLeft = frozen.reduce((sum, c) => sum + c.column.size, 0) + 8;
  // An info column a narrow screen does not freeze joins the next band, so "NHÂN VIÊN" shows once.
  const bandOf = (id: PayrollBandId) => (id === 'info' ? 'more' : id);
  const rest = bands
    .map((b) => ({
      band: b,
      columns: all.filter((c) => bandOf(c.band.id) === b.id && !pinned.includes(c.column.id)).map((c) => c.column),
    }))
    .filter((g) => g.columns.length > 0);
  return [
    {
      id: 'gFrozen',
      enableSorting: false,
      header: band('NHÂN VIÊN', 'bg-blue-600 text-white', Users),
      columns: frozen.map((c) => c.column),
    },
    ...rest.map(({ band: b, columns }) => ({
      id: `g${b.id}`,
      enableSorting: false,
      header: band(b.label, b.tone, BAND_ICON[b.id], b.id === 'info' || b.id === 'more' ? undefined : stickyLeft),
      columns,
    })),
  ];
}
