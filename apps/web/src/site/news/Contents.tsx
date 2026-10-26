import { numberHeadings, type ArticleHeadingRef } from '@careers/shared';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useScrolledPast } from '../../lib/hooks';
import { Icon } from '../../ui/icons';

type NumberedHeading = ReturnType<typeof numberHeadings>[number];

/** Headings above this line (px from the top) count as read. Matches the headings' scroll margin. */
const READ_LINE = 120;

/**
 * The section being read: the first heading inside the upper part of the screen, or else the last one
 * already passed. Drives the highlight in the desktop contents.
 */
function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = key
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const inBand = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.add(e.target.id);
          else inBand.delete(e.target.id);
        }
        const first = els.find((el) => inBand.has(el.id));
        const passed = els.filter((el) => el.getBoundingClientRect().top < READ_LINE);
        setActive(first?.id ?? passed[passed.length - 1]?.id ?? null);
      },
      { rootMargin: '-96px 0px -55% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
  return active;
}

/**
 * True while the reader is inside the article text (its end is still below the upper part of the screen).
 * The floating "Mục lục" pill only makes sense there, not over related posts, jobs or the footer.
 */
function useReadingArticle(): boolean {
  const [reading, setReading] = useState(true);
  useEffect(() => {
    const update = () => {
      const body = document.querySelector('.article-prose');
      setReading(!!body && body.getBoundingClientRect().bottom > window.innerHeight * 0.4);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return reading;
}

/** Scroll to a heading by hand: the preview build uses #/ routes, where a bare #id would change the page. */
function goTo(id: string) {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  // The address points at the section (shareable), without a new history entry; never in the #/ build.
  if (!window.location.hash.startsWith('#/')) window.history.replaceState(window.history.state, '', `#${id}`);
}

const DEPTH_STYLE = [
  'pl-3 text-sm font-medium text-navy',
  'pl-7 text-[13px] text-body',
  'pl-11 text-[13px] text-slate',
];

interface TocListProps {
  headings: NumberedHeading[];
  active?: string | null;
  /** Phones: every entry is a 44px tap target. Desktop: compact, 44px only on touch screens. */
  touch?: boolean;
  onPick?: () => void;
  className?: string;
}

/** "Mục lục" entries, numbered 1 / 1.1 / 1.1.1 and indented by level. At most two lines each (full text in the tooltip). */
function TocList({ headings, active, touch, onPick, className = '' }: TocListProps) {
  return (
    <ol className={`m-0 flex list-none flex-col gap-0.5 border-l border-line p-0 ${className}`}>
      {headings.map((h) => {
        const isActive = h.id === active;
        return (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              title={h.label}
              aria-current={isActive ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onPick?.();
                goTo(h.id);
              }}
              className={`-ml-px flex gap-2 border-l-2 py-1.5 pr-2 leading-snug no-underline transition-colors hover:border-accent hover:text-navy ${
                touch ? 'min-h-11 items-center' : 'pointer-coarse:min-h-11 pointer-coarse:items-center'
              } ${isActive ? 'border-accent bg-tint/70 text-navy' : 'border-transparent'} ${DEPTH_STYLE[Math.min(h.depth, 2)]}`}
            >
              <span aria-hidden="true" className="shrink-0 tabular-nums text-slate">
                {h.number}
              </span>
              <span className="line-clamp-2">{h.label}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/** Phones: the contents folded in a box above the text; picking an entry folds it again. */
function ContentsBox({ box, headings }: { box: RefObject<HTMLDetailsElement | null>; headings: NumberedHeading[] }) {
  return (
    <details ref={box} className="group scroll-mt-4 rounded-card border border-line bg-white lg:hidden">
      {/* Looks and behaves like a button: icon, how many sections, and a chevron that turns when open. */}
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 text-[15px] font-medium text-navy [&::-webkit-details-marker]:hidden">
        <Icon name="toc" size={16} className="shrink-0 text-accent" />
        <span className="flex-1">
          Mục lục <span className="font-normal text-slate">· {headings.length} phần</span>
        </span>
        <span className="text-[13px] font-normal text-accent group-open:hidden">Xem</span>
        <Icon
          name="chevronDown"
          size={16}
          className="shrink-0 text-slate transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <nav aria-label="Mục lục" className="border-t border-line px-4 pb-4 pt-3">
        <TocList headings={headings} touch onPick={() => box.current?.removeAttribute('open')} />
      </nav>
    </details>
  );
}

/**
 * Table of contents. Desktop: a sticky column that highlights the section being read. Phones: a folded box
 * above the text, and once it has scrolled away a small "Mục lục" pill that brings it back, opened.
 */
export function Contents({ headings, side }: { headings: ArticleHeadingRef[]; side?: ReactNode }) {
  const numbered = numberHeadings(headings);
  const active = useActiveHeading(numbered.map((h) => h.id));
  const box = useRef<HTMLDetailsElement>(null);
  const pastBox = useScrolledPast(box);
  const reading = useReadingArticle();
  const hasToc = headings.length >= 2;
  if (!hasToc && !side) return null;

  const reopen = () => {
    const el = box.current;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ block: 'start' });
    el.querySelector('summary')?.focus({ preventScroll: true });
  };

  return (
    <aside className="order-first lg:order-last lg:w-[260px] lg:shrink-0 lg:self-stretch">
      {hasToc && <ContentsBox box={box} headings={numbered} />}
      {/* Desktop: the contents, then whatever the page adds (popular hashtags), sticky together. */}
      <div className="sticky top-8 hidden max-h-[calc(100vh-4rem)] flex-col gap-8 overflow-y-auto lg:flex">
        {hasToc && (
          <nav aria-label="Mục lục" className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate">Mục lục</span>
            <TocList headings={numbered} active={active} />
          </nav>
        )}
        {side}
      </div>
      {hasToc && pastBox && reading && (
        <button
          type="button"
          onClick={reopen}
          className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-20 inline-flex min-h-11 animate-pop items-center gap-2 rounded-full border-0 bg-navy px-4 text-sm font-medium text-white shadow-[0_8px_24px_rgba(11,31,58,0.28)] lg:hidden"
        >
          <Icon name="toc" size={16} />
          Mục lục
        </button>
      )}
    </aside>
  );
}
