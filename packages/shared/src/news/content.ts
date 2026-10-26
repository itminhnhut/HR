import { z } from 'zod';
import { ARTICLE_IMAGE_TYPE, type ArticleRoot, type ArticleState } from './content-types.js';
import { srcsetSchema } from './images.js';
import { highlightKey, parseTextStyle } from './palette.js';
import { safeLinkUrl } from './text.js';

export * from './content-types.js';

/**
 * The article body as the Lexical editor saves it (`editorState.toJSON()`), limited to what the site renders.
 * The API accepts nothing else: no HTML from the browser, no free CSS, no unknown nodes
 * (docs/adr/2026-10-26-tech-lexical-tin-tuc.md). Extra Lexical bookkeeping fields (version, direction…) are kept
 * so the editor can reload the state, but never rendered.
 */

/**
 * Lexical's text format bitmask. Allowed: bold, italic, strikethrough, underline, inline code, sub/superscript
 * and letter case. Refused: highlight (128; colours come from the palette instead).
 */
export const TEXT_FORMAT = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16,
  subscript: 32,
  superscript: 64,
  lowercase: 256,
  uppercase: 512,
  capitalize: 1024,
} as const;
const ALLOWED_FORMAT = Object.values(TEXT_FORMAT).reduce((all, bit) => all | bit, 0);

/** Column layouts offered in the editor (Lexical playground's set), as stored in `templateColumns`. */
export const LAYOUT_COLUMNS: Record<string, string> = {
  '1fr 1fr': 'cols-1-1',
  '1fr 3fr': 'cols-1-3',
  '3fr 1fr': 'cols-3-1',
  '1fr 1fr 1fr': 'cols-1-1-1',
  '1fr 2fr 1fr': 'cols-1-2-1',
  '1fr 1fr 1fr 1fr': 'cols-1-1-1-1',
};
export const MAX_INDENT = 4;

export const ARTICLE_ALT_MAX = 200;
export const ARTICLE_CAPTION_MAX = 300;
export const ARTICLE_CTA_MAX = 60;
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_DEPTH = 12;
const MAX_NODES = 5000;
const TEXT_MAX = 10_000;
const MAX_SPAN = 20;

const children = { children: z.array(z.unknown()) };
const align = z.enum(['', 'left', 'start', 'center', 'right', 'end', 'justify'], 'Căn lề không hợp lệ.').optional();
const safeUrl = z.string().refine((u) => safeLinkUrl(u) !== null, 'Link không hợp lệ.');
const span = z.number().int().min(1).max(MAX_SPAN).optional();
const indent = z.number().int().min(0).max(MAX_INDENT, `Thụt lề tối đa ${MAX_INDENT} bậc.`).optional();
const textFormat = z
  .number()
  .int()
  .refine((f) => f >= 0 && (f & ~ALLOWED_FORMAT) === 0, 'Định dạng chữ không được hỗ trợ.');

const SHAPES = {
  text: z.looseObject({
    type: z.literal('text'),
    text: z.string().max(TEXT_MAX),
    format: textFormat,
    style: z
      .string()
      .refine((s) => parseTextStyle(s) !== null, 'Chỉ dùng màu, cỡ chữ và font có sẵn.')
      .optional(),
  }),
  linebreak: z.looseObject({ type: z.literal('linebreak') }),
  tab: z.looseObject({ type: z.literal('tab') }),
  link: z.looseObject({ type: z.enum(['link', 'autolink']), url: safeUrl, ...children }),
  paragraph: z.looseObject({ type: z.enum(['paragraph', 'quote']), format: align, indent, ...children }),
  heading: z.looseObject({
    type: z.literal('heading'),
    tag: z.enum(['h2', 'h3', 'h4'], 'Chỉ dùng tiêu đề H2, H3 hoặc H4.'),
    format: align,
    indent,
    ...children,
  }),
  list: z.looseObject({
    type: z.literal('list'),
    listType: z.enum(['bullet', 'number', 'check']),
    start: z.number().int().min(1).default(1),
    ...children,
  }),
  listitem: z.looseObject({ type: z.literal('listitem'), checked: z.boolean().optional(), ...children }),
  toc: z.looseObject({ type: z.literal('toc') }),
  'collapsible-container': z.looseObject({ type: z.literal('collapsible-container'), ...children }),
  'collapsible-title': z.looseObject({ type: z.literal('collapsible-title'), ...children }),
  'collapsible-content': z.looseObject({ type: z.literal('collapsible-content'), ...children }),
  'layout-container': z.looseObject({
    type: z.literal('layout-container'),
    templateColumns: z.string().refine((t) => t in LAYOUT_COLUMNS, 'Bố cục cột không hợp lệ.'),
    ...children,
  }),
  'layout-item': z.looseObject({ type: z.literal('layout-item'), ...children }),
  code: z.looseObject({ type: z.literal('code'), ...children }),
  'code-highlight': z.looseObject({ type: z.literal('code-highlight'), text: z.string().max(TEXT_MAX) }),
  horizontalrule: z.looseObject({ type: z.literal('horizontalrule') }),
  youtube: z.looseObject({
    type: z.literal('youtube'),
    videoID: z.string().regex(YOUTUBE_ID, 'Link YouTube không hợp lệ.'),
  }),
  cta: z.looseObject({
    type: z.literal('cta'),
    text: z.string().trim().min(1, 'Nút cần chữ.').max(ARTICLE_CTA_MAX),
    url: safeUrl,
  }),
  table: z.looseObject({ type: z.literal('table'), ...children }),
  tablerow: z.looseObject({ type: z.literal('tablerow'), ...children }),
  tablecell: z.looseObject({
    type: z.literal('tablecell'),
    headerState: z.number().int().min(0).max(3).default(0),
    colSpan: span,
    rowSpan: span,
    backgroundColor: z
      .string()
      .nullable()
      .optional()
      .refine((c) => !c || highlightKey(c) !== undefined, 'Chỉ dùng màu nền có sẵn.'),
    ...children,
  }),
  root: z.looseObject({ type: z.literal('root'), ...children }),
} as const;

