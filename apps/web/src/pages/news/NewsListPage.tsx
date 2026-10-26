import { NEWS_PAGE_SIZE, newsCategoryPath, newsTagPath, type NewsListResponse } from '@careers/shared';
import { useEffect, useRef, type RefObject } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../api';
import { useNewsInfinite, useNewsList } from '../../api/queries';
import { newsCategoryClasses } from '../../lib/colors';
import { useMediaQuery, useNotFoundMeta, usePageMeta } from '../../lib/hooks';
import { SITE } from '../../lib/site';
import type { Crumb } from '../../site/Breadcrumbs';
import { ListEnd, LoadMore } from '../../site/LoadMore';
import {
  CategoryChips,
  CategoryChipsPlaceholder,
  pageHref,
  Pagination,
  PostGrid,
  PostGridSkeleton,
  PopularTags,
} from '../../site/news/NewsListParts';
import { PAGE_WIDTH, PageHero } from '../../site/PageHero';
import { ButtonLink } from '../../ui/Button';
import { EmptyState, ErrorState, LoadingStatus } from '../../ui/feedback';
import { Icon } from '../../ui/icons';

export { pageItems } from '../../site/news/NewsListParts';

const INTRO = `Đời sống công ty, cẩm nang ứng viên và câu chuyện của người ${SITE.company}.`;

function NotFound({ what }: { what: 'category' | 'tag' }) {
  return (
    <EmptyState
      icon="search"
      title={what === 'tag' ? 'Không tìm thấy hashtag' : 'Không tìm thấy chuyên mục'}
      actions={
        <ButtonLink to="/tin-tuc" icon="newspaper">
          Xem tất cả bài viết
        </ButtonLink>
      }
    >
      {what === 'tag' ? 'Chưa có bài nào dùng hashtag này.' : 'Chuyên mục có thể đã đổi tên hoặc link chưa đúng.'}
    </EmptyState>
  );
}

/** Meta description and hero intro. The H1 already names the category or hashtag, so the intro does not. */
function listingText(tag: string | undefined, name: string | undefined, isCategory: boolean) {
  if (tag) return { description: `Các bài viết có hashtag ${name ?? ''}.`, intro: 'Các bài viết có hashtag này.' };
  if (isCategory) {
    return { description: `Các bài viết mới nhất trong chuyên mục ${name ?? ''}.`, intro: 'Bài mới nhất trước.' };
  }
  return { description: INTRO, intro: INTRO };
}

/**
 * The page number from ?trang=N. Old links used ?page=N: read it too, and swap it for ?trang= in the address
 * bar (replace, so Back still works), so every page has one address (the canonical keeps ?trang=).
 */
function usePageParam(): number {
  const [params, setParams] = useSearchParams();
  const old = params.get('page');
  const raw = params.get('trang') ?? old;
  useEffect(() => {
    if (old === null) return;
    const next = new URLSearchParams(params);
    next.delete('page');
    const n = Number(old);
    if (!next.has('trang') && Number.isInteger(n) && n > 1) next.set('trang', String(n));
    setParams(next, { replace: true });
  }, [old, params, setParams]);
  return Math.max(1, Math.trunc(Number(raw)) || 1);
}

