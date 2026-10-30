import type { ReviewBatchDto } from '@careers/shared';
import { useState } from 'react';
import { useApplications, useReviewAction } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { Notice } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { canSendForReview } from './PickForReview';

/** "Thêm ứng viên" to a batch: applications not in it and not waiting for a reviewer elsewhere. */
export function AddToReviewDialog({
  batch,
  open,
  onClose,
}: {
  batch: ReviewBatchDto;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} label="Thêm ứng viên vào đợt">
      {open && <AddForm batch={batch} onClose={onClose} />}
    </Dialog>
  );
}

function AddForm({ batch, onClose }: { batch: ReviewBatchDto; onClose: () => void }) {
  const apps = useApplications();
  const action = useReviewAction(batch.id);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inBatch = new Set(batch.items.map((i) => i.applicationId));
  const candidates = (apps.data?.applications ?? []).filter((a) => !inBatch.has(a.id) && canSendForReview(a));
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const add = () =>
    action.mutate(
      {
        type: 'add',
        items: candidates
          .filter((a) => picked.has(a.id))
          .map((a) => ({ applicationId: a.id, hrPick: 'maybe', hrComment: a.noteLine ?? '' })),
      },
      { onSuccess: onClose },
    );
  return (
    <div className="flex max-h-[92dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <h2 className="m-0 flex-1 text-lg font-semibold">Thêm ứng viên vào "{batch.title}"</h2>
        <CloseButton onClick={onClose} />
      </header>
      <ul className="m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-0">
        {candidates.map((a) => (
          <li key={a.id} className="border-b border-line-soft last:border-b-0">
            <label className="flex min-h-14 cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-hover">
              <input
                type="checkbox"
                checked={picked.has(a.id)}
                onChange={() => toggle(a.id)}
                className="size-[18px] accent-accent"
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-navy">{a.fullName}</span>
                <span className="truncate text-xs text-slate">
                  {a.jobTitle}
                  {a.matchPercent != null && ` · khớp ${a.matchPercent}%`}
                </span>
              </span>
            </label>
          </li>
        ))}
        {apps.data && candidates.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-slate">Không còn ứng viên nào để thêm.</li>
        )}
      </ul>
      <footer className="flex flex-col gap-3 border-t border-line px-5 py-4">
        {action.error && (
          <Notice tone="error" icon="alert">
            <span role="alert">{errorMessage(action.error)}</span>
          </Notice>
        )}
        <span className="flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={picked.size === 0 || action.isPending} onClick={add}>
            Thêm {picked.size > 0 ? picked.size : ''} ứng viên
          </Button>
        </span>
      </footer>
    </div>
  );
}
