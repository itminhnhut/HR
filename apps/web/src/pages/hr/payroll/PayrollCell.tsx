import type { PayrollConfigRef, PayrollPersonSetting, RegionTone } from '@careers/shared';
import { CalendarDays, Calculator, Hourglass, IdCard, MapPin, Settings2, ShieldCheck, UserCog } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { PayrollLineDto, PayrollOverrideDto } from '../../../api';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { REGION_TONE } from '../timesheet/columns';
import { cellSearch, sourceOf } from './cellSources';
import { sourceTail } from './config/sourceWords';
import { isTyped, lockReasonOf } from './monthInputsModel';
import { CopyValue } from '../timesheet/CopyValue';
import {
  BLOCK_FROM_PERSON,
  blockLink,
  configLink,
  contractShort,
  copyValue,
  formatValue,
  isBlockFromPerson,
  levelsSearch,
  regionShort,
  timesheetLink,
  type PayrollColumnSpec,
} from './payrollModel';

/** One cell of the payroll grid: the number, its formula on hover, copy, marks and links back to the source. */

export interface PayrollMonthContext {
  monthKey: string;
  /** Last day of the period: the timesheet opens on it. */
  to: string;
  isLocked: boolean;
  /** Why the month inputs are read only (approved or paid), shown on their cells; null while they can be typed. */
  lockReason: string | null;
}

const LINK = 'font-medium text-sky-300 underline underline-offset-2 hover:text-white';

function RefLine({ monthKey, refItem, isPlain }: { monthKey: string; refItem: PayrollConfigRef; isPlain: boolean }) {
  const words = `${refItem.label} ${refItem.value} · từ ${refItem.from}${sourceTail(refItem.source)}`;
  if (isPlain) return <li>{words}</li>;
  return (
    <li>
      <Link to={configLink(monthKey, refItem)} className="text-inherit no-underline hover:underline">
        {words}
      </Link>
    </li>
  );
}

function OverrideLines({ override, column }: { override: PayrollOverrideDto; column: PayrollColumnSpec }) {
  return (
    <>
      <p className="m-0 font-semibold">{`Số tính ${formatValue(column.kind, override.computed)} · HR gõ ${formatValue(column.kind, override.typed)}`}</p>
      <p className="m-0">{`Lý do: ${override.reason}`}</p>
    </>
  );
}

function TimesheetLinks({ line, month }: { line: PayrollLineDto; month: PayrollMonthContext }) {
  return (
    <span className="flex flex-wrap gap-3">
      <Link to={timesheetLink(month, line.employeeId)} className={LINK}>
        Xem ở Bảng công
      </Link>
      <Link to={`/hr/cham-cong?ky=${month.monthKey}`} className={LINK}>
        Mở lại kỳ công
      </Link>
    </span>
  );
}

/** On a month input: who typed it, or why it is read only. */
function InputLine({
  line,
  column,
  month,
}: {
  line: PayrollLineDto;
  column: PayrollColumnSpec;
  month: PayrollMonthContext;
}) {
  if (!column.input) return null;
  const reason = lockReasonOf(column.input, line, month.lockReason);
  if (reason) return <p className="m-0 text-[11px] text-amber-200">{reason}</p>;
  if (!isTyped(column.input, line.inputs)) return <p className="m-0 text-[11px] text-slate-300">Bấm để nhập tay.</p>;
  const by = line.inputs.updatedBy ? ` bởi ${line.inputs.updatedBy}` : '';
  return <p className="m-0 text-[11px] text-sky-200">{`Đã nhập tay${by}. Bấm để sửa hoặc về số tính.`}</p>;
}

