import { Pencil, Save } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { PayrollLineDto } from '../../../api';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { CopyValue } from '../timesheet/CopyValue';
import { INPUT_LOOK, saveError } from './inputParts';
import type { PayrollMonthContext } from './PayrollCell';
import { AUTO_NOTE_TITLE, fullNoteOf, hrNoteOf, NOTE_MAX, printedNote } from './payrollModel';
import { useSaveMonthInputs } from './queries';

/**
 * "Ghi chú" of a row: HR's own note of the person this month (a month input, typed here), then the notes the web
 * writes by itself, in muted italic and read only. An approved or paid month shows both read only, with the reason.
 */

interface NoteProps {
  line: PayrollLineDto;
  month: PayrollMonthContext;
}

/** HR's note, then the automatic ones: each cut with an ellipsis in the cell, whole on hover. */
function NoteParts({ line, ownTitle }: { line: PayrollLineDto; ownTitle?: string }) {
  const own = hrNoteOf(line);
  const auto = printedNote(line.note);
  return (
    <>
      {own && (
        <span data-note="hr" title={ownTitle ?? own} className="min-w-0 truncate text-slate-800">
          {own}
        </span>
      )}
      {auto && (
        <span data-note="auto" title={`${AUTO_NOTE_TITLE}: ${auto}`} className="min-w-0 truncate text-slate-500 italic">
          {auto}
        </span>
      )}
    </>
  );
}

const SMALL_BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-medium whitespace-nowrap hover:bg-slate-50 disabled:opacity-50 max-sm:h-11';

function NoteForm({ line, monthKey, onDone }: { line: PayrollLineDto; monthKey: string; onDone: () => void }) {
  const [text, setText] = useState(line.inputs.note);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveMonthInputs(monthKey);
  const auto = printedNote(line.note);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (save.isPending) return;
    const note = text.trim();
    if (note.length > NOTE_MAX) return setError(`Ghi chú tối đa ${NOTE_MAX} ký tự.`);
    if (note === hrNoteOf(line)) return onDone();
    setError(null);
    save.mutate(
      { employeeId: line.employeeId, input: { note } },
      { onSuccess: onDone, onError: (e) => setError(saveError(e, 'note')) },
    );
  };
  // Enter saves, Shift+Enter breaks the line; Esc is the popover's. The keys stay out of the grid under it.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Escape') event.stopPropagation();
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };
  return (
    <form onSubmit={submit} aria-label={`Ghi chú · ${line.fullName}`} className="flex flex-col gap-2 text-xs">
      <p className="m-0 font-semibold text-slate-700">{`Ghi chú · ${line.fullName}`}</p>
      <textarea
        autoFocus
        rows={3}
        maxLength={NOTE_MAX}
        aria-label={`Ghi chú của ${line.fullName}`}
        aria-invalid={error ? true : undefined}
        value={text}
        readOnly={save.isPending}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        className="max-h-48 min-h-16 w-full resize-y rounded-md border bg-white px-2 py-1.5 text-sm break-words whitespace-pre-wrap text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
      {error ? (
        <p role="alert" className="m-0 font-medium text-red-700">
          {error}
        </p>
      ) : (
        <p className="m-0 flex justify-between gap-2 text-slate-500">
          <span>Enter để lưu, Esc để huỷ. Để trống: xoá ghi chú.</span>
          <span className="shrink-0 tabular-nums">{`${text.length}/${NOTE_MAX}`}</span>
        </p>
      )}
      {auto && (
        <p className="m-0 break-words text-slate-500 italic" title={AUTO_NOTE_TITLE}>
          {`Tự động: ${auto}`}
        </p>
      )}
      <span className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={save.isPending} onClick={onDone} className={SMALL_BUTTON}>
          Huỷ
        </button>
        <button type="submit" disabled={save.isPending} className={SMALL_BUTTON}>
          <Save className="size-3.5 text-green-600" />
          {save.isPending ? 'Đang lưu…' : 'Lưu'}
        </button>
      </span>
    </form>
  );
}

function LockedNote({ line, reason }: { line: PayrollLineDto; reason: string }) {
  const own = hrNoteOf(line);
  return (
    <CopyValue inGrid text={fullNoteOf(line)} label="ghi chú">
      <span data-note-locked title={reason} className="flex min-w-0 items-center gap-1.5 text-xs">
        <NoteParts line={line} ownTitle={`${own}\n${reason}`} />
      </span>
    </CopyValue>
  );
}

export function PayrollNoteCell({ line, month }: NoteProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (month.lockReason) return <LockedNote line={line} reason={month.lockReason} />;
  const hasNote = hrNoteOf(line) !== '';
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        aria-label={`${hasNote ? 'Sửa' : 'Thêm'} ghi chú của ${line.fullName}`}
        className={`-my-1 flex h-full min-h-7 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded px-1 text-left text-xs ${INPUT_LOOK}`}
        render={<button type="button" />}
      >
        <Pencil
          aria-hidden="true"
          className="size-3 shrink-0 text-slate-300 group-hover:text-blue-600 group-focus-visible:text-blue-600"
        />
        <NoteParts line={line} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 max-w-[calc(100vw-32px)] bg-white p-3">
        {isOpen && <NoteForm line={line} monthKey={month.monthKey} onDone={() => setIsOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}
