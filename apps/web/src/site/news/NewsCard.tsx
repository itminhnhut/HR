import { formatTimestamp, NEWS_IMAGE_SIZES, newsPath, type NewsCardDto } from '@careers/shared';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { keys } from '../../api/queries';
import { newsCategoryClasses } from '../../lib/colors';
import { CardLink, CARD_TITLE_HOVER, cardClass } from '../Card';
import { NewsImage } from './NewsImage';

/** "26/10/2026 · 4 phút đọc" */
export function NewsMeta({
  post,
  className = '',
  light = false,
}: {
  post: NewsCardDto;
  className?: string;
  light?: boolean;
}) {
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] ${light ? 'text-silver-soft' : 'text-slate'} ${className}`}
    >
      <time dateTime={post.publishedAt}>{formatTimestamp(post.publishedAt)}</time>
      <span aria-hidden="true">·</span>
      <span>{post.readingMinutes} phút đọc</span>
    </span>
  );
}

/** Loads the post while the pointer rests on its card, so opening it feels instant. */
function usePrefetchPost(slug: string) {
  const qc = useQueryClient();
  return () => {
    void qc.prefetchQuery({ queryKey: keys.newsPost(slug), queryFn: () => api.getNews(slug), staleTime: 60_000 });
  };
}

const LABEL = 'text-xs font-semibold uppercase tracking-[0.08em]';

/** The category in its colour (lib/colors), as on the chips and the post page. */
const Category = ({ post }: { post: NewsCardDto }) => (
  <span className={`${LABEL} ${newsCategoryClasses(post.category.slug).text}`}>{post.category.name}</span>
);

/**
 * Over a photo (featured card from lg): white text on the solid category colour (5:1 or more for every colour),
 * so it reads on any picture. Below lg the card has a white body and the plain label.
 */
const CategoryOnPhoto = ({ post }: { post: NewsCardDto }) => {
  const c = newsCategoryClasses(post.category.slug);
  return (
    <>
      <span className={`${LABEL} ${c.text} lg:hidden`}>{post.category.name}</span>
      <span className={`${LABEL} ${c.fill} hidden w-fit rounded-full px-2.5 py-1 text-white lg:inline-flex`}>
        {post.category.name}
      </span>
    </>
  );
};

export type NewsCardLayout = 'featured' | 'grid' | 'side';

interface LayoutStyle {
  link: string;
  /**
   * The category colour bar: down the left of a row below lg (styles.css cat-bar*). From lg no card has a
   * bar: the colour stays on the category label only, the same on every card.
   */
  bar: string;
  image: string;
  body: string;
  title: string;
  summary: string;
  meta: string;
}

/**
 * Below lg every post is a one-column row: a 4:3 thumbnail on the left (120px on phones, 200px on tablets),
 * then category, title (at most three lines), the summary from tablets up, and the date. From lg up it is a
 * classic card in a three-column grid, picture on top. One column below lg means no orphan card in a row.
 */
const ROW: LayoutStyle = {
  link: 'flex-row gap-3.5 p-3 sm:gap-5 sm:p-4 lg:flex-col lg:gap-0 lg:p-0',
  bar: 'cat-bar-row lg:before:hidden',
  image:
    'aspect-[4/3] w-[120px] shrink-0 self-start rounded-control sm:w-[200px] lg:aspect-[16/9] lg:w-full lg:self-auto lg:rounded-none',
  body: 'gap-1.5 sm:gap-2 lg:gap-2.5 lg:p-5',
  title: 'line-clamp-3 text-[17px] leading-snug sm:type-card',
  summary: 'line-clamp-2 text-[15px] max-sm:hidden lg:line-clamp-3',
  meta: '',
};

/** How wide each layout shows its picture, for srcset (see LAYOUT). */
const IMAGE_SIZES: Record<NewsCardLayout, string> = {
  grid: NEWS_IMAGE_SIZES.card,
  featured: '(min-width: 1024px) 760px, 100vw',
  side: '(min-width: 1024px) 360px, (min-width: 640px) 200px, 120px',
};

/**
 * First page of all posts, from lg: the newest post ("featured", two of the three grid columns) is a photo card
 * with its text over a navy gradient; the next two ("side", the third column) are stacked cards like the grid
 * below (16:9 picture edge to edge, category, title, date) without the summary. The side cards share the
 * row's height, so the tops and bottoms of both columns line up. Below lg: a card and two rows as before.
 */
const LAYOUT: Record<NewsCardLayout, LayoutStyle> = {
  grid: ROW,
  featured: {
    link: 'flex-col lg:relative lg:min-h-[440px] lg:justify-end lg:border-0 lg:bg-navy',
    bar: 'cat-bar lg:before:hidden',
    image: 'aspect-[16/9] w-full lg:absolute lg:inset-0 lg:aspect-auto lg:h-full',
    body: 'gap-2 p-4 sm:gap-2.5 sm:p-6 lg:relative lg:gap-3 lg:p-8 lg:pt-24',
    title: 'text-[22px] leading-tight sm:text-[28px] lg:line-clamp-3 lg:text-[32px] lg:text-white',
    summary: 'line-clamp-3 text-[15px] sm:text-base lg:line-clamp-2 lg:text-white/80',
    meta: 'lg:text-white/70',
  },
  side: {
    link: 'flex-row gap-3.5 p-3 sm:gap-5 sm:p-4 lg:flex-col lg:gap-0 lg:p-0',
    bar: 'cat-bar-row lg:before:hidden',
    image:
      'aspect-[4/3] w-[120px] shrink-0 self-start rounded-control sm:w-[200px] lg:aspect-[16/9] lg:w-full lg:self-auto lg:rounded-none',
    body: 'gap-1.5 sm:gap-2 lg:gap-1.5 lg:px-5 lg:pb-4 lg:pt-3.5',
    title: 'line-clamp-3 text-[17px] leading-snug sm:type-card lg:line-clamp-2 lg:text-[20px]',
    summary: 'line-clamp-2 text-[15px] max-sm:hidden lg:hidden',
    meta: '',
  },
};

/**
 * Over the featured photo from lg: navy from the bottom, still 85% where the title starts, so white text keeps
 * 4.5:1 or more even over a white picture (measured in the browser, see the fix-u report).
 */
const PHOTO_SHADE =
  'pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_top,rgb(11_31_58/0.96)_0%,rgb(11_31_58/0.9)_38%,rgb(11_31_58/0.55)_62%,rgb(11_31_58/0)_85%)] lg:block';

export function NewsCard({
  post,
  layout = 'grid',
  heading = 'h2',
  className = '',
}: {
  post: NewsCardDto;
  layout?: NewsCardLayout;
  /** h2 in lists; h3 under a section heading (related posts, teasers). */
  heading?: 'h2' | 'h3';
  className?: string;
}) {
  const Title = heading;
  const prefetch = usePrefetchPost(post.slug);
  const style = LAYOUT[layout];
  const onPhoto = layout === 'featured';
  return (
    <CardLink
      to={newsPath(post.slug)}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className={`${style.link} ${style.bar} ${newsCategoryClasses(post.category.slug).bar} ${className}`}
    >
      <span className={`relative block overflow-hidden bg-tint ${style.image}`}>
        <NewsImage
          src={post.cover?.url}
          srcset={post.cover?.srcset}
          sizes={IMAGE_SIZES[layout]}
          category={post.category}
          alt={post.cover?.alt ?? ''}
          width={post.cover?.width}
          height={post.cover?.height}
          priority={onPhoto}
          className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {onPhoto && <span aria-hidden="true" className={PHOTO_SHADE} />}
      </span>
      <span className={`flex min-w-0 flex-1 flex-col ${style.body} ${onPhoto ? 'lg:flex-none' : ''}`}>
        {onPhoto ? <CategoryOnPhoto post={post} /> : <Category post={post} />}
        <Title className={`m-0 font-serif font-medium [text-wrap:pretty] ${CARD_TITLE_HOVER} ${style.title}`}>
          {post.title}
        </Title>
        {post.summary && <span className={`m-0 leading-relaxed text-body ${style.summary}`}>{post.summary}</span>}
        <NewsMeta post={post} className={`mt-auto pt-1 ${style.meta}`} />
      </span>
    </CardLink>
  );
}

const Bar = ({ className }: { className: string }) => (
  <span className={`block animate-pulse-soft rounded-control bg-skeleton ${className}`} />
);

/** Same box as the card it stands in for. */
export function NewsCardSkeleton({ layout = 'grid', className = '' }: { layout?: NewsCardLayout; className?: string }) {
  const style = LAYOUT[layout];
  return (
    <div aria-hidden="true" className={cardClass(`${style.link} ${className}`)}>
      <span className={`block animate-pulse-soft bg-skeleton ${style.image}`} />
      <div className={`flex flex-1 flex-col gap-3 ${style.body}`}>
        <Bar className="h-3 w-24" />
        <Bar className="h-5 w-4/5" />
        <Bar className="h-4 w-2/3 max-md:hidden" />
        <Bar className="mt-auto h-3 w-32" />
      </div>
    </div>
  );
}
