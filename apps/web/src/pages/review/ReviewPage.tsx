import { type ReviewDecision, type ReviewItemPublicDto, type ReviewPageDto } from '@careers/shared';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '../../api';
import { useReviewDone, useReviewPage } from '../../api/queries';
import { useNoIndex, usePageMeta } from '../../lib/hooks';
import { SITE } from '../../lib/site';
import { LoadingStatus } from '../../ui/feedback';
import { Icon, LogoMark } from '../../ui/icons';
import { errorMessage } from '../hr/parts';
import { shortTime } from '../hr/reviews/reviewModel';
import { CvViewer } from './CvViewer';
import { ReviewCard } from './ReviewCard';

type Filter = 'all' | 'todo' | ReviewDecision;

const FILTERS: [Filter, string][] = [
  ['all', 'Tất cả'],
  ['todo', 'Chưa quyết'],
  ['approve', 'Duyệt'],
  ['reject', 'Không'],
  ['ask', 'Hỏi HR'],
];

const when = shortTime;

function Header({ page }: { page: ReviewPageDto }) {
  return (
    <header className="bg-linear-to-br from-navy to-[#13305a] text-white">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-3.5 px-4 pb-6 pt-5 sm:px-6">
        <div className="flex items-center gap-2.5 font-serif text-lg">
          <LogoMark size={28} />
          {SITE.company}
          <span className="ml-auto inline-flex items-center gap-1.5 font-sans text-xs text-silver">
            <Icon name="lock" size={13} /> Link riêng của {page.reviewerName}
          </span>
        </div>
        <h1 className="m-0 font-serif text-[26px] font-medium leading-tight sm:text-[32px]">{page.title}</h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-silver">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="user" size={14} /> HR gửi: {page.senderName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" size={14} /> Mong phản hồi trước{' '}
            <b className="font-semibold text-white">{when(page.respondBy)}</b>
          </span>
        </div>
        {page.message && (
          <p className="m-0 rounded-card border border-white/15 bg-white/[0.08] px-3.5 py-3 text-sm text-[#e8edf5]">
            <b className="text-white">Lời nhắn của HR:</b> {page.message}
          </p>
        )}
      </div>
    </header>
  );
}

const countOf = (items: ReviewItemPublicDto[], f: Filter) =>
  f === 'all'
    ? items.length
    : f === 'todo'
      ? items.filter((i) => !i.decision).length
      : items.filter((i) => i.decision === f).length;

