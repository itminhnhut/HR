import {
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZES,
  HIGHLIGHT_COLORS,
  LAYOUT_COLUMNS,
  MAX_INDENT,
  NEWS_IMAGE_MAX_BYTES,
  NEWS_IMAGE_TYPES,
  safeLinkUrl,
  TEXT_COLORS,
  TEXT_FORMAT,
  type PaletteColor,
} from '@careers/shared';

/**
 * What the article editor may keep, as plain functions (no Lexical import): the node transforms apply them,
 * tests check them. Mirrors parseArticleContent in @careers/shared, which the API enforces.
 */

/** Bold, italic, strikethrough, underline, inline code, sub/superscript and letter case. Highlight goes. */
export const ALLOWED_TEXT_FORMAT = Object.values(TEXT_FORMAT).reduce((all, bit) => all | bit, 0);

export const allowedFormat = (format: number): number => format & ALLOWED_TEXT_FORMAT;

/** The page title is the only H1: pasted h1 becomes H2, h5–h6 become H4 (the deepest level in the contents). */
export function headingTagFor(tag: string): 'h2' | 'h3' | 'h4' {
  if (tag === 'h1' || tag === 'h2') return 'h2';
  return tag === 'h3' ? 'h3' : 'h4';
}

export const isSafeLink = (url: string): boolean => safeLinkUrl(url) !== null;

/** The palette's own spelling of a colour ("#B91C1C" → "#b91c1c"), or undefined when it is not in the palette. */
export const inPalette = (palette: readonly PaletteColor[], value: string) =>
  palette.find((c) => c.hex.toLowerCase() === value.trim().toLowerCase())?.hex;

/** Colours the editor offers: the whole schema palette (6 text colours, 4 highlights). */
export const OFFERED_TEXT_COLORS: readonly PaletteColor[] = TEXT_COLORS;
export const OFFERED_HIGHLIGHTS: readonly PaletteColor[] = HIGHLIGHT_COLORS;

const SIZE_PRESETS = FONT_SIZES.map((s) => s.px);
const PX_PER_UNIT: Record<string, number> = { px: 1, pt: 4 / 3, em: 16, rem: 16 };

/** A size in px from "18px", "13.5pt", "1.25em"…; null when it is not a plain length. */
export function sizeInPx(value: string): number | null {
  const match = /^([\d.]+)\s*(px|pt|em|rem)$/.exec(value.trim().toLowerCase());
  const unit = match?.[2];
  if (!match || !unit) return null;
  const px = Number(match[1]) * (PX_PER_UNIT[unit] ?? 0);
  return Number.isFinite(px) && px > 0 ? px : null;
}

/** The nearest preset (14, 16, 18, 20, 24) to a size in px. */
export function nearestFontSize(px: number): number {
  return SIZE_PRESETS.reduce(
    (best, size) => (Math.abs(size - px) < Math.abs(best - px) ? size : best),
    DEFAULT_FONT_SIZE,
  );
}

/** The preset for a pasted size, or null for the normal size (stored as nothing) or an unreadable one. */
export function fontSizeFor(value: string): number | null {
  const px = sizeInPx(value);
  const size = px === null ? DEFAULT_FONT_SIZE : nearestFontSize(px);
  return size === DEFAULT_FONT_SIZE ? null : size;
}

const sameFont = (a: string, b: string) => {
  const norm = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/\s*,\s*/g, ',');
  return norm(a) === norm(b);
};

/** The site's serif font, written exactly as the schema expects; any other font (Arial, Calibri…) is dropped. */
export function fontFamilyFor(value: string): string | null {
  const family = FONT_FAMILIES.find((f) => f.key !== 'default' && sameFont(f.css, value));
  return family?.css ?? null;
}

interface CleanStyle {
  color?: string;
  highlight?: string;
  size?: number | null;
  family?: string | null;
}

function readDeclaration(name: string, value: string, into: CleanStyle) {
  if (name === 'color') into.color = inPalette(TEXT_COLORS, value) ?? into.color;
  if (name === 'background-color') into.highlight = inPalette(HIGHLIGHT_COLORS, value) ?? into.highlight;
  if (name === 'font-size') into.size = fontSizeFor(value);
  if (name === 'font-family') into.family = fontFamilyFor(value);
}

