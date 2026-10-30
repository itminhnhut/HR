import {
  REVIEW_NAME_MAX,
  REVIEW_TEXT_MAX,
  REVIEW_TITLE_MAX,
  type ApplicationRowDto,
  type ReviewPick,
} from '@careers/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../api';
import { useCreateReview, useHrMe } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { TextArea, TextField } from '../../../ui/Field';
import { Notice } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { defaultRespondBy, defaultTitle, fromLocalInput } from './reviewModel';

/** The reviewer's name HR typed last time, a per-browser convenience. */
const LAST_REVIEWER = 'hr-review-last-reviewer';
const lastReviewer = () => {
  try {
    return localStorage.getItem(LAST_REVIEWER) ?? '';
  } catch {
    return '';
  }
};
const rememberReviewer = (name: string) => {
  try {
    localStorage.setItem(LAST_REVIEWER, name);
  } catch {
    // Private mode: only the convenience is lost.
  }
};

interface ItemDraft {
  hrPick: ReviewPick;
  hrComment: string;
}

function PickSwitch({ value, onChange }: { value: ReviewPick; onChange: (v: ReviewPick) => void }) {
  const options: [ReviewPick, string, string][] = [
    ['yes', '★ Nên PV', 'border-ok bg-ok text-white'],
    ['maybe', 'Cân nhắc', 'border-cat-amber bg-cat-amber text-white'],
  ];
  return (
    <div role="group" aria-label="HR đề xuất" className="flex gap-1.5">
      {options.map(([key, label, on]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold ${value === key ? on : 'border-field bg-white text-slate hover:bg-mist'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ItemsEditor({
  rows,
  drafts,
  onChange,
}: {
  rows: ApplicationRowDto[];
  drafts: Record<string, ItemDraft>;
  onChange: (id: string, patch: Partial<ItemDraft>) => void;
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((row, i) => {
        const draft = drafts[row.id] ?? { hrPick: 'maybe', hrComment: '' };
        return (
          <li key={row.id} className="flex flex-col gap-2.5 rounded-card border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-navy">
                  {i + 1}. {row.fullName}
                </span>
                <span className="text-xs text-slate">
                  {row.jobTitle}
                  {row.matchPercent != null && ` · khớp CV ${row.matchPercent}%`}
                </span>
              </span>
              <PickSwitch value={draft.hrPick} onChange={(hrPick) => onChange(row.id, { hrPick })} />
            </div>
            <TextArea
              label="Nhận xét của HR cho sếp"
              optional
              rows={2}
              maxLength={REVIEW_TEXT_MAX}
              value={draft.hrComment}
              onChange={(e) => onChange(row.id, { hrComment: e.target.value })}
              placeholder="Ví dụ: phỏng vấn sơ bộ qua điện thoại tốt, mong muốn 15–18 triệu."
            />
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "Gửi sếp duyệt": HR names the batch, who sends it, who reviews it and by when, and adds a view per
 * application. Sending creates the private link; the batch page opens next to copy it.
 */
export function SendReviewDialog({
  rows,
  open,
  onClose,
  onSent,
}: {
  rows: ApplicationRowDto[];
  open: boolean;
  onClose: () => void;
  onSent: (batchId: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} label="Gửi sếp duyệt" variant="panel">
      {open && <SendReviewForm rows={rows} onClose={onClose} onSent={onSent} />}
    </Dialog>
  );
}

function SendReviewForm({
  rows,
  onClose,
  onSent,
}: {
  rows: ApplicationRowDto[];
  onClose: () => void;
  onSent: (id: string) => void;
}) {
  const me = useHrMe().data;
  const create = useCreateReview();
  const [title, setTitle] = useState(() => defaultTitle(rows));
  const [senderName, setSenderName] = useState(() => (me?.name ? `${me.name} (Phòng Nhân sự)` : ''));
  const [reviewerName, setReviewerName] = useState(lastReviewer);
  const [respondBy, setRespondBy] = useState(() => defaultRespondBy(new Date()));
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { hrPick: 'maybe', hrComment: r.noteLine ?? '' }])),
  );
  const fieldErrors = create.error instanceof ApiError ? create.error.fieldErrors : {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    rememberReviewer(reviewerName.trim());
    create.mutate(
      {
        title,
        senderName,
        reviewerName,
        message,
        respondBy: fromLocalInput(respondBy),
        items: rows.map((r) => ({ applicationId: r.id, ...drafts[r.id] })),
      },
      { onSuccess: (batch) => onSent(batch.id) },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-h-dvh flex-col sm:max-h-[calc(100dvh-48px)]">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-7">
        <h2 className="m-0 flex-1 font-serif text-[24px] font-medium">Gửi sếp duyệt · {rows.length} ứng viên</h2>
        <CloseButton onClick={onClose} />
      </header>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto bg-mist px-5 py-5 sm:px-7">
        <div className="grid gap-4 rounded-card border border-line bg-white p-4 sm:grid-cols-2 sm:p-5">
          <TextField
            label="Tiêu đề (sếp thấy đầu trang)"
            value={title}
            maxLength={REVIEW_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            error={fieldErrors.title}
            className="sm:col-span-2"
          />
          <TextField
            label="Người gửi"
            value={senderName}
            maxLength={REVIEW_NAME_MAX}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Ngọc Anh (Phòng Nhân sự)"
            error={fieldErrors.senderName}
          />
          <TextField
            label="Gửi cho"
            value={reviewerName}
            maxLength={REVIEW_NAME_MAX}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="anh Minh"
            hint="Hiện trên trang của sếp và trong chữ chìm của CV."
            error={fieldErrors.reviewerName}
          />
          <TextField
            label="Mong sếp phản hồi trước"
            type="datetime-local"
            value={respondBy}
            onChange={(e) => setRespondBy(e.target.value)}
            hint="Link dùng được thêm 5 ngày sau hạn này."
            error={fieldErrors.respondBy}
          />
          <TextArea
            label="Lời nhắn cho sếp"
            optional
            rows={3}
            maxLength={REVIEW_TEXT_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Đợt này em lọc 5 bạn từ 23 hồ sơ, 2 bạn em đề xuất phỏng vấn trước…"
            className="sm:col-span-2"
          />
        </div>
        <ItemsEditor
          rows={rows}
          drafts={drafts}
          onChange={(id, patch) =>
            setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? { hrPick: 'maybe', hrComment: '' }), ...patch } }))
          }
        />
        <p className="m-0 text-[13px] leading-relaxed text-slate">
          Sếp mở link là xem được, không cần đăng nhập. Trang của sếp không hiện số điện thoại và email ứng viên.
        </p>
      </div>
      <footer className="flex flex-col gap-3 border-t border-line bg-white px-5 py-4 sm:px-7">
        {create.error && Object.keys(fieldErrors).length === 0 && (
          <Notice tone="error" icon="alert">
            <span role="alert">{errorMessage(create.error)}</span>
          </Notice>
        )}
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="brand" icon="send" disabled={create.isPending}>
            {create.isPending ? 'Đang tạo link…' : 'Tạo link gửi sếp'}
          </Button>
        </div>
      </footer>
    </form>
  );
}
