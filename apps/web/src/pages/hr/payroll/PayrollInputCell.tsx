import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { RotateCcw, Save } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PayrollLineDto, PayrollMonthInputsInput } from '../../../api';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { CopyValue } from '../timesheet/CopyValue';
import {
  editText,
  isNumberField,
  isTyped,
  lockReasonOf,
  parseNumberInput,
  resetPatch,
  type PayrollNumberField,
} from './monthInputsModel';
import { CellTip, PayrollValueCell, type PayrollMonthContext } from './PayrollCell';
import { cellLabel, InputValue, saveError } from './inputParts';
import { PayrollListCell } from './PayrollListEditor';
import { copyValue, type PayrollColumnSpec } from './payrollModel';
import { useSaveMonthInputs } from './queries';

/**
 * A month input in the grid (spec 2 (4), 5.3): (19), (21)–(23) typed inline, Enter saves and Esc cancels; (24) and
 * (32) open a small list editor. An approved month, or a % without a KPI, shows the number read only with the reason.
 */

interface CellProps {
  line: PayrollLineDto;
  column: PayrollColumnSpec;
  month: PayrollMonthContext;
}

export function PayrollInputCell({ line, column, month }: CellProps) {
  const field = column.input;
  if (!field || lockReasonOf(field, line, month.lockReason)) {
    return <PayrollValueCell line={line} column={column} month={month} />;
  }
  if (!isNumberField(field)) return <PayrollListCell line={line} column={column} month={month} field={field} />;
  return <NumberCell line={line} column={column} month={month} field={field} />;
}

/** The cell's line is 20px tall: the 28px box reaches 4px above and below it, so its number stays on the row's line. */
const CELL_BUTTON =
  '-my-1 flex h-full min-h-7 w-full cursor-text items-center justify-end rounded border border-transparent bg-transparent px-1 text-right text-sm tabular-nums hover:border-blue-300 hover:bg-white focus-visible:border-blue-500 focus-visible:outline-none';

function NumberDisplay({ line, column, month, onEdit }: CellProps & { onEdit: () => void }) {
  const own = line.personSettings.filter((s) => !!column.cell && s.cells.includes(column.cell));
  const override = line.overrides.find((o) => o.cell === column.cell);
  const label = cellLabel(column);
  return (
    <CopyValue inGrid side="left" text={copyValue(column.kind, column.value(line))} label={label}>
      <Tooltip>
        <TooltipTrigger
          delay={150}
          render={
            <button
              type="button"
              aria-label={`Sửa ${label} của ${line.fullName}`}
              onClick={onEdit}
              className={CELL_BUTTON}
            />
          }
        >
          <InputValue line={line} column={column} />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <CellTip line={line} column={column} month={month} own={own} override={override} />
        </TooltipContent>
      </Tooltip>
    </CopyValue>
  );
}

/**
 * The input inside the grid. Its keys never reach the grid (arrows move the caret, not the selection), so Enter and
 * Esc are read here, on the element itself, before the grid's own listener.
 */
function GridInput({
  value,
  label,
  error,
  isBusy,
  onChange,
  onEnter,
  onEscape,
}: {
  value: string;
  label: string;
  error: string | null;
  isBusy: boolean;
  onChange: (next: string) => void;
  onEnter: () => void;
  onEscape: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const keys = useRef({ onEnter, onEscape });
  keys.current = { onEnter, onEscape };
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    input.select();
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        keys.current.onEnter();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        keys.current.onEscape();
      }
    };
    input.addEventListener('keydown', onKey);
    return () => input.removeEventListener('keydown', onKey);
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      inputMode="decimal"
      aria-label={label}
      aria-invalid={error ? true : undefined}
      aria-busy={isBusy || undefined}
      readOnly={isBusy}
      onChange={(e) => onChange(e.target.value)}
      className={`-my-1 h-full min-h-7 w-full rounded border bg-white px-1 text-right text-sm tabular-nums outline-none ${error ? 'border-red-500 ring-2 ring-red-200' : 'border-blue-500 ring-2 ring-blue-200'}`}
    />
  );
}

const SMALL_BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-medium whitespace-nowrap hover:bg-slate-50 disabled:opacity-50';

/** Under the inline input: the error or how to save, "Về số tính" and "Lưu" for touch. A press outside cancels. */
function EditHelp({
  anchor,
  title,
  error,
  isKpi,
  isBusy,
  onReset,
  onSave,
  onClose,
}: {
  anchor: RefObject<HTMLSpanElement | null>;
  title: string;
  error: string | null;
  isKpi: boolean;
  isBusy: boolean;
  onReset: (() => void) | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const onOpenChange = (open: boolean, details: PopoverPrimitive.Root.ChangeEventDetails) => {
    const target = details.event?.target;
    if (open || (target instanceof Node && anchor.current?.contains(target))) return;
    onClose();
  };
  return (
    <PopoverPrimitive.Root open onOpenChange={onOpenChange}>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner anchor={anchor} side="bottom" align="end" sideOffset={4} className="isolate z-50">
          <PopoverPrimitive.Popup
            initialFocus={false}
            finalFocus={false}
            aria-label={title}
            className="flex w-64 max-w-[calc(100vw-32px)] flex-col gap-2 rounded-md border bg-white p-2.5 text-xs text-slate-700 shadow-lg"
          >
            {error ? (
              <p role="alert" className="m-0 font-medium text-red-700">
                {error}
              </p>
            ) : (
              <p className="m-0 text-slate-500">
                {isKpi ? 'Gõ số %, ví dụ 80. ' : ''}Enter để lưu, Esc để huỷ. Để trống: về số tính.
              </p>
            )}
            <span className="flex flex-wrap justify-end gap-2">
              {onReset && (
                <button type="button" disabled={isBusy} onClick={onReset} className={SMALL_BUTTON}>
                  <RotateCcw className="size-3.5 text-blue-600" />
                  Về số tính
                </button>
              )}
              <button type="button" disabled={isBusy} onClick={onSave} className={SMALL_BUTTON}>
                <Save className="size-3.5 text-green-600" />
                Lưu
              </button>
            </span>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function NumberCell({ line, column, month, field }: CellProps & { field: PayrollNumberField }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const save = useSaveMonthInputs(month.monthKey);
  const close = () => {
    setDraft(null);
    setError(null);
  };
  const send = (input: PayrollMonthInputsInput) => {
    setError(null);
    save.mutate(
      { employeeId: line.employeeId, input },
      { onSuccess: close, onError: (e) => setError(saveError(e, field)) },
    );
  };
  const submit = () => {
    if (draft === null || save.isPending) return;
    const parsed = parseNumberInput(field, draft);
    if (parsed.ok) send(parsed.patch);
    else setError(parsed.error);
  };
  if (draft === null) {
    return <NumberDisplay line={line} column={column} month={month} onEdit={() => setDraft(editText(field, line))} />;
  }
  const label = `${cellLabel(column)} của ${line.fullName}${field === 'kpiPercent' ? ', tính bằng %' : ''}`;
  return (
    <span ref={anchor} className="block h-full w-full py-0.5">
      <GridInput
        value={draft}
        label={label}
        error={error}
        isBusy={save.isPending}
        onChange={setDraft}
        onEnter={submit}
        onEscape={close}
      />
      <EditHelp
        anchor={anchor}
        title={`Sửa ${cellLabel(column)}`}
        error={error}
        isKpi={field === 'kpiPercent'}
        isBusy={save.isPending}
        onReset={isTyped(field, line.inputs) ? () => send(resetPatch(field)) : null}
        onSave={submit}
        onClose={close}
      />
    </span>
  );
}
