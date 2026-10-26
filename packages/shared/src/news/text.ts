import { foldVietnamese } from '../format.js';

/** "Đời sống ở TOP FLOW" → "doi-song-o-top-flow": lowercase, no accents, at most 80 characters. */
export function toSlug(text: string, fallback = 'bai-viet'): string {
  const slug = foldVietnamese(text)
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

/** Collapses runs of spaces and line breaks into one space. */
export const squashSpaces = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Cuts at a word boundary to at most `max` characters (ellipsis included), for meta descriptions. */
export function cutDescription(text: string, max = 155): string {
  const clean = squashSpaces(text);
  if (clean.length <= max) return clean;
  const room = clean.slice(0, max - 1);
  const lastSpace = room.lastIndexOf(' ');
  return `${(lastSpace > max / 2 ? room.slice(0, lastSpace) : room).replace(/[\s,.;:–-]+$/, '')}…`;
}

/**
 * A link target HR may use in an article: absolute http(s), mailto or tel, or a path on this site.
 * Returns the normalised address, or null for anything else (javascript:, data:, control characters…).
 */
export function safeLinkUrl(raw: string): string | null {
  // Tabs and other control characters are how "java\tscript:" slips past naive checks.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  const url = raw.trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
