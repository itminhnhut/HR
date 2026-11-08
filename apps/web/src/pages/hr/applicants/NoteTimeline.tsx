import { NOTE_MAX, type ApplicationDetailDto, type ApplicationNoteDto } from '@careers/shared';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNoteChange, useUpdateApplication } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { useConfirm } from '../shadcn/Confirm';

const TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  hour12: false,
});
/** "10:00 20/10", Vietnam time. */
function timeOf(iso: string) {
  const part = (type: string) => TIME.formatToParts(new Date(iso)).find((p) => p.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')} ${part('day')}/${part('month')}`;
}

const FIELD =
  'field-focus w-full resize-y rounded-control border border-field bg-white px-3.5 py-2.5 text-sm text-navy outline-none placeholder:text-placeholder';
const SMALL_BUTTON =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border-0 bg-transparent text-slate hover:bg-tint hover:text-navy lg:min-h-8 lg:min-w-8';

/** Enter saves, Shift+Enter is a new line; a Vietnamese keyboard still composing a letter is left alone. */
const onEnter = (save: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
  e.preventDefault();
  save();
};

type Notes = ReturnType<typeof useNoteChange>;
type Report = (msg: string) => void;

/** "Thêm ghi chú": a note still in the box when the application closes is saved, so no typed word is lost. */
function AddNote({ app, notes, onError }: { app: ApplicationDetailDto; notes: Notes; onError: Report }) {
  const [draft, setDraft] = useState('');
  const keep = useUpdateApplication();
  const latest = useRef({ draft, id: app.id, mutate: keep.mutate });
  latest.current = { draft, id: app.id, mutate: keep.mutate };
  useEffect(
    () => () => {
      const { draft: left, id, mutate } = latest.current;
      // An older screen's way of adding a note: the server adds an entry for it.
      if (left.trim()) mutate({ id, patch: { note: left.trim() } });
    },
    [],
  );
  const save = () => {
    const body = draft.trim();
    if (!body || notes.add.isPending) return;
    notes.add.mutate(
      { id: app.id, body },
      { onSuccess: () => setDraft(''), onError: (e) => onError(errorMessage(e, 'Chưa lưu được ghi chú, thử lại.')) },
    );
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-navy">Ghi chú nội bộ</span>
        <textarea
          rows={2}
          value={draft}
          maxLength={NOTE_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onEnter(save)}
          placeholder="Thêm ghi chú, vd: T7 gọi chưa được"
          className={FIELD}
        />
      </label>
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">Enter để ghi, Shift+Enter xuống dòng. Ứng viên không thấy.</span>
        <Button size="compact" disabled={!draft.trim() || notes.add.isPending} onClick={save}>
          {notes.add.isPending ? 'Đang ghi…' : 'Ghi'}
        </Button>
      </span>
    </div>
  );
}

function EditNote({
  note,
  onSave,
  onCancel,
  isSaving,
}: {
  note: ApplicationNoteDto;
  onSave: (body: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [body, setBody] = useState(note.body);
  const save = () => (body.trim() ? onSave(body.trim()) : undefined);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Sửa ghi chú"
        rows={2}
        value={body}
        maxLength={NOTE_MAX}
        autoFocus
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.key === 'Escape' ? onCancel() : onEnter(save)(e))}
        className={FIELD}
      />
      <span className="flex gap-2">
        <Button size="compact" disabled={!body.trim() || isSaving} onClick={save}>
          Lưu
        </Button>
        <Button size="compact" variant="outline" onClick={onCancel}>
          Huỷ
        </Button>
      </span>
    </div>
  );
}

function NoteMeta({ note }: { note: ApplicationNoteDto }) {
  const isEdited = note.updatedAt !== note.createdAt;
  return (
    <span className="text-xs text-muted">
      {[note.createdBy, timeOf(note.createdAt)].filter(Boolean).join(' · ')}
      {isEdited && ` (đã sửa ${timeOf(note.updatedAt)})`}
    </span>
  );
}

interface EntryProps {
  app: ApplicationDetailDto;
  note: ApplicationNoteDto;
  notes: Notes;
  onError: Report;
}

function NoteEntry({ app, note, notes, onError }: EntryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirm, dialog] = useConfirm();
  const fail = (e: unknown) => onError(errorMessage(e, 'Chưa lưu được ghi chú, thử lại.'));
  const save = (body: string) =>
    notes.edit.mutate({ id: app.id, noteId: note.id, body }, { onSuccess: () => setIsEditing(false), onError: fail });
  const remove = async () => {
    const agreed = await confirm({
      title: 'Xoá ghi chú này?',
      description: 'Nhật ký vẫn giữ nội dung cũ.',
      action: 'Xoá',
      isDanger: true,
    });
    if (agreed) notes.remove.mutate({ id: app.id, noteId: note.id }, { onError: fail });
  };
  return (
    <li className="flex flex-col gap-1 border-l-2 border-silver py-1 pl-3">
      {dialog}
      {isEditing ? (
        <EditNote note={note} onSave={save} onCancel={() => setIsEditing(false)} isSaving={notes.edit.isPending} />
      ) : (
        <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{note.body}</p>
      )}
      <span className="flex items-center gap-1">
        <NoteMeta note={note} />
        {!isEditing && (
          <span className="ml-auto flex">
            <button type="button" aria-label="Sửa ghi chú" className={SMALL_BUTTON} onClick={() => setIsEditing(true)}>
              <Icon name="pencil" size={14} />
            </button>
            <button type="button" aria-label="Xoá ghi chú" className={SMALL_BUTTON} onClick={() => void remove()}>
              <Icon name="trash" size={14} />
            </button>
          </span>
        )}
      </span>
    </li>
  );
}

/** "Ghi chú nội bộ" (spec-nhat-ky-ho-so.md): a box to add one, then every note, newest first. */
export function NoteTimeline({ app, onError }: { app: ApplicationDetailDto; onError: Report }) {
  const notes = useNoteChange();
  return (
    <div className="flex flex-col gap-3">
      <AddNote app={app} notes={notes} onError={onError} />
      <ol aria-label="Các ghi chú" className="m-0 flex list-none flex-col gap-2 p-0">
        {app.notes.map((note) => (
          <NoteEntry key={note.id} app={app} note={note} notes={notes} onError={onError} />
        ))}
      </ol>
    </div>
  );
}