export function CellTip({
  line,
  column,
  month,
  own,
  override,
}: {
  line: PayrollLineDto;
  column: PayrollColumnSpec;
  month: PayrollMonthContext;
  own: PayrollPersonSetting[];
  override: PayrollOverrideDto | undefined;
}) {
  const explain = column.cell ? line.explain[column.cell] : undefined;
  const refs = (explain?.refs ?? []).filter((r) => !r.isPersonal);
  const first = own[0] ? { key: own[0].key, area: own[0].area } : refs[0];
  // A cell with its sources over the grid says so; Cấu hình is reached from there, never by leaving the tab.
  const hasSources = !!sourceOf(column.cell);
  // A month input still open is typed on a click, so its sources are a link in these words.
  const isEditable = !!column.input && !lockReasonOf(column.input, line, month.lockReason);
  const { pathname, search } = useLocation();
  return (
    <div className="flex max-w-sm flex-col gap-1 text-left leading-5">
      <p className="m-0 text-[11px] text-slate-300">{`(${column.no ?? ''}) ${column.label} · ${line.fullName}`}</p>
      {override && <OverrideLines override={override} column={column} />}
      {own.map((s) => (
        <p key={s.key} className="m-0 font-semibold">{`Riêng ${line.fullName} từ ${s.from}: ${s.text}`}</p>
      ))}
      {explain && <p className="m-0 tabular-nums">{explain.formula}</p>}
      {refs.length > 0 && (
        <ul className="m-0 list-none p-0 text-[11px] text-slate-300">
          {refs.map((r) => (
            <RefLine key={r.key} monthKey={month.monthKey} refItem={r} isPlain={hasSources} />
          ))}
        </ul>
      )}
      {hasSources && !isEditable && (
        <p className="m-0 text-[11px] text-sky-200">
          <Calculator className="mr-1 inline size-3" />
          Bấm số để xem cách tính và sửa cấu hình, hồ sơ.
        </p>
      )}
      {hasSources && isEditable && column.cell && (
        <Link to={{ pathname, search: cellSearch(search, line.employeeId, column.cell) }} className={LINK}>
          <Calculator className="mr-1 inline size-3" />
          Xem cách tính và cấu hình
        </Link>
      )}
      {first && !hasSources && (
        <Link to={configLink(month.monthKey, first)} className={LINK}>
          <Settings2 className="mr-1 inline size-3" />
          Mở cấu hình
        </Link>
      )}
      {explain?.fromTimesheet && <TimesheetLinks line={line} month={month} />}
      <InputLine line={line} column={column} month={month} />
    </div>
  );
}

export function Marks({ isTyped, isHand = false, isOwn }: { isTyped: boolean; isHand?: boolean; isOwn: boolean }) {
  return (
    <>
      {isHand && !isTyped && (
        <span
          role="img"
          aria-label="Đã nhập tay"
          className="absolute -top-1.5 -right-2 size-2.5 bg-sky-500 [clip-path:polygon(0_0,100%_0,100%_100%)]"
        />
      )}
      {isTyped && (
        <span
          role="img"
          aria-label="Ô gõ đè"
          className="absolute -top-1.5 -right-2 size-2.5 bg-amber-500 [clip-path:polygon(0_0,100%_0,100%_100%)]"
        />
      )}
      {isOwn && (
        <span
          role="img"
          aria-label="Có cấu hình riêng"
          className="absolute top-1/2 -left-2.5 size-1.5 -translate-y-1/2 rounded-full bg-teal-600"
        />
      )}
    </>
  );
}

/** Group A: the person's Hồ sơ lương opens over the grid, on the levels; the tab and the grid stay as they are. */
function LevelsLink({ line, text }: { line: PayrollLineDto; text: string }) {
  const { pathname, search } = useLocation();
  return (
    <Link
      to={{ pathname, search: levelsSearch(search, line.employeeId) }}
      aria-label={`Mở mức lương của ${line.fullName} ở Hồ sơ lương`}
      className="inline-flex items-center gap-1 text-blue-700 no-underline hover:underline"
    >
      <IdCard aria-hidden="true" className="size-3 opacity-60" />
      {text}
    </Link>
  );
}

