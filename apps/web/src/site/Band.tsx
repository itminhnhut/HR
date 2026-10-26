import type { ReactNode } from 'react';
import { PAGE_WIDTH } from './PageHero';

/**
 * A full-width stripe of a page, so long pages read as sections: white, a soft blue-grey tint, or the soft
 * brand tint (company life). The content keeps the page width.
 */
export type BandTone = 'plain' | 'white' | 'tint' | 'brand';

const TONE: Record<BandTone, string> = {
  plain: '',
  white: 'border-y border-line bg-white',
  tint: 'bg-tint',
  brand: 'border-y border-brand-line bg-brand-soft',
};

export function Band({
  tone,
  children,
  className = '',
}: {
  tone: BandTone;
  children: ReactNode;
  /** Classes for the inner, page-wide box (padding, gaps). */
  className?: string;
}) {
  return (
    <div className={TONE[tone]}>
      <div className={`${PAGE_WIDTH} py-12 sm:py-16 ${className}`}>{children}</div>
    </div>
  );
}
