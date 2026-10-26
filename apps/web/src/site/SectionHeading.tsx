import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Icon, type IconName } from '../ui/icons';

/** "Xem tất cả →": the one text-link style for moving on to another page. */
export const textLinkClass = (extra = '') =>
  `group/link inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link no-underline hover:text-navy ${extra}`;

export function TextLink({ children, className = '', ...rest }: LinkProps & { className?: string }) {
  return (
    <Link className={textLinkClass(className)} {...rest}>
      {children}
      <Icon name="arrowRight" size={16} className="shrink-0 transition-transform group-hover/link:translate-x-0.5" />
    </Link>
  );
}

interface SectionHeadingProps {
  title: ReactNode;
  /** lg: a section of the page (26/32px); md: a smaller block such as a sidebar or a result (22/24px). */
  size?: 'lg' | 'md';
  icon?: IconName;
  id?: string;
  /** Right after the title, on its baseline: a count. */
  note?: ReactNode;
  /** Right side: a count, a "Xem tất cả" link or a filter reset. */
  children?: ReactNode;
  className?: string;
}

/** The H2 of a page section. Two sizes only, so sections look alike on every page. */
export function SectionHeading({ title, size = 'lg', icon, id, note, children, className = '' }: SectionHeadingProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-1 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          id={id}
          className={`m-0 flex items-center gap-3 font-serif font-medium text-navy ${size === 'lg' ? 'type-h2' : 'type-h2-sm'}`}
        >
          {icon && <Icon name={icon} size={20} stroke={1.5} className="shrink-0 text-accent" />}
          {title}
        </h2>
        {note}
      </div>
      {children}
    </div>
  );
}
