import { toSlug } from '@careers/shared';

/**
 * The six category colours (tokens --color-cat-* in styles.css). News categories and job departments each
 * get one, always the same: known names have a fixed colour, any other name a stable hash. Hashtags stay
 * neutral (colour roles: styles.css).
 */
export type CategoryColor = 'blue' | 'teal' | 'amber' | 'rose' | 'violet' | 'emerald';

export const CATEGORY_COLORS: readonly CategoryColor[] = ['blue', 'teal', 'amber', 'rose', 'violet', 'emerald'];

/** Keys are slugs, so "Kỹ thuật", "kỹ thuật " and "ky-thuat" all match. */
const DEPARTMENT_COLORS: Readonly<Record<string, CategoryColor>> = {
  'kinh-doanh': 'blue',
  'ky-thuat': 'teal',
  marketing: 'rose',
  'van-hanh': 'amber',
  'nhan-su': 'violet',
  'tuyen-dung': 'violet',
  'ke-toan': 'emerald',
};

const NEWS_CATEGORY_COLORS: Readonly<Record<string, CategoryColor>> = {
  'cam-nang-ung-vien': 'violet',
  'doi-song-top-flow': 'rose',
  'kien-thuc-nganh-nuoc': 'teal',
  'tin-tuyen-dung': 'blue',
};

/** FNV-1a (32-bit): the same text gives the same number in every browser and on every visit. */
function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Any name or slug → one of the six colours, by hash only. */
export function hashColor(nameOrSlug: string): CategoryColor {
  const key = toSlug(nameOrSlug, '');
  return CATEGORY_COLORS[stableHash(key) % CATEGORY_COLORS.length] ?? 'blue';
}

const pick = (overrides: Readonly<Record<string, CategoryColor>>, nameOrSlug: string): CategoryColor =>
  overrides[toSlug(nameOrSlug, '')] ?? hashColor(nameOrSlug);

/** A job department ("Kinh doanh") → its colour. */
export const departmentColor = (department: string): CategoryColor => pick(DEPARTMENT_COLORS, department);

/** A news category, by slug ("cam-nang-ung-vien") or name ("Cẩm nang ứng viên") → its colour. */
export const newsCategoryColor = (slugOrName: string): CategoryColor => pick(NEWS_CATEGORY_COLORS, slugOrName);

/** Tailwind classes for one colour, written out in full so Tailwind finds them in the source. */
export interface ColorClasses {
  /** Solid text on white or on the soft tint (≥ 4.5:1). */
  text: string;
  /** Text on the navy hero (≥ 4.5:1). */
  textOnDark: string;
  /** Solid fill: 3px bars, dots, the reading progress bar. */
  fill: string;
  soft: string;
  line: string;
  /** Solid border (the active chip). */
  border: string;
  hoverLine: string;
  /** Sets --cat for the cat-bar / cat-bar-row card bars (styles.css). */
  bar: string;
}

export const COLOR_CLASSES: Readonly<Record<CategoryColor, ColorClasses>> = {
  blue: {
    text: 'text-cat-blue',
    textOnDark: 'text-cat-blue-bright',
    fill: 'bg-cat-blue',
    soft: 'bg-cat-blue-soft',
    line: 'border-cat-blue-line',
    border: 'border-cat-blue',
    hoverLine: 'hover:border-cat-blue-line',
    bar: '[--cat:var(--color-cat-blue)]',
  },
  teal: {
    text: 'text-cat-teal',
    textOnDark: 'text-cat-teal-bright',
    fill: 'bg-cat-teal',
    soft: 'bg-cat-teal-soft',
    line: 'border-cat-teal-line',
    border: 'border-cat-teal',
    hoverLine: 'hover:border-cat-teal-line',
    bar: '[--cat:var(--color-cat-teal)]',
  },
  amber: {
    text: 'text-cat-amber',
    textOnDark: 'text-cat-amber-bright',
    fill: 'bg-cat-amber',
    soft: 'bg-cat-amber-soft',
    line: 'border-cat-amber-line',
    border: 'border-cat-amber',
    hoverLine: 'hover:border-cat-amber-line',
    bar: '[--cat:var(--color-cat-amber)]',
  },
  rose: {
    text: 'text-cat-rose',
    textOnDark: 'text-cat-rose-bright',
    fill: 'bg-cat-rose',
    soft: 'bg-cat-rose-soft',
    line: 'border-cat-rose-line',
    border: 'border-cat-rose',
    hoverLine: 'hover:border-cat-rose-line',
    bar: '[--cat:var(--color-cat-rose)]',
  },
  violet: {
    text: 'text-cat-violet',
    textOnDark: 'text-cat-violet-bright',
    fill: 'bg-cat-violet',
    soft: 'bg-cat-violet-soft',
    line: 'border-cat-violet-line',
    border: 'border-cat-violet',
    hoverLine: 'hover:border-cat-violet-line',
    bar: '[--cat:var(--color-cat-violet)]',
  },
  emerald: {
    text: 'text-cat-emerald',
    textOnDark: 'text-cat-emerald-bright',
    fill: 'bg-cat-emerald',
    soft: 'bg-cat-emerald-soft',
    line: 'border-cat-emerald-line',
    border: 'border-cat-emerald',
    hoverLine: 'hover:border-cat-emerald-line',
    bar: '[--cat:var(--color-cat-emerald)]',
  },
};

export const departmentClasses = (department: string): ColorClasses => COLOR_CLASSES[departmentColor(department)];
export const newsCategoryClasses = (slugOrName: string): ColorClasses => COLOR_CLASSES[newsCategoryColor(slugOrName)];
