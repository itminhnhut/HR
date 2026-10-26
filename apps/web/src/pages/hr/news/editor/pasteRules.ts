import { DEFAULT_FONT_SIZE, FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS } from '@careers/shared';
import { fontFamilyFor, inPalette, sizeInPx } from './rules';

/**
 * Pure rules for pasted content (no Lexical import): which inline styles survive a paste, where an over-long
 * text is cut, and how Google Docs' flat lists become nested ones. The paste rules (paste.ts) and the node
 * transforms apply them.
 */

/** Longest text the API accepts in one text node (TEXT_MAX in @careers/shared content.ts). */
export const TEXT_MAX = 10_000;

/** "rgb(185, 28, 28)" → "#b91c1c"; anything else unchanged (browsers rewrite pasted colours this way). */
function hexColor(value: string): string {
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*1\s*)?\)$/i.exec(value.trim());
  if (!rgb) return value.trim();
  return `#${rgb
    .slice(1, 4)
    .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** A pasted size only when it is exactly one of the presets (other than the normal size). */
function exactPresetSize(value: string): number | null {
  const px = sizeInPx(value);
  if (px === null) return null;
  const preset = FONT_SIZES.find((s) => Math.abs(s.px - px) < 0.05)?.px;
  return preset && preset !== DEFAULT_FONT_SIZE ? preset : null;
}

type Declarations = Map<string, string>;

function readDeclarations(style: string): Declarations {
  const out: Declarations = new Map();
  for (const declaration of style.split(';')) {
    const [prop = '', ...rest] = declaration.split(':');
    const name = prop.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (name && value) out.set(name, value);
  }
  return out;
}

const ORDER = ['color', 'background-color', 'font-size', 'font-family'];

function writeDeclarations(declarations: Declarations): string {
  return ORDER.filter((name) => declarations.has(name))
    .map((name) => `${name}: ${declarations.get(name)};`)
    .join('');
}

/**
 * The part of a pasted inline style the site can show: a palette colour or highlight, a size that is exactly
 * a preset (so Word's 11pt and Docs' 14.67px body text stay normal), the serif font. Lexical's own format.
 */
export function pastedTextStyle(style: string): string {
  const read = readDeclarations(style);
  const kept: Declarations = new Map();
  const color = inPalette(TEXT_COLORS, hexColor(read.get('color') ?? ''));
  const highlight = inPalette(HIGHLIGHT_COLORS, hexColor(read.get('background-color') ?? ''));
  const size = exactPresetSize(read.get('font-size') ?? '');
  const family = fontFamilyFor(read.get('font-family') ?? '');
  if (color) kept.set('color', color);
  if (highlight) kept.set('background-color', highlight);
  if (size) kept.set('font-size', `${size}px`);
  if (family) kept.set('font-family', family);
  return writeDeclarations(kept);
}

/** `outer` (a span around) under `inner` (the text's own style): the inner value wins for each property. */
export function mergeTextStyles(inner: string, outer: string): string {
  const merged = readDeclarations(outer);
  for (const [name, value] of readDeclarations(inner)) merged.set(name, value);
  return writeDeclarations(merged);
}

/**
 * Where to cut a text longer than `max`: after the last sentence in the second half, else after the last
 * space there, else at `max`. A text within the limit is not cut (its length is returned).
 */
export function splitPointFor(text: string, max = TEXT_MAX): number {
  if (text.length <= max) return text.length;
  const head = text.slice(0, max);
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentence > max / 2) return sentence + 2;
  const space = head.lastIndexOf(' ');
  return space > max / 2 ? space + 1 : max;
}

const levelOf = (item: Element): number => Math.max(1, Math.floor(Number(item.getAttribute('aria-level')) || 1));

/** Rebuilds one flat Docs list: each deeper level goes in its own item holding a sub-list (Lexical's shape). */
function nestList(list: Element, items: Element[]) {
  const doc = list.ownerDocument;
  const base = Math.min(...items.map(levelOf));
  const stack: { level: number; list: Element }[] = [{ level: base, list }];
  for (const item of items) {
    const level = levelOf(item);
    while (stack.length > 1 && (stack.at(-1)?.level ?? base) > level) stack.pop();
    for (let top = stack.at(-1); top && level > top.level; top = stack.at(-1)) {
      const sub = doc.createElement(list.tagName.toLowerCase());
      top.list.append(doc.createElement('li'));
      top.list.lastElementChild?.append(sub);
      stack.push({ level: top.level + 1, list: sub });
    }
    stack.at(-1)?.list.append(item);
  }
}

/** Google Docs pastes nested lists flat, with aria-level on each item: nest them again. */
export function nestListsByAriaLevel(dom: ParentNode): void {
  for (const list of Array.from(dom.querySelectorAll('ul, ol'))) {
    const items = Array.from(list.children).filter((child) => child.tagName === 'LI');
    if (items.some((item) => levelOf(item) > 1)) nestList(list, items);
  }
}