const imageShape = (isAllowedImage: (url: string) => boolean) =>
  z.looseObject({
    type: z.literal(ARTICLE_IMAGE_TYPE),
    src: z.string().refine(isAllowedImage, 'Ảnh phải được tải lên từ trình soạn bài.'),
    altText: z.string().trim().min(1, 'Ảnh cần mô tả (alt).').max(ARTICLE_ALT_MAX),
    width: z.number().int().min(1).max(10_000),
    height: z.number().int().min(1).max(10_000),
    caption: z.string().max(ARTICLE_CAPTION_MAX).optional(),
    layout: z.enum(['normal', 'wide']).optional(),
    srcset: srcsetSchema(isAllowedImage),
  });

/** Which node types may sit inside which: keeps the page structure valid (no heading inside a paragraph…). */
const INLINE = ['text', 'linebreak', 'tab', 'link', 'autolink'];
/** What a column or a FAQ answer may hold: content blocks, but no nested columns, FAQ, table or contents. */
const INNER_BLOCKS = [
  'paragraph',
  'quote',
  'heading',
  'list',
  ARTICLE_IMAGE_TYPE,
  'youtube',
  'cta',
  'code',
  'horizontalrule',
];
const ALLOWED_CHILDREN: Record<string, string[]> = {
  document: ['root'],
  root: [...INNER_BLOCKS, 'table', 'toc', 'collapsible-container', 'layout-container'],
  'collapsible-container': ['collapsible-title', 'collapsible-content'],
  'collapsible-title': INLINE,
  'collapsible-content': INNER_BLOCKS,
  'layout-container': ['layout-item'],
  'layout-item': INNER_BLOCKS,
  code: ['text', 'code-highlight', 'linebreak', 'tab'],
  paragraph: INLINE,
  quote: INLINE,
  heading: INLINE,
  link: ['text', 'linebreak', 'tab'],
  autolink: ['text', 'linebreak', 'tab'],
  list: ['listitem'],
  listitem: [...INLINE, 'list'],
  table: ['tablerow'],
  tablerow: ['tablecell'],
  tablecell: ['paragraph', 'list'],
};

const SHAPE_OF: Record<string, keyof typeof SHAPES> = {
  autolink: 'link',
  quote: 'paragraph',
};

export type ContentResult = { ok: true; value: ArticleState } | { ok: false; error: string };

class ContentError extends Error {}

interface Walk {
  isAllowedImage: (url: string) => boolean;
  count: number;
}

function shapeFor(type: string, walk: Walk) {
  if (type === ARTICLE_IMAGE_TYPE) return imageShape(walk.isAllowedImage);
  const key = SHAPE_OF[type] ?? type;
  return key in SHAPES ? SHAPES[key as keyof typeof SHAPES] : null;
}

/** A FAQ is exactly a question then its answer. */
function checkFaqParts(parts: unknown[]) {
  const types = parts.map((c) => (c as { type?: unknown } | null)?.type);
  if (types.length !== 2 || types[0] !== 'collapsible-title' || types[1] !== 'collapsible-content') {
    throw new ContentError('Khối hỏi đáp cần có câu hỏi rồi đến câu trả lời.');
  }
}

function checkNode(raw: unknown, parent: string, depth: number, walk: Walk): unknown {
  if (depth > MAX_DEPTH) throw new ContentError('Nội dung lồng nhau quá sâu.');
  walk.count += 1;
  if (walk.count > MAX_NODES) throw new ContentError('Bài viết quá dài.');
  const type = (raw as { type?: unknown } | null)?.type;
  const shape = typeof type === 'string' ? shapeFor(type, walk) : null;
  if (typeof type !== 'string' || !shape || !ALLOWED_CHILDREN[parent]?.includes(type)) {
    throw new ContentError(`Không dùng được "${String(type)}" ở đây.`);
  }
  const parsed = shape.safeParse(raw);
  if (!parsed.success) throw new ContentError(parsed.error.issues[0]?.message ?? 'Nội dung không hợp lệ.');
  const node = parsed.data as { children?: unknown[] };
  if (!node.children) return node;
  if (type === 'collapsible-container') checkFaqParts(node.children);
  return { ...node, children: node.children.map((child) => checkNode(child, type, depth + 1, walk)) };
}

/**
 * Validates an article body from the browser (the API's only way in). `isAllowedImage` says which image
 * addresses are ours (the public Blob store), so pasted hotlinks and tracking pixels never get stored.
 */
export function parseArticleContent(input: unknown, opts: { isAllowedImage: (url: string) => boolean }): ContentResult {
  const root = (input as { root?: unknown } | null)?.root;
  if (typeof input !== 'object' || input === null || typeof root !== 'object' || root === null) {
    return { ok: false, error: 'Nội dung bài viết không hợp lệ.' };
  }
  try {
    const walk: Walk = { isAllowedImage: opts.isAllowedImage, count: 0 };
    const checked = checkNode(root, 'document', 0, walk);
    return { ok: true, value: { root: checked as ArticleRoot } };
  } catch (error) {
    if (error instanceof ContentError) return { ok: false, error: error.message };
    throw error;
  }
}
