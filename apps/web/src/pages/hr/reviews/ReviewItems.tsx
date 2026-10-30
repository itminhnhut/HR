import {
  REVIEW_DECISION_LABEL,
  REVIEW_PICK_LABEL,
  REVIEW_TEXT_MAX,
  type ReviewBatchDto,
  type ReviewItemHrDto,
} from '@careers/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { useReviewAction } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { shortTime } from './reviewModel';

const DECISION_TONE = {
  approve: 'border-ok-line bg-ok-soft text-ok',
  reject: 'border-error/30 bg-error-soft text-error',
  ask: 'border-cat-amber-line bg-cat-amber-soft text-cat-amber',
} as const;

function Decision({ item }: { item: ReviewItemHrDto }) {
  if (!item.decision) {
    return (
      <span className="w-fit rounded-full border border-line bg-mist px-2.5 py-0.5 text-xs text-slate">Chờ sếp</span>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      <span className={`w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DECISION_TONE[item.decision]}`}>
        {REVIEW_DECISION_LABEL[item.decision]}
      </span>
      {item.reviewerComment && <span className="text-[13px] italic text-ink">“{item.reviewerComment}”</span>}
      {item.decidedAt && <span className="text-xs text-muted">{shortTime(item.decidedAt)}</span>}
    </span>
  );
}

function ReplyForm({ batchId, item }: { batchId: string; item: ReviewItemHrDto }) {
  const action = useReviewAction(batchId);
  const [open, setOpen] = useState(!item.hrReply);
  const [reply, setReply] = useState(item.hrReply ?? '');
  if (!open) {
    return (
      <span className="flex flex-col gap-1 text-[13px]">
        <span className="text-ink">
          <b className="font-semibold">HR trả lời:</b> {item.hrReply}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-fit border-0 bg-transparent p-0 text-xs text-link underline"
        >
          Sửa câu trả lời
        </button>
      </span>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        action.mutate({ type: 'reply', itemId: item.id, reply }, { onSuccess: () => setOpen(false) });
      }}
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-1 text-xs text-slate">
        Trả lời sếp (hiện ngay dưới câu hỏi trên link)
        <textarea
          value={reply}
          maxLength={REVIEW_TEXT_MAX}
          rows={2}
          onChange={(e) => setReply(e.target.value)}
          className="field-focus rounded-control border border-field px-3 py-2 text-sm text-navy"
        />
      </label>
      {action.error && (
        <span role="alert" className="text-xs text-error">
          {errorMessage(action.error)}
        </span>
      )}
      <Button type="submit" size="sm" disabled={action.isPending || !reply.trim()} className="w-fit">
        Gửi trả lời
      </Button>
    </form>
  );
}

/** What HR does next with this application, from the reviewer's choice. */
function NextStep({ batch, item }: { batch: ReviewBatchDto; item: ReviewItemHrDto }) {
  const action = useReviewAction(batch.id);
  const open = `/hr/ho-so?id=${item.applicationId}`;
  if (item.decision === 'approve') {
    return item.status === 'interview' ? (
      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ok">
        <Icon name="calendar" size={14} /> Đã hẹn
      </span>
    ) : (
      <Link
        to={open}
        className="inline-flex min-h-9 items-center rounded-control bg-navy px-3 text-[13px] font-semibold text-white no-underline"
      >
        Hẹn phỏng vấn
      </Link>
    );
  }
  if (item.decision === 'reject') {
    return (
      <Link
        to={open}
        className="inline-flex min-h-9 items-center rounded-control border border-field px-3 text-[13px] font-semibold text-navy no-underline"
      >
        Gửi tin cảm ơn
      </Link>
    );
  }
  if (item.decision === 'ask') return batch.state === 'revoked' ? null : <ReplyForm batchId={batch.id} item={item} />;
  return batch.state === 'revoked' ? null : (
    <button
      type="button"
      disabled={action.isPending}
      onClick={() => action.mutate({ type: 'remove', itemId: item.id })}
      className="min-h-9 rounded-control border border-field bg-white px-3 text-[13px] text-slate hover:bg-mist"
    >
      Bỏ khỏi đợt
    </button>
  );
}

/** The applications of a batch with the reviewer's choices, what HR suggested, and the next step. */
export function ReviewItems({ batch }: { batch: ReviewBatchDto }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {batch.items.map((item) => (
        <li
          key={item.id}
          className="grid gap-3 border-b border-line-soft px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_240px] md:items-start"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <Link to={`/hr/ho-so?id=${item.applicationId}`} className="font-semibold text-navy">
              {item.fullName}
            </Link>
            <span className="text-xs text-slate">
              {item.jobTitle}
              {item.matchPercent != null && ` · khớp ${item.matchPercent}%`}
            </span>
            <span className="text-xs text-muted">{REVIEW_PICK_LABEL[item.hrPick]}</span>
          </span>
          <Decision item={item} />
          <span className="md:justify-self-end">
            <NextStep batch={batch} item={item} />
          </span>
        </li>
      ))}
      {batch.items.length === 0 && (
        <li className="px-5 py-8 text-center text-sm text-slate">Đợt này không còn ứng viên nào.</li>
      )}
    </ul>
  );
}
