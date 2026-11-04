import { NOTE_MAX, type ApplicationDetailDto } from '@careers/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUpdateApplication } from '../../../api/queries';
import { errorMessage } from '../parts';

const savedTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));

function saveLabel(app: ApplicationDetailDto, isSaving: boolean): string {
  if (isSaving) return 'Đang lưu…';
  if (!app.noteUpdatedAt) return 'Tự lưu. Ứng viên không thấy ghi chú này.';
  return `Đã lưu lúc ${savedTime(app.noteUpdatedAt)}${app.noteUpdatedBy ? ` · ${app.noteUpdatedBy}` : ''}`;
}

export function NoteField({ app, onError }: { app: ApplicationDetailDto; onError: (msg: string) => void }) {
  const update = useUpdateApplication();
  const [note, setNote] = useState(app.note ?? '');
  const saved = useRef(app.note ?? null);
  const latest = useRef(note);
  latest.current = note;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const { mutate } = update;
  const saveNote = useCallback(() => {
    const next = latest.current.trim() || null;
    if (next === saved.current) return;
    saved.current = next;
    mutate(
      { id: app.id, patch: { note: next } },
      { onError: (e) => onErrorRef.current(errorMessage(e, 'Chưa lưu được ghi chú, thử lại.')) },
    );
  }, [app.id, mutate]);
  // Save a moment after typing stops, and when the panel closes or HR moves to another profile.
  useEffect(() => {
    const t = setTimeout(saveNote, 1000);
    return () => clearTimeout(t);
  }, [note, saveNote]);
  const saveRef = useRef(saveNote);
  saveRef.current = saveNote;
  useEffect(() => () => saveRef.current(), []);
  const left = NOTE_MAX - note.length;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-navy">Ghi chú nội bộ</span>
      <textarea
        rows={3}
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        placeholder="Chỉ HR thấy, vd: đã gọi, hẹn gọi lại chiều thứ 6"
        className="field-focus resize-y rounded-control border border-field bg-white px-3.5 py-3 text-sm text-navy outline-none placeholder:text-placeholder"
      />
      <span className="flex justify-between gap-3 text-xs text-muted">
        <span>{saveLabel(app, update.isPending)}</span>
        {left < 200 && <span className={left < 50 ? 'text-error' : ''}>Còn {left} ký tự</span>}
      </span>
    </label>
  );
}
