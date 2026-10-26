import { newsCategoryPath, type NewsCardDto, type NewsCategoryDto } from '@careers/shared';
import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router';
import { newsCategoryClasses, type ColorClasses } from '../../lib/colors';
import { Icon } from '../../ui/icons';
import { NewsCard, NewsCardSkeleton } from './NewsCard';

export { PopularTags } from './PopularTags';

/** Rows below lg, three columns from lg. Also used by the related posts and the teaser. */
export const NEWS_GRID = 'grid gap-3 md:gap-4 lg:grid-cols-3 lg:gap-6';

export function pageHref(base: string, page: number) {
  return page > 1 ? `${base}?trang=${page}` : base;
}

/** 1 … 4 5 6 … 12: first, last and the pages around the current one. */
export function pageItems(page: number, pageCount: number): (number | 'gap')[] {
  const keep = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const items: (number | 'gap')[] = [];
  for (const n of [...keep].sort((a, b) => a - b)) {
    const prev = items[items.length - 1];
    if (typeof prev === 'number' && n - prev > 1) items.push('gap');
    items.push(n);
  }
  return items;
}

const CHIP =
  'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm no-underline transition-colors';

/** "Tất cả": navy when open. */
const allChip = (active: boolean) =>
  `${CHIP} ${
    active
      ? 'border-navy bg-navy font-medium text-white hover:text-white'
      : 'border-silver bg-white text-navy hover:border-silver-soft hover:text-navy'
  }`;

/** A category: a dot in its colour; open, it is filled with its tint and outlined in its colour. */
const categoryChip = (c: ColorClasses, active: boolean) =>
  `${CHIP} gap-2 ${
    active
      ? `${c.border} ${c.soft} ${c.text} font-semibold`
      : `border-silver bg-white text-navy ${c.hoverLine} hover:text-navy`
  }`;

/** The row of chips takes its height before the categories arrive, so the posts below do not jump. */
export function CategoryChipsPlaceholder() {
  return <div aria-hidden="true" className="h-11" />;
}

/** "Tất cả", then each category with posts. On phones the row scrolls and starts with the open one centred. */
export function CategoryChips({ categories, current }: { categories: NewsCategoryDto[]; current: string | undefined }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    // Scroll the row only (scrollIntoView could also move the page).
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [current]);
  const shown = categories.filter((c) => c.postCount > 0 || c.slug === current);
  if (shown.length === 0) return <CategoryChipsPlaceholder />;
  return (
    <nav
      ref={ref}
      aria-label="Chuyên mục"
      className="scroll-fade-x relative -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      <NavLink to="/tin-tuc" end className={({ isActive }) => allChip(isActive)}>
        Tất cả
      </NavLink>
      {shown.map((c) => {
        const color = newsCategoryClasses(c.slug);
        return (
          <NavLink key={c.id} to={newsCategoryPath(c.slug)} className={({ isActive }) => categoryChip(color, isActive)}>
            <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color.fill}`} />
            {c.name}
            <span className={c.slug === current ? '' : 'text-slate'}>{c.postCount}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Numbered pages. The links keep the scroll position (no jump to the top of the page first): the list then
 * scrolls itself smoothly to its first post (useFocusListOnPage), one movement instead of a jump and a scroll.
 */
export function Pagination({ page, pageCount, base }: { page: number; pageCount: number; base: string }) {
  if (pageCount <= 1) return null;
  const item =
    'inline-flex size-11 items-center justify-center rounded-control border text-sm no-underline transition-colors';
  const idle = `${item} border-silver bg-white text-navy hover:border-navy hover:text-navy`;
  return (
    <nav aria-label="Phân trang" className="flex flex-col items-center gap-3 pt-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 && (
          <Link to={pageHref(base, page - 1)} preventScrollReset aria-label="Trang trước" className={idle}>
            <Icon name="arrowLeft" size={16} />
          </Link>
        )}
        {pageItems(page, pageCount).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate">
              …
            </span>
          ) : (
            <Link
              key={n}
              to={pageHref(base, n)}
              preventScrollReset
              aria-current={n === page ? 'page' : undefined}
              aria-label={`Trang ${n}`}
              className={n === page ? `${item} border-navy bg-navy font-semibold text-white hover:text-white` : idle}
            >
              {n}
            </Link>
          ),
        )}
        {page < pageCount && (
          <Link to={pageHref(base, page + 1)} preventScrollReset aria-label="Trang sau" className={idle}>
            <Icon name="arrowRight" size={16} />
          </Link>
        )}
      </div>
      <span className="text-[13px] text-slate">
        Trang {page} / {pageCount}
      </span>
    </nav>
  );
}

/**
 * Page 1 of all posts: the newest large (two of three columns from lg, text over the photo) with the next two
 * stacked in the third column at the same height, then rows of three (12 posts fill the rows exactly). Other
 * pages and filtered lists: the grid.
 */
export function PostGrid({ posts, lead }: { posts: NewsCardDto[]; lead: boolean }) {
  const [first, sideA, sideB, ...rest] = posts;
  if (!lead || !first || !sideA || !sideB) {
    return (
      <div className={`stagger ${NEWS_GRID}`}>
        {posts.map((post) => (
          <NewsCard key={post.slug} post={post} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-6">
      {/* The same three columns as the grid below: the featured post spans two, the side cards the third. */}
      <div className="stagger grid gap-3 md:gap-4 lg:grid-cols-3 lg:gap-6">
        <NewsCard post={first} layout="featured" className="lg:col-span-2" />
        <div className="stagger grid gap-3 md:gap-4 lg:grid-rows-2 lg:gap-6">
          <NewsCard post={sideA} layout="side" />
          <NewsCard post={sideB} layout="side" />
        </div>
      </div>
      {rest.length > 0 && (
        <div className={`stagger ${NEWS_GRID}`}>
          {rest.map((post) => (
            <NewsCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Same boxes as PostGrid, shown at once and faded in only if loading takes a moment. */
export function PostGridSkeleton({ lead }: { lead: boolean }) {
  const grid = (n: number) => (
    <div className={NEWS_GRID}>
      {Array.from({ length: n }, (_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  );
  if (!lead) return <div className="skeleton-in">{grid(6)}</div>;
  return (
    <div className="skeleton-in flex flex-col gap-3 md:gap-4 lg:gap-6">
      <div className="grid gap-3 md:gap-4 lg:grid-cols-3 lg:gap-6">
        <NewsCardSkeleton layout="featured" className="lg:col-span-2" />
        <div className="grid gap-3 md:gap-4 lg:grid-rows-2 lg:gap-6">
          <NewsCardSkeleton layout="side" />
          <NewsCardSkeleton layout="side" />
        </div>
      </div>
      {grid(3)}
    </div>
  );
}
