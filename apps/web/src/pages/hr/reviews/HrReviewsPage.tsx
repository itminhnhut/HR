import type { ReviewBatchRowDto } from '@careers/shared';
import { Link } from 'react-router';
import { useReviews } from '../../../api/queries';
import { usePageMeta } from '../../../lib/hooks';
import { ButtonLink } from '../../../ui/Button';
import { EmptyState, ErrorState, LoadingStatus } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { apiMessage, PageHeading } from '../parts';
import { shortTime, STATE_LABEL } from './reviewModel';

/** Green when the reviewer finished, amber while waiting, grey when the link is closed. */
function BatchStatus({ batch }: { batch: ReviewBatchRowDto }) {
  const decided = batch.approved + batch.rejected + batch.asked;
  if (batch.state !== 'open') {
    return (
      <span className="rounded-full border border-line bg-mist px-2.5 py-0.5 text-xs text-slate">
        {STATE_LABEL[batch.state]}
      </span>
    );
  }
  if (batch.doneAt) {
    return (
      <span className="rounded-full border border-ok-line bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">
        Sếp đã xem xong
      </span>
    );
  }
  return (
    <span className="rounded-full border border-cat-amber-line bg-cat-amber-soft px-2.5 py-0.5 text-xs font-semibold text-cat-amber">
      {batch.openedAt ? `Sếp đang xem · ${decided}/${batch.total}` : 'Sếp chưa mở link'}
    </span>
  );
}

function Counts({ batch }: { batch: ReviewBatchRowDto }) {
  const parts: [number, string, string][] = [
    [batch.approved, 'duyệt', 'text-ok'],
    [batch.rejected, 'không', 'text-error'],
    [batch.asked, 'hỏi thêm', 'text-cat-amber'],
  ];
  return (
    <span className="flex flex-wrap gap-x-3 text-[13px] text-slate">
      <span>{batch.total} ứng viên</span>
      {parts
        .filter(([n]) => n > 0)
        .map(([n, label, tone]) => (
          <span key={label} className={`font-semibold ${tone}`}>
            {n} {label}
          </span>
        ))}
    </span>
  );
}

/** "Sếp duyệt": every batch sent, newest first, with where the reviewer is. */
export default function HrReviewsPage() {
  usePageMeta('Sếp duyệt ứng viên');
  const reviews = useReviews();
  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeading
        title="Sếp duyệt ứng viên"
        titleHiddenOnPhone
        subtitle="Các đợt đã gửi sếp. Kết quả tự cập nhật khi sếp chọn trên link."
        action={
          <ButtonLink to="/hr/ho-so" icon="checkSquare" variant="outline">
            Chọn ứng viên gửi sếp
          </ButtonLink>
        }
      />
      {reviews.isPending && <LoadingStatus />}
      {reviews.isError && <ErrorState onRetry={() => reviews.refetch()} message={apiMessage(reviews.error)} />}
      {reviews.data?.length === 0 && (
        <EmptyState icon="checkSquare" title="Chưa gửi đợt nào">
          Ở "Hồ sơ ứng viên", bấm "Gửi sếp duyệt", chọn ứng viên rồi tạo link gửi sếp qua Zalo.
        </EmptyState>
      )}
      {reviews.data && reviews.data.length > 0 && (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-card border border-line bg-white p-0">
          {reviews.data.map((batch) => (
            <li key={batch.id} className="border-b border-line-soft last:border-b-0">
              <Link
                to={`/hr/duyet/${batch.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-navy no-underline hover:bg-hover"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold">{batch.title}</span>
                  <span className="text-[13px] text-slate">
                    Gửi {batch.reviewerName} · {shortTime(batch.createdAt)} · hạn {shortTime(batch.respondBy)}
                  </span>
                  <Counts batch={batch} />
                </span>
                <BatchStatus batch={batch} />
                <Icon name="chevronRight" size={18} className="text-slate" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
