import { newsTagPath, type NewsTagCountDto } from '@careers/shared';
import { useState } from 'react';
import { Link } from 'react-router';

/** Hashtags shown before "+N": enough to scan, few enough that the first post stays above the fold. */
export const POPULAR_TAGS_SHOWN = 8;

interface PopularTagsProps {
  tags: NewsTagCountDto[];
  /** The hashtag page being shown. */
  current?: string;
  /** Hashtags of the post being read: shown stronger, so readers see where this post belongs. */
  highlight?: string[];
  /** Title on its own line (side column of a post). */
  stacked?: boolean;
}

/** The first eight, plus the open hashtag if it is further down the list. */
function firstTags(tags: NewsTagCountDto[], current: string | undefined): NewsTagCountDto[] {
  const first = tags.slice(0, POPULAR_TAGS_SHOWN);
  const open = tags.find((tag) => tag.slug === current);
  return open && !first.includes(open) ? [...first, open] : first;
}

/** Neutral chips (hashtags carry no category colour, styles.css): grey, navy text, the count in slate. */
function chipClass(on: boolean, mine: boolean): string {
  const base = 'inline-flex min-h-9 items-center rounded-full px-3 text-[13px] no-underline transition-colors';
  if (on) return `${base} bg-navy font-medium text-white hover:text-white`;
  if (mine)
    return `${base} bg-accent/15 font-medium text-navy ring-1 ring-accent/40 hover:bg-accent/20 hover:text-navy`;
  return `${base} border border-transparent bg-tint text-ink hover:border-silver-soft hover:text-navy`;
}

function TagLink({ tag, on, mine }: { tag: NewsTagCountDto; on: boolean; mine: boolean }) {
  return (
    <Link to={newsTagPath(tag.slug)} aria-current={on ? 'page' : undefined} className={chipClass(on, mine)}>
      <span className={on || mine ? '' : 'font-semibold text-slate'}>#</span>
      {tag.name}
      <span className={`ml-1 ${on ? 'text-silver' : 'text-slate'}`}>{tag.postCount}</span>
    </Link>
  );
}

/**
 * "Hashtag nổi bật": the most used hashtags, small and quiet under the categories (categories stay the main
 * filter). Eight show; "+N" opens the rest. The open hashtag is highlighted and always shown.
 */
export function PopularTags({ tags, current, highlight = [], stacked = false }: PopularTagsProps) {
  const [all, setAll] = useState(false);
  if (tags.length === 0) return null;
  const shown = all ? tags : firstTags(tags, current);
  const hidden = tags.length - shown.length;
  return (
    <nav
      aria-label="Hashtag nổi bật"
      className={
        stacked
          ? 'flex flex-col gap-2.5'
          : // Phones: one row that scrolls sideways (like the categories), not a block of tags above the posts.
            'scroll-fade-x -mx-5 flex items-center gap-x-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:gap-y-1.5 md:overflow-visible md:px-0'
      }
    >
      <span
        className={
          stacked
            ? 'text-xs font-semibold uppercase tracking-[0.08em] text-slate'
            : 'mr-1 shrink-0 whitespace-nowrap text-[13px] font-medium text-slate'
        }
      >
        {stacked ? 'Hashtag nổi bật' : 'Hashtag nổi bật:'}
      </span>
      <span
        className={`flex gap-x-2 gap-y-1.5 ${stacked ? 'flex-wrap' : 'md:flex-wrap [&>*]:shrink-0 [&>*]:whitespace-nowrap'}`}
      >
        {shown.map((tag) => (
          <TagLink key={tag.slug} tag={tag} on={tag.slug === current} mine={highlight.includes(tag.slug)} />
        ))}
        {(hidden > 0 || all) && tags.length > POPULAR_TAGS_SHOWN && (
          <button
            type="button"
            aria-expanded={all}
            aria-label={all ? 'Thu gọn hashtag' : `Xem thêm ${hidden} hashtag`}
            onClick={() => setAll(!all)}
            className="inline-flex min-h-9 items-center rounded-full border border-silver bg-white px-3 text-[13px] font-medium text-navy hover:border-silver-soft"
          >
            {all ? 'Thu gọn' : `+${hidden}`}
          </button>
        )}
      </span>
    </nav>
  );
}