/** A computed number: a click opens how it is computed and where its inputs are edited, over the grid. */
function SourcesLink(p: { line: PayrollLineDto; column: PayrollColumnSpec; text: string; tone: string }) {
  const { pathname, search } = useLocation();
  const { line, column } = p;
  if (!column.cell) return <span className={p.tone}>{p.text}</span>;
  return (
    <Link
      to={{ pathname, search: cellSearch(search, line.employeeId, column.cell) }}
      aria-label={`Xem cách tính ${column.label} của ${line.fullName}`}
      className={`inline-flex items-center no-underline decoration-dotted underline-offset-2 hover:underline max-sm:min-h-11 ${p.tone}`}
    >
      {p.text}
    </Link>
  );
}

function ValueText({
  line,
  column,
  month,
  text,
}: {
  line: PayrollLineDto;
  column: PayrollColumnSpec;
  month: PayrollMonthContext;
  text: string;
}) {
  const tone = column.isStrong ? 'font-bold text-green-800' : text === '0' ? 'text-slate-400' : 'text-slate-800';
  if (column.toProfile) return <LevelsLink line={line} text={text} />;
  if (sourceOf(column.cell)) return <SourcesLink line={line} column={column} text={text} tone={tone} />;
  if (!column.toTimesheet) return <span className={tone}>{text}</span>;
  return (
    <Link
      to={timesheetLink(month, line.employeeId)}
      aria-label={`Xem công của ${line.fullName} ở Bảng công`}
      className="inline-flex items-center gap-1 text-blue-700 no-underline hover:underline"
    >
      <CalendarDays aria-hidden="true" className="size-3 opacity-60" />
      {text}
    </Link>
  );
}