/** What this list shows: everything, one category, or one hashtag. */
function useListing() {
  const { slug, tag } = useParams();
  const page = usePageParam();
  const query = useNewsList({ page, category: slug, tag });
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  const filtered = !!(slug || tag);
  const name = tag ? query.data?.tag && `#${query.data.tag.name}` : slug ? query.data?.category?.name : 'Tin tức';
  const missing = tag ? 'Không tìm thấy hashtag' : 'Không tìm thấy chuyên mục';
  return {
    query,
    page,
    notFound,
    filtered,
    current: slug,
    title: name ?? (notFound ? missing : undefined),
    ...listingText(tag, name ?? undefined, !!query.data?.category),
    base: tag ? newsTagPath(tag) : slug ? newsCategoryPath(slug) : '/tin-tuc',
    crumbs: (filtered
      ? [{ label: 'Tin tức', to: '/tin-tuc' }, { label: name ?? '…' }]
      : [{ label: 'Tin tức' }]) as Crumb[],
    // How many posts this list has: the category's count, or all categories together; unknown for a hashtag.
    count: slug
      ? (query.data?.category?.postCount ?? null)
      : tag
        ? null
        : (query.data?.categories.reduce((sum, c) => sum + c.postCount, 0) ?? null),
    kind: (tag ? 'tag' : 'category') as 'tag' | 'category',
    ...heroEyebrow(slug, tag),
  };
}

/** "CHUYÊN MỤC" (in the category's colour) / "HASHTAG" (neutral: hashtags have no colour) above the H1. */
function heroEyebrow(slug: string | undefined, tag: string | undefined) {
  if (tag) return { eyebrow: 'Hashtag', eyebrowClassName: 'text-silver' };
  if (slug) return { eyebrow: 'Chuyên mục', eyebrowClassName: newsCategoryClasses(slug).textOnDark };
  return { eyebrow: undefined, eyebrowClassName: undefined };
}

type Listing = ReturnType<typeof useListing>;

/**
 * After moving to another page number: the new posts start at the top of the list, so scroll there and move
 * focus to it (keyboard and screen reader users land on the new posts). Compares with the previous page
 * number, so mounting (also React's double effect in development, or coming Back) never scrolls.
 */
function useFocusListOnPage(page: number, list: RefObject<HTMLElement | null>) {
  const shown = useRef(page);
  useEffect(() => {
    if (shown.current === page) return;
    shown.current = page;
    const el = list.current;
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }, [page, list]);
}

/** Phones grow one list with "Xem thêm bài"; larger screens use numbered pages. */
function usePhoneList(list: Listing) {
  const isPhone = useMediaQuery('(max-width: 767px)');
  const { slug, tag } = useParams();
  const more = useNewsInfinite({ category: slug, tag }, list.page, isPhone && !list.notFound);
  const pages = more.data?.pages ?? [];
  return {
    isPhone,
    posts: pages.flatMap((p) => p.posts),
    next: more.hasNextPage ? (pages[pages.length - 1]?.page ?? list.page) + 1 : undefined,
    loading: more.isFetchingNextPage,
    ready: pages.length > 0,
    onMore: () => void more.fetchNextPage(),
  };
}

/** "Đã xem 13–24 / 34 bài": a list opened at ?trang=2 starts at post 13, not 1. */
function seenText(from: number, shown: number, total: number | null): string {
  const start = (from - 1) * NEWS_PAGE_SIZE + 1;
  const range = from > 1 ? `${start}–${start + shown - 1}` : `${shown}`;
  return total != null ? `Đã xem ${range} / ${total} bài` : `Đã xem ${range} bài`;
}

function PhoneList({ list, data }: { list: Listing; data: NewsListResponse }) {
  const phone = usePhoneList(list);
  const posts = phone.ready ? phone.posts : data.posts;
  const next = phone.ready ? phone.next : data.page < data.pageCount ? list.page + 1 : undefined;
  const seen = seenText(list.page, posts.length, list.count);
  return (
    <div className="flex flex-col gap-6">
      {list.page > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 rounded-card border border-line bg-white px-4 py-1 text-sm text-slate">
          <span>Đang xem từ bài {(list.page - 1) * NEWS_PAGE_SIZE + 1}</span>
          <Link
            to={pageHref(list.base, 1)}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-link no-underline"
          >
            <Icon name="arrowLeft" size={16} />
            Xem bài mới hơn
          </Link>
        </div>
      )}
      <PostGrid posts={posts} lead={!list.filtered && list.page === 1} />
      {next ? (
        <LoadMore
          label="Xem thêm bài"
          href={pageHref(list.base, next)}
          loading={phone.loading}
          onMore={phone.onMore}
          status={seen}
        />
      ) : (
        <ListEnd>{seen}. Bạn đã xem đến bài cuối.</ListEnd>
      )}
    </div>
  );
}

