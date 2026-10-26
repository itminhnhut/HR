/**
 * The only colours an article may use (text colour, highlight, table cell). The editor offers these; the
 * page renders them as classes (tc-<key>, hl-<key>), never as inline CSS, so the site's design stays intact.
 */
export interface PaletteColor {
  key: string;
  label: string;
  hex: string;
}

export const TEXT_COLORS: readonly PaletteColor[] = [
  { key: 'red', label: 'Đỏ', hex: '#b91c1c' },
  { key: 'orange', label: 'Cam', hex: '#c2410c' },
  { key: 'green', label: 'Xanh lá', hex: '#15803d' },
  { key: 'blue', label: 'Xanh dương', hex: '#1d4ed8' },
  { key: 'navy', label: 'Xanh đậm', hex: '#0b1f3a' },
  { key: 'gray', label: 'Xám', hex: '#64748b' },
];

export const HIGHLIGHT_COLORS: readonly PaletteColor[] = [
  { key: 'yellow', label: 'Vàng', hex: '#fef08a' },
  { key: 'green', label: 'Xanh lá nhạt', hex: '#bbf7d0' },
  { key: 'blue', label: 'Xanh dương nhạt', hex: '#bfdbfe' },
  { key: 'pink', label: 'Hồng', hex: '#fbcfe8' },
];

const byHex = (palette: readonly PaletteColor[], hex: string) =>
  palette.find((c) => c.hex.toLowerCase() === hex.trim().toLowerCase());

export const highlightKey = (hex: string | null | undefined) => (hex ? byHex(HIGHLIGHT_COLORS, hex)?.key : undefined);

/**
 * Text sizes HR may pick (the toolbar's − 16 + steps through them). 16px is the article's normal size and is
 * stored as "no size". Rendered as fs-<key> classes.
 */
export const FONT_SIZES: readonly { key: string; px: number }[] = [
  { key: '14', px: 14 },
  { key: '16', px: 16 },
  { key: '18', px: 18 },
  { key: '20', px: 20 },
  { key: '24', px: 24 },
];
export const DEFAULT_FONT_SIZE = 16;

/** Fonts HR may pick: the site's own two. "default" is stored as no font. Rendered as ff-<key> classes. */
export const FONT_FAMILIES: readonly { key: string; label: string; css: string }[] = [
  { key: 'default', label: 'Mặc định', css: 'Be Vietnam Pro, sans-serif' },
  { key: 'serif', label: 'Có chân (tiêu đề)', css: 'Playfair Display, serif' },
];

export interface TextStyle {
  color?: string;
  highlight?: string;
  /** FONT_SIZES key; absent for the normal size. */
  size?: string;
  /** FONT_FAMILIES key; absent for the default font. */
  family?: string;
}

const norm = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s*,\s*/g, ',');

/** Applies one "name: value" declaration; false when it is not allowed. */
function readDeclaration(name: string, value: string, result: TextStyle): boolean {
  if (name === 'color') {
    const color = byHex(TEXT_COLORS, value);
    if (color) result.color = color.key;
    return !!color;
  }
  if (name === 'background-color') {
    const highlight = byHex(HIGHLIGHT_COLORS, value);
    if (highlight) result.highlight = highlight.key;
    return !!highlight;
  }
  if (name === 'font-size') {
    const size = FONT_SIZES.find((s) => `${s.px}px` === value.trim().toLowerCase());
    if (size && size.px !== DEFAULT_FONT_SIZE) result.size = size.key;
    return !!size;
  }
  if (name === 'font-family') {
    const family = FONT_FAMILIES.find((f) => norm(f.css) === norm(value));
    if (family && family.key !== 'default') result.family = family.key;
    return !!family;
  }
  return false;
}

/**
 * Reads a Lexical text style ("color: #b91c1c; font-size: 20px;") into palette and preset keys.
 * Returns null when it holds anything else: another property, a value outside the presets, url()…
 */
export function parseTextStyle(style: string): TextStyle | null {
  const result: TextStyle = {};
  for (const declaration of style.split(';')) {
    if (!declaration.trim()) continue;
    const [prop = '', ...rest] = declaration.split(':');
    if (!readDeclaration(prop.trim().toLowerCase(), rest.join(':'), result)) return null;
  }
  return result;
}
