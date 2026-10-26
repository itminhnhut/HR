import { newsTagPath, type NewsCardDto } from '@careers/shared';
import { useEffect, useRef, type RefObject } from 'react';
import { Link } from 'react-router';
import { NewsMeta } from './NewsCard';
import { useImageFallback } from './NewsImage';

/**
 * Article HTML from renderArticle (@careers/shared): every text and attribute is escaped there and links are
 * checked, so it is safe to insert. The API renders it for the public page; the HR preview renders it in
 * the browser with the same function.
 */
export function ArticleBody({ html, className = '' }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // An image that cannot load (deleted file, network) shows the branded default instead of a broken icon.
  useImageFallback(ref);
  useScrollableTables(ref, html);
  return <div ref={ref} className={`article-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** "Bảng: Vị trí, Lương": the table's header cells, so a screen reader says which table it is in. */
function tableName(wrap: Element): string {
  const heads = [...wrap.querySelectorAll('tr:first-child > th, tr:first-child > td')]
    .map((cell) => cell.textContent?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 4);
  return heads.length ? `Bảng: ${heads.join(', ')}` : 'Bảng';
}

/**
 * Wide tables scroll sideways inside .table-wrap (rendered by the shared article renderer). A scrolling box
 * must be reachable by keyboard to scroll it: each one becomes a named region in the Tab order.
 */
function useScrollableTables(ref: RefObject<HTMLDivElement | null>, html: string) {
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('.table-wrap').forEach((wrap) => {
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', tableName(wrap));
    });
  }, [ref, html]);
}

/** Date, reading time and the hashtags (each links to its page), on the navy hero. */
export function ArticleMetaLine({ post }: { post: NewsCardDto }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <NewsMeta post={post} light />
      {post.tags.map((tag) => (
        <Link
          key={tag.slug}
          to={newsTagPath(tag.slug)}
          className="inline-flex min-h-8 items-center rounded-full bg-white/10 px-2.5 text-[13px] text-silver no-underline hover:bg-white/20 hover:text-white"
        >
          #{tag.name}
        </Link>
      ))}
    </span>
  );
}

/** Category, title, date and reading time on navy, as the public page's PageHero shows them. For the HR preview. */
export function ArticleHeader({ post }: { post: NewsCardDto }) {
  return (
    <div className="flex flex-col gap-3.5">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-silver">
        {post.category.name || 'Chưa chọn chuyên mục'}
      </span>
      <h1 className="m-0 max-w-[860px] font-serif type-h1 font-medium">{post.title}</h1>
      <ArticleMetaLine post={post} />
    </div>
  );
}
