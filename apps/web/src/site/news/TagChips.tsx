import { newsTagPath, type NewsTagDto } from '@careers/shared';
import { Link } from 'react-router';

/** "#Phỏng vấn" chips, each linking to /tin-tuc/the/<slug>. Neutral: hashtags carry no category colour. */
export function TagChips({ tags, className = '' }: { tags: NewsTagDto[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Hashtag" className={`m-0 flex list-none flex-wrap gap-2 p-0 ${className}`}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link
            to={newsTagPath(tag.slug)}
            className="inline-flex min-h-11 items-center rounded-full border border-transparent bg-tint px-4 text-sm text-ink no-underline transition-colors hover:border-silver-soft hover:text-navy"
          >
            <span className="font-semibold text-slate">#</span>
            {tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
