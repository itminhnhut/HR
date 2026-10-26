import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

/**
 * One card shell for the public pages (job, mini job, news): white, 1px line, 6px corners, a soft lift on
 * hover, full height in a grid row, and a footer pinned to the bottom so cards side by side line up.
 */
export const CARD_PAD = 'p-5 sm:p-6';

export const cardClass = (extra = '') =>
  `flex h-full min-w-0 overflow-hidden rounded-card border border-line bg-white text-navy ${extra}`;

/** Title underline on hover of the whole card. */
export const CARD_TITLE_HOVER = 'group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4';

export function CardLink({ className = '', children, ...rest }: LinkProps & { className?: string }) {
  return (
    <Link className={cardClass(`card-lift group no-underline hover:text-navy ${className}`)} {...rest}>
      {children}
    </Link>
  );
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-auto flex items-center justify-between gap-4 border-t border-line-soft pt-4 ${className}`}>
      {children}
    </div>
  );
}
