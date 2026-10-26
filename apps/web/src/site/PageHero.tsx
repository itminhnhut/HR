import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import { NavyHero } from './NavyHero';

/** One width and side padding for every public page (hero, main, footer). */
export const PAGE_WIDTH = 'mx-auto w-full max-w-[1160px] px-5 sm:px-6';

/** One padding scale: the breadcrumb row (44px tall) brings its own room above the title. */
function heroPadding(hasCrumbs: boolean, overlap = false): string {
  const top = hasCrumbs ? 'pt-3 sm:pt-5' : 'pt-10 sm:pt-14';
  return `${top} ${overlap ? 'pb-20 sm:pb-24' : 'pb-12 sm:pb-16'}`;
}

interface PageHeroProps {
  /** Path after "Trang chủ"; the home page has none. */
  crumbs?: Crumb[];
  /** Small capitals above the title ("VỀ CHÚNG TÔI", a category). */
  eyebrow?: ReactNode;
  /** Eyebrow colour on navy: a category's or department's bright tone (lib/colors), else silver. */
  eyebrowClassName?: string;
  title: ReactNode;
  intro?: ReactNode;
  /** Lines between the title and the intro (salary, date). */
  children?: ReactNode;
  actions?: ReactNode;
  /** A card overlaps the bottom of the hero (job facts, post cover): leaves room for it. */
  overlap?: boolean;
  /** Extra classes for the H1 (a closed job is greyed). */
  titleClassName?: string;
}

/**
 * The navy band at the top of every public page: breadcrumbs, optional eyebrow, the page's only H1, intro and
 * actions. Same padding everywhere, the waves always, and the same entrance (the lines rise in one by one).
 */
export function PageHero({
  crumbs,
  eyebrow,
  eyebrowClassName = 'text-silver',
  title,
  intro,
  children,
  actions,
  overlap,
  titleClassName = '',
}: PageHeroProps) {
  return (
    <NavyHero>
      <div className={`relative ${PAGE_WIDTH} flex flex-col gap-3 sm:gap-4 ${heroPadding(!!crumbs, overlap)}`}>
        {crumbs && <Breadcrumbs items={crumbs} />}
        <div className="stagger flex flex-col gap-3 sm:gap-4">
          {eyebrow && (
            <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${eyebrowClassName}`}>{eyebrow}</span>
          )}
          <h1
            className={`m-0 max-w-[860px] font-serif type-h1 font-medium tracking-[-0.2px] text-white ${titleClassName}`}
          >
            {title}
          </h1>
          {children}
          {intro && (
            <p className="m-0 max-w-[620px] text-[15px] font-light leading-relaxed text-silver [text-wrap:pretty] sm:text-[17px]">
              {intro}
            </p>
          )}
          {actions && <div className="mt-2 flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </NavyHero>
  );
}

/** The hero while a page loads: same box and height, placeholders fade in only if loading takes a moment. */
export function PageHeroSkeleton({ crumbs = true, overlap }: { crumbs?: boolean; overlap?: boolean }) {
  return (
    <NavyHero>
      <div
        aria-hidden="true"
        className={`relative ${PAGE_WIDTH} flex flex-col gap-3 sm:gap-4 ${heroPadding(crumbs, overlap)}`}
      >
        {crumbs && <span className="block h-11" />}
        <div className="skeleton-in flex flex-col gap-3 sm:gap-4">
          <span className="block h-3.5 w-28 animate-pulse-soft rounded-control bg-silver/15" />
          <span className="block h-[38px] w-[min(560px,85%)] animate-pulse-soft rounded-control bg-silver/15 sm:h-[55px]" />
          <span className="block h-4 w-[min(360px,60%)] animate-pulse-soft rounded-control bg-silver/15" />
        </div>
      </div>
    </NavyHero>
  );
}
