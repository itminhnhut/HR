import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useReview } from '../../../api/queries';
import { usePageMeta } from '../../../lib/hooks';
import { ErrorState, LoadingStatus } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { apiMessage } from '../parts';
import { AddToReviewDialog } from './AddToReviewDialog';
import { ReviewItems } from './ReviewItems';
import { LinkPanel, ReviewLog } from './ReviewSide';
import { STATE_LABEL } from './reviewModel';

/** One batch: the reviewer's choices as they come (refreshed every 15 s), the link and the log. */
export default function HrReviewPage() {
  const { id = '' } = useParams();
  const review = useReview(id);
  const [adding, setAdding] = useState(false);
  usePageMeta(review.data?.title ?? 'Đợt duyệt');
  if (review.isPending) return <LoadingStatus />;
  if (review.isError) return <ErrorState onRetry={() => review.refetch()} message={apiMessage(review.error)} />;
  const batch = review.data;
  const decided = batch.approved + batch.rejected + batch.asked;
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-sm text-slate">
        <Link to="/hr/duyet" className="text-slate">
          Sếp duyệt
        </Link>
        <Icon name="chevronRight" size={14} />
        <span className="truncate text-navy">{batch.title}</span>
      </nav>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-card border border-line bg-white">
          <header className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-4">
            <h1 className="m-0 min-w-[200px] flex-1 font-serif text-[24px] font-medium">{batch.title}</h1>
            <span className="inline-flex items-center gap-1.5 text-xs text-ok" title="Tự cập nhật mỗi 15 giây">
              <span aria-hidden="true" className="size-2 rounded-full bg-ok shadow-[0_0_0_3px_var(--color-ok-soft)]" />
              Cập nhật trực tiếp
            </span>
            <span className="rounded-full border border-line bg-mist px-2.5 py-0.5 text-xs font-semibold text-slate">
              {batch.state === 'open' ? `Sếp đã quyết ${decided}/${batch.total}` : STATE_LABEL[batch.state]}
            </span>
          </header>
          <ReviewItems batch={batch} />
        </section>
        <aside className="flex flex-col gap-4">
          <LinkPanel batch={batch} onAdd={() => setAdding(true)} />
          <ReviewLog events={batch.events} />
        </aside>
      </div>
      <AddToReviewDialog batch={batch} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