/** The cell's words: on hover, and on a click for a computed number (the timesheet cells keep their link). */
function Explained({ body, tip, label, isLink }: { body: ReactNode; tip: ReactNode; label: string; isLink: boolean }) {
  if (isLink) {
    return (
      <Tooltip>
        <TooltipTrigger delay={150} render={<span className="inline-flex" />}>
          {body}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          {tip}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        aria-label={`Giải thích ${label}`}
        tabIndex={-1}
        className="inline-flex cursor-help border-0 bg-transparent p-0 text-inherit"
        render={<button type="button" />}
      >
        {body}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        initialFocus={(type) => type === 'keyboard'}
        className="w-auto max-w-sm gap-1 rounded-md bg-slate-900 px-3 py-2 text-xs text-white"
      >
        {tip}
      </PopoverContent>
    </Popover>
  );
}

/** A number of a person's row (Q5–Q7, spec 4.4, 4.6, 6.3). */
export function PayrollValueCell({
  line,
  column,
  month,
}: {
  line: PayrollLineDto;
  column: PayrollColumnSpec;
  month: PayrollMonthContext;
}) {
  const value = column.value(line);
  const text = formatValue(column.kind, value);
  const override = line.overrides.find((o) => o.cell === column.cell);
  const own = line.personSettings.filter((s) => !!column.cell && s.cells.includes(column.cell));
  const hasTip = !!(column.cell && line.explain[column.cell]) || !!override || own.length > 0 || !!column.input;
  const label = `(${column.no ?? ''}) ${column.label}`.replace('() ', '');
  const body = (
    <span className="relative inline-flex items-center">
      <ValueText line={line} column={column} month={month} text={text} />
      <Marks
        isTyped={!!override}
        isHand={!!column.input && isTyped(column.input, line.inputs)}
        isOwn={own.length > 0}
      />
    </span>
  );
  const tip = <CellTip line={line} column={column} month={month} own={own} override={override} />;
  return (
    <CopyValue inGrid side="left" text={copyValue(column.kind, value)} label={label}>
      <span className="block w-full text-right text-sm tabular-nums">
        {hasTip ? (
          <Explained
            body={body}
            tip={tip}
            label={label}
            isLink={!!column.toTimesheet || !!column.toProfile || !!sourceOf(column.cell)}
          />
        ) : (
          body
        )}
      </span>
    </CopyValue>
  );
}

const CHIP =
  'inline-flex h-6 max-w-full min-w-0 cursor-default items-center gap-1 rounded-full border px-2 text-xs whitespace-nowrap no-underline';

/** Khu vực, short ("HCM"): the full name on hover, so the chip never runs past its column. */
export function RegionChip({
  regionId,
  regions,
}: {
  regionId: string;
  regions: readonly { id: string; name: string; tone: RegionTone }[];
}) {
  const region = regions.find((r) => r.id === regionId);
  const name = region?.name ?? regionId;
  return (
    <abbr
      title={name}
      className={`${CHIP} font-semibold ${region ? REGION_TONE[region.tone] : 'border-slate-200 bg-slate-100 text-slate-700'}`}
    >
      <MapPin className="size-3 shrink-0" />
      <span className="truncate">{regionShort(name)}</span>
    </abbr>
  );
}

/** Loại HĐ, short when long ("HĐLĐ KXĐTH"): the full name on hover. */
export function ContractChip({ name, isProbation }: { name: string; isProbation: boolean }) {
  const tone = isProbation
    ? 'border-amber-300 bg-amber-50 text-amber-800'
    : 'border-green-300 bg-green-50 text-green-800';
  const Icon = isProbation ? Hourglass : ShieldCheck;
  return (
    <abbr title={name} className={`${CHIP} font-medium ${tone}`}>
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{contractShort(name)}</span>
    </abbr>
  );
}

/** Khối: a link to the person's form in Chấm công → Nhân viên; a mark when the block came from the person. */
export function BlockCell({ line }: { line: PayrollLineDto }) {
  const isFromPerson = isBlockFromPerson(line);
  return (
    <span className="flex items-center gap-1 text-sm">
      <Link
        to={blockLink(line)}
        aria-label={`Sửa khối ${line.fullName}${line.block ? `: ${line.block}` : ': thiếu khối'}`}
        className={`font-medium underline-offset-2 hover:underline ${line.block ? 'text-slate-700 no-underline' : 'text-red-700'}`}
      >
        {line.block ?? 'Thiếu'}
      </Link>
      {isFromPerson && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                role="img"
                aria-label={BLOCK_FROM_PERSON}
                className="inline-flex size-4 items-center justify-center"
              />
            }
          >
            <span className="size-1.5 rounded-full bg-amber-400" />
          </TooltipTrigger>
          <TooltipContent>{`${BLOCK_FROM_PERSON} (lần chốt công chưa có khối)`}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

/** Mã NV, with an icon when the person has settings of their own (spec 4.6). */
export function CodeCell({ line }: { line: PayrollLineDto }) {
  const own = line.personSettings;
  return (
    <CopyValue inGrid text={line.code} label="mã NV">
      <span className="flex min-w-0 items-center gap-1 text-sm text-slate-600">
        <span className="truncate">{line.code}</span>
        {own.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  role="img"
                  aria-label={`${line.fullName} có cấu hình riêng`}
                  className="inline-flex text-teal-700"
                />
              }
            >
              <UserCog className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>{own.map((s) => `Riêng từ ${s.from}: ${s.text}`).join(' · ')}</TooltipContent>
          </Tooltip>
        )}
      </span>
    </CopyValue>
  );
}

/** A cell of the total row: the column's sum over the rows shown, empty where a total means nothing. */
export function TotalCell({ column, value }: { column: PayrollColumnSpec; value: number | undefined }): ReactNode {
  if (value === undefined || column.kind !== 'money') return null;
  return (
    <CopyValue inGrid side="left" text={copyValue('money', value)} label={`tổng (${column.no ?? ''}) ${column.label}`}>
      <span className="block w-full text-right text-sm font-bold text-slate-900 tabular-nums">
        {formatValue('money', value)}
      </span>
    </CopyValue>
  );
}