/**
 * Keeps from a Lexical text style only what the site renders, in Lexical's own format: a palette colour and
 * highlight, a preset size (pasted sizes snap to the nearest one) and the serif font
 * ("color: #b91c1c;font-size: 18px;"). Other colours and fonts from Word or Docs are dropped.
 */
export function cleanTextStyle(style: string): string {
  const kept: CleanStyle = {};
  for (const declaration of style.split(';')) {
    const [prop = '', ...rest] = declaration.split(':');
    readDeclaration(prop.trim().toLowerCase(), rest.join(':'), kept);
  }
  return [
    kept.color && `color: ${kept.color};`,
    kept.highlight && `background-color: ${kept.highlight};`,
    kept.size && `font-size: ${kept.size}px;`,
    kept.family && `font-family: ${kept.family};`,
  ]
    .filter(Boolean)
    .join('');
}

/** A table cell colour from the highlight palette, or none. */
export const cellBackground = (color: string | null): string | null =>
  color ? (inPalette(HIGHLIGHT_COLORS, color) ?? null) : null;

export type Align = '' | 'left' | 'center' | 'right' | 'justify';

/** Alignment the site renders; "start"/"end" from pasted text become left/right. */
export function alignFor(format: string): Align {
  if (format === 'end') return 'right';
  if (format === 'start') return '';
  return format === 'left' || format === 'center' || format === 'right' || format === 'justify' ? format : '';
}

/** Bulleted, numbered and checklists; anything else becomes a bulleted list. */
export function listTypeFor(listType: string): 'bullet' | 'number' | 'check' {
  return listType === 'number' || listType === 'check' ? listType : 'bullet';
}

/** Indentation the site shows: whole steps from 0 to MAX_INDENT (4). */
export const indentFor = (indent: number): number => Math.min(MAX_INDENT, Math.max(0, Math.floor(indent)));

/** Column layouts in the "Bố cục cột" picker, in the playground's order. */
export const LAYOUT_CHOICES: { template: string; label: string }[] = [
  { template: '1fr 1fr', label: '2 cột bằng nhau' },
  { template: '1fr 3fr', label: '2 cột 25% – 75%' },
  { template: '3fr 1fr', label: '2 cột 75% – 25%' },
  { template: '1fr 1fr 1fr', label: '3 cột bằng nhau' },
  { template: '1fr 2fr 1fr', label: '3 cột 25% – 50% – 25%' },
  { template: '1fr 1fr 1fr 1fr', label: '4 cột bằng nhau' },
];

export const columnCount = (template: string): number => template.trim().split(/\s+/).filter(Boolean).length;

/**
 * The layout to keep for `columns` columns: the template itself when the site offers it with that many
 * columns, else equal columns; null (unwrap the columns) for 1 column or more than 4.
 */
export function layoutTemplateFor(template: string, columns: number): string | null {
  if (template in LAYOUT_COLUMNS && columnCount(template) === columns) return template;
  const equal = Array.from({ length: columns }, () => '1fr').join(' ');
  return columns >= 2 && equal in LAYOUT_COLUMNS ? equal : null;
}

/**
 * What HR typed in the link box → a safe address, or null. "topflow.vn/lien-he" gets https:// in front;
 * site paths ("/viec-lam/…"), mailto: and tel: stay; javascript:, data: and the like are refused.
 */
export function normalizeLinkInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  const looksLikeDomain = /^[^\s/]+\.[^\s/]+/.test(value);
  const candidate = !hasScheme && !value.startsWith('/') && looksLikeDomain ? `https://${value}` : value;
  return safeLinkUrl(candidate);
}

const MAX_MB = NEWS_IMAGE_MAX_BYTES / 1024 / 1024;

/**
 * Checked before uploading (after shrinking), so HR hears about a wrong file at once; the API checks again.
 * `name`: the file HR picked (shrinking renames it).
 */
export function imageFileProblem(file: File, name = file.name): string | null {
  if (!(NEWS_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.';
  if (file.size > NEWS_IMAGE_MAX_BYTES) return `Ảnh "${name}" vẫn lớn hơn ${MAX_MB} MB, nén lại rồi tải lên.`;
  return null;
}
