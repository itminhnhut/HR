import { REVIEW_MAX_ITEMS, type ApplicationRowDto } from '@careers/shared';
import { useMemo, useState } from 'react';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';

const MARK: Record<NonNullable<ApplicationRowDto['review']>, { label: string; tone: string }> = {
  waiting: { label: 'Chờ sếp duyệt', tone: 'border-line bg-mist text-slate' },
  approve: { label: 'Sếp duyệt PV', tone: 'border-ok-line bg-ok-soft text-ok' },
  reject: { label: 'Sếp không duyệt', tone: 'border-error/30 bg-error-soft text-error' },
  ask: { label: 'Sếp hỏi thêm', tone: 'border-cat-amber-line bg-cat-amber-soft text-cat-amber' },
};

/** Where the application stands with the reviewer, in the list and the detail. */
export function ReviewMark({ review }: { review: NonNullable<ApplicationRowDto['review']> }) {
  const { label, tone } = MARK[review];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <Icon name="checkSquare" size={11} />
      {label}
    </span>
  );
}

/**
 * Who can go to a reviewer: not already waiting for one, not already invited, not already told "chưa phù hợp"
 * (the API refuses those too).
 */
export const canSendForReview = (row: Pick<ApplicationRowDto, 'review' | 'status'>) =>
  row.review !== 'waiting' && row.review !== 'ask' && row.status !== 'interview' && row.status !== 'rejected';

/** "Gửi sếp duyệt" picking: on/off, the picked applications (in list order), and the send dialog. */
export function usePicking(all: ApplicationRowDto[]) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const rows = useMemo(() => all.filter((a) => ids.has(a.id)), [all, ids]);
  return {
    active,
    ids,
    rows,
    sending,
    setSending,
    start: () => setActive(true),
    stop: () => {
      setActive(false);
      setIds(new Set());
      setSending(false);
    },
    toggle: (id: string) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else if (next.size < REVIEW_MAX_ITEMS) next.add(id);
        return next;
      }),
  };
}

/** Pinned to the bottom while picking: how many, cancel, next. */
export function PickBar({ count, onCancel, onNext }: { count: number; onCancel: () => void; onNext: () => void }) {
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-card border border-navy bg-navy px-4 py-3 text-white shadow-[0_10px_30px_rgba(11,31,58,0.25)]">
      <span className="flex-1 text-sm">
        {count === 0 ? 'Bấm vào ứng viên để chọn gửi sếp duyệt.' : `Đã chọn ${count} ứng viên`}
        <span className="block text-xs text-silver">
          Tối đa {REVIEW_MAX_ITEMS} người một đợt. Người đang chờ sếp, đã hẹn PV hoặc đã báo chưa phù hợp không chọn
          được.
        </span>
      </span>
      <Button variant="outlineLight" size="sm" onClick={onCancel}>
        Huỷ
      </Button>
      <Button variant="light" size="sm" iconRight="arrowRight" disabled={count === 0} onClick={onNext}>
        Tiếp tục
      </Button>
    </div>
  );
}