interface ListBodyProps {
  list: Listing;
  isPhone: boolean;
  listRef: RefObject<HTMLDivElement | null>;
  lead: boolean;
}

/** Skeleton, not found, error, empty, or the posts (grown with "Xem thêm" on phones, numbered pages above). */
function ListBody({ list, isPhone, listRef, lead }: ListBodyProps) {
  const { query, page } = list;
  return (
    <>
      {query.isPending && <LoadingStatus />}
      {query.isPending && <PostGridSkeleton lead={lead} />}
      {list.notFound && <NotFound what={list.kind} />}
      {query.isError && !list.notFound && <ErrorState onRetry={() => query.refetch()} />}
      {query.data?.posts.length === 0 && (
        <EmptyState icon="newspaper" title="Chưa có bài viết">
          Các bài mới sẽ được đăng ở đây. Trong lúc chờ, bạn có thể xem các vị trí đang tuyển.
        </EmptyState>
      )}
      {query.data && query.data.posts.length > 0 && (
        <div
          ref={listRef}
          role="region"
          tabIndex={-1}
          aria-label={`Danh sách bài viết, trang ${page}`}
          className="scroll-mt-4 outline-none"
        >
          {isPhone ? (
            <PhoneList list={list} data={query.data} />
          ) : (
            // While the next page loads the current one stays, dimmed, instead of jumping to skeletons.
            <div
              className={`flex flex-col gap-8 transition-opacity duration-200 ${query.isPlaceholderData ? 'opacity-60' : ''}`}
            >
              <PostGrid posts={query.data.posts} lead={lead} />
              <Pagination page={query.data.page} pageCount={query.data.pageCount} base={list.base} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** /tin-tuc, /tin-tuc/chuyen-muc/:slug and /tin-tuc/the/:tag, with ?trang=2… */
export function NewsListPage() {
  const list = useListing();
  const { query, page } = list;
  const isPhone = useMediaQuery('(max-width: 767px)');
  const listRef = useRef<HTMLDivElement>(null);
  useFocusListOnPage(isPhone ? 1 : page, listRef);
  usePageMeta(
    list.notFound ? undefined : list.title && (page > 1 ? `${list.title} – trang ${page}` : list.title),
    list.description,
  );
  useNotFoundMeta(list.title ?? '', list.notFound);
  const lead = !list.filtered && page === 1;
  const count = list.count != null && list.count > 0 && (
    <span className="whitespace-nowrap text-silver-soft"> · {list.count} bài viết</span>
  );

  return (
    <>
      <PageHero
        crumbs={list.crumbs}
        eyebrow={list.eyebrow}
        eyebrowClassName={list.eyebrowClassName}
        title={list.title ?? ' '}
        intro={
          <>
            {list.intro}
            {count}
          </>
        }
      />
      <main className={`${PAGE_WIDTH} flex min-h-svh flex-col gap-7 py-8 sm:py-12`}>
        {query.data ? (
          <div className="flex flex-col gap-3">
            <CategoryChips categories={query.data.categories} current={list.current} />
            <PopularTags tags={query.data.popularTags} current={query.data.tag?.slug} />
          </div>
        ) : (
          query.isPending && (
            // The categories row and, on phones, the one-line hashtag row: the posts do not move when they load.
            <div aria-hidden="true" className="flex flex-col gap-3">
              <CategoryChipsPlaceholder />
              <div className="h-9 md:hidden" />
            </div>
          )
        )}
        <ListBody list={list} isPhone={isPhone} listRef={listRef} lead={lead} />
      </main>
    </>
  );
}

export default NewsListPage;