function Progress({
  items,
  filter,
  onFilter,
}: {
  items: ReviewItemPublicDto[];
  filter: Filter;
  onFilter: (f: Filter) => void;
}) {
  const total = items.length || 1;
  const bars: [ReviewDecision, string][] = [
    ['approve', 'bg-ok'],
    ['reject', 'bg-error'],
    ['ask', 'bg-cat-amber'],
  ];
  return (
    <div className="sticky top-0 z-20 border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-2.5 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 text-[13.5px] text-slate">
          <div aria-hidden="true" className="flex h-2 flex-1 overflow-hidden rounded-full bg-tint">
            {bars.map(([k, tone]) => (
              <i
                key={k}
                className={`block h-full transition-[width] ${tone}`}
                style={{ width: `${(countOf(items, k) / total) * 100}%` }}
              />
            ))}
          </div>
          <span>
            Đã quyết {items.length - countOf(items, 'todo')}/{items.length}
          </span>
        </div>
        <div
          role="group"
          aria-label="Lọc ứng viên"
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => onFilter(key)}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-[13px] ${filter === key ? 'border-navy bg-navy font-semibold text-white' : 'border-line bg-white text-slate'}`}
            >
              {label} <span className="opacity-70">{countOf(items, key)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer({ page, token }: { page: ReviewPageDto; token: string }) {
  const done = useReviewDone(token);
  const left = countOf(page.items, 'todo');
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white shadow-[0_-8px_24px_rgba(11,31,58,0.06)]">
      <div className="mx-auto flex min-h-16 max-w-[1080px] items-center gap-3 px-4 py-2 pb-[calc(8px+env(safe-area-inset-bottom))] sm:px-6">
        <p className="m-0 flex-1 text-[13px] text-slate">
          {done.error ? (
            <span role="alert" className="text-error">
              {errorMessage(done.error)}
            </span>
          ) : (
            <>
              <b className="text-navy">Tự lưu</b>, HR thấy ngay
              <span className="max-sm:hidden">. Đổi ý được tới khi HR hẹn lịch</span>.
            </>
          )}
        </p>
        <button
          type="button"
          disabled={left > 0 || !!page.doneAt || done.isPending}
          onClick={() => done.mutate()}
          className="min-h-[46px] rounded-control border-0 bg-brand px-4 font-semibold text-white shadow-[0_6px_16px_rgba(176,33,63,0.22)] disabled:bg-silver disabled:shadow-none"
        >
          {page.doneAt ? '✓ Đã báo HR' : left > 0 ? `Còn ${left} bạn chưa quyết` : 'Báo HR: đã xem xong'}
        </button>
      </div>
    </div>
  );
}

function Closed({ state }: { state: ReviewPageDto['state'] }) {
  return (
    <p
      role="status"
      className="m-0 flex items-start gap-2.5 rounded-card border border-cat-amber-line bg-cat-amber-soft px-4 py-3 text-sm text-ink"
    >
      <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-cat-amber" />
      {state === 'revoked'
        ? 'HR đã khoá link này. Anh/chị chỉ xem lại được, không chọn được nữa.'
        : 'Link đã hết hạn nên chỉ xem lại được. Nhắn HR gia hạn nếu cần thêm thời gian.'}
    </p>
  );
}

function NotFound({ error }: { error: unknown }) {
  const gone = error instanceof ApiError && error.status === 404;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex rounded-full border border-ring p-3 text-accent">
        <Icon name="lock" size={24} />
      </span>
      <h1 className="m-0 font-serif text-[26px] font-medium">{gone ? 'Link không mở được' : 'Chưa tải được trang'}</h1>
      <p className="m-0 text-[15px] text-slate">{gone ? errorMessage(error) : 'Kiểm tra mạng rồi tải lại trang.'}</p>
    </main>
  );
}

/** /duyet/:token: the reviewer reads each application and decides; no sign-in, no site menu, not indexed. */
export default function ReviewPage() {
  const { token = '' } = useParams();
  useNoIndex();
  const query = useReviewPage(token);
  usePageMeta(query.data?.title ?? 'Duyệt ứng viên');
  const [filter, setFilter] = useState<Filter>('all');
  const [cvItem, setCvItem] = useState<ReviewItemPublicDto | null>(null);
  const items = query.data?.items;
  const shown = useMemo(
    () => (items ?? []).filter((i) => filter === 'all' || (filter === 'todo' ? !i.decision : i.decision === filter)),
    [items, filter],
  );
  if (query.isPending) return <LoadingStatus />;
  if (query.isError) return <NotFound error={query.error} />;
  const page = query.data;
  const readOnly = page.state !== 'open';
  return (
    <div className="min-h-dvh bg-mist pb-28 text-navy">
      <Header page={page} />
      <Progress items={page.items} filter={filter} onFilter={setFilter} />
      <main className="mx-auto flex max-w-[1080px] flex-col gap-4 px-4 py-5 sm:px-6">
        {readOnly && <Closed state={page.state} />}
        <div className="grid gap-3.5 md:grid-cols-2">
          {shown.map((item) => (
            <ReviewCard key={item.id} item={item} token={token} readOnly={readOnly} onOpenCv={() => setCvItem(item)} />
          ))}
        </div>
        {shown.length === 0 && <p className="m-0 text-center text-sm text-slate">Không có ứng viên nào ở mục này.</p>}
        <p className="m-0 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted">
          <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
          Link này chỉ dành cho {page.reviewerName}, dùng được tới {when(page.expiresAt)} và HR có thể khoá bất cứ lúc
          nào. Thông tin ứng viên chỉ dùng cho tuyển dụng, vui lòng không chuyển tiếp. Số điện thoại và email của ứng
          viên được ẩn; HR sẽ liên hệ các bạn được duyệt.
        </p>
      </main>
      {!readOnly && <Footer page={page} token={token} />}
      <CvViewer token={token} item={cvItem} reviewerName={page.reviewerName} onClose={() => setCvItem(null)} />
    </div>
  );
}
