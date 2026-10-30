import { REVIEW_BYPASS_MIN, type ApplicationDetailDto } from '@careers/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';
import { ReviewMark } from '../reviews/PickForReview';

/** Sent to a reviewer who has not approved yet: "Hẹn phỏng vấn" first asks why (spec-boss-review.md). */
export const needsBypass = (app: ApplicationDetailDto) =>
  !!app.reviewInfo && app.reviewInfo.decision !== 'approve' && app.status !== 'interview';

/** Where this application stands with the reviewer, with a link to its batch. */
export function ReviewStatus({ app }: { app: ApplicationDetailDto }) {
  const review = app.reviewInfo;
  if (!review || !app.review) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-line bg-mist px-3.5 py-3 text-[13px]">
      <span className="flex flex-wrap items-center gap-2">
        <ReviewMark review={app.review} />
        <Link to={`/hr/duyet/${review.batchId}`} className="text-link">
          {review.title}
        </Link>
      </span>
      {review.reviewerComment && (
        <span className="text-ink">
          {review.reviewerName}: <i>“{review.reviewerComment}”</i>
        </span>
      )}
    </div>
  );
}

/** "Vẫn hẹn": a reason is required and goes into the batch's log for the reviewer. */
export function BypassForm({
  app,
  busy,
  onConfirm,
  onCancel,
}: {
  app: ApplicationDetailDto;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const who = app.reviewInfo?.reviewerName ?? 'Sếp';
  const why =
    app.reviewInfo?.decision === 'reject' ? `${who} đã chọn không phỏng vấn` : `${who} chưa duyệt ứng viên này`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(reason.trim());
      }}
      className="flex flex-col gap-2.5 rounded-control border border-cat-amber-line bg-cat-amber-soft p-3.5 text-sm"
    >
      <span className="flex items-start gap-2 text-cat-amber">
        <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
        <span>
          <b>{why}.</b> Nên chờ sếp duyệt. Nếu vẫn cần hẹn ngay, ghi lý do: sếp sẽ thấy trong nhật ký của đợt.
        </span>
      </span>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="Ví dụ: ứng viên chỉ rảnh chiều nay"
        aria-label="Lý do vẫn hẹn phỏng vấn"
        className="field-focus rounded-control border border-field bg-white px-3 py-2 text-sm text-navy"
      />
      <span className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="dark" disabled={busy || reason.trim().length < REVIEW_BYPASS_MIN}>
          Vẫn hẹn phỏng vấn
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Chờ sếp duyệt
        </Button>
      </span>
    </form>
  );
}
