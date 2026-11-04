import { REJECT_NOTE_MAX, REJECT_REASONS, type RejectReason } from '@careers/shared';
import { useState } from 'react';
import { Button } from '../../../ui/Button';

const GROUPS = [
  { key: 'company', title: 'Công ty đánh giá' },
  { key: 'terms', title: 'Điều kiện đôi bên' },
  { key: 'candidate', title: 'Phía ứng viên' },
  { key: 'other', title: null },
] as const;

/** Why this application is closed: one main reason, one press. For HR only: the candidate never sees it. */
export function RejectForm({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: (reason: RejectReason, note: string | null) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState('');
  const isReady = reason !== null && (reason !== 'other' || note.trim().length > 0);
  return (
    <form
      aria-label="Lý do chưa phù hợp"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason && isReady) onConfirm(reason, note.trim() || null);
      }}
      className="flex flex-col gap-3 rounded-control border border-line bg-white p-3.5 text-sm"
    >
      <strong className="font-semibold text-navy">Lý do chưa phù hợp</strong>
      {GROUPS.map((group) => (
        <fieldset key={group.key} className="m-0 flex flex-col gap-1.5 border-0 p-0">
          {group.title && <legend className="mb-1 p-0 text-sm font-medium text-navy">{group.title}</legend>}
          <span className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.filter((r) => r.group === group.key).map((r) => (
              <label
                key={r.key}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-control border px-3 text-sm has-[:focus-visible]:outline-2 lg:min-h-9 ${reason === r.key ? 'border-status-rejected bg-status-rejected-soft font-semibold text-status-rejected-text' : 'border-silver bg-white text-navy hover:bg-hover'}`}
              >
                <input
                  type="radio"
                  name="reject-reason"
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className="sr-only"
                />
                {r.label}
              </label>
            ))}
          </span>
        </fieldset>
      ))}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={REJECT_NOTE_MAX}
        placeholder={reason === 'other' ? 'Ghi rõ lý do' : 'Ghi thêm (không bắt buộc)'}
        aria-label="Ghi thêm về lý do"
        className="field-focus min-h-10 rounded-control border border-field bg-white px-3 text-sm text-navy"
      />
      <span className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="danger" icon="xCircle" disabled={busy || !isReady}>
          Xác nhận chưa phù hợp
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Huỷ
        </Button>
      </span>
    </form>
  );
}
