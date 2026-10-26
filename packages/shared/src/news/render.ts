import {
  LAYOUT_COLUMNS,
  TEXT_FORMAT,
  type ArticleAlign,
  type ArticleCode,
  type ArticleCollapsible,
  type ArticleLayout,
  type ArticleBlock,
  type ArticleImage,
  type ArticleInline,
  type ArticleList,
  type ArticleListItem,
  type ArticleState,
  type ArticleTable,
  type ArticleTableCell,
  type ArticleText,
} from './content.js';
import { srcsetAttr } from './images.js';
import { highlightKey, parseTextStyle } from './palette.js';
import { safeLinkUrl, squashSpaces, toSlug } from './text.js';

/**
 * Article JSON (already checked by parseArticleContent) → HTML, without a DOM or Lexical, so the API's
 * pages for crawlers and the public article page show exactly the same thing. Every text and attribute is
 * escaped and links are checked again here: a second line of defence after the schema. Colours and
 * alignment come out as classes (tc-*, hl-*, text-*), which the public stylesheet defines.
 */

export interface ArticleHeadingRef {
  id: string;
  text: string;
  level: 2 | 3 | 4;
}

export interface RenderedArticle {
  html: string;
  /** H2/H3 in order, for the table of contents. */
  headings: ArticleHeadingRef[];
  /** All words, one space apart: for the meta description and reading time. */
  plainText: string;
  /** HR placed a "Mục lục" block in the text: the page then shows no separate table of contents. */
  hasToc: boolean;
}

const HEADING_LEVEL = { h2: 2, h3: 3, h4: 4 } as const;

export interface NumberedHeading extends ArticleHeadingRef {
  /** "1", "1.2", "1.2.1". */
  number: string;
  /** 0 for a section, 1 for a sub-section, 2 below that. */
  depth: number;
  /** The heading without a number HR typed at its start ("1. Lương" → "Lương"), shown after `number`. */
  label: string;
}

/** "1. Lương", "2.3) Lịch" → the text after HR's own numbering; the text itself when there is none. */
// Only "1." / "2)" / "1.1" count as numbering: "5 điều cần nhớ" keeps its 5.
const withoutTypedNumber = (text: string) => text.replace(/^\s*(?:\d+(?:\.\d+)+[.)]?|\d+[.)])\s+(?=\S)/, '');

/**
 * Numbers the table of contents by heading level: H2 → 1, H3 → 1.1, H4 → 1.1.1. Depth comes from the headings
 * actually above, so a sub-heading with no parent counts as a section (never "0.1").
 */
export function numberHeadings(headings: ArticleHeadingRef[]): NumberedHeading[] {
  const open: number[] = [];
  const counters: number[] = [];
  return headings.map((h) => {
    while (open.length > 0 && (open[open.length - 1] ?? 0) >= h.level) open.pop();
    const depth = open.length;
    open.push(h.level);
    counters.length = depth + 1;
    counters[depth] = (counters[depth] ?? 0) + 1;
    return { ...h, number: counters.join('.'), depth, label: withoutTypedNumber(h.text) };
  });
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);

interface Context {
  headings: ArticleHeadingRef[];
  usedIds: Set<string>;
  /** Every heading of the post, known before rendering so a "Mục lục" block can list later headings too. */
  allHeadings: ArticleHeadingRef[];
}

const FORMAT_TAGS: [number, string][] = [
  [TEXT_FORMAT.code, 'code'],
  [TEXT_FORMAT.subscript, 'sub'],
  [TEXT_FORMAT.superscript, 'sup'],
  [TEXT_FORMAT.strikethrough, 's'],
  [TEXT_FORMAT.underline, 'u'],
  [TEXT_FORMAT.italic, 'em'],
  [TEXT_FORMAT.bold, 'strong'],
];

function renderText(node: ArticleText): string {
  let html = escapeHtml(node.text);
  for (const [bit, tag] of FORMAT_TAGS) if (node.format & bit) html = `<${tag}>${html}</${tag}>`;
  const style = node.style ? parseTextStyle(node.style) : null;
  const letterCase =
    node.format & TEXT_FORMAT.uppercase
      ? 'tt-upper'
      : node.format & TEXT_FORMAT.lowercase
        ? 'tt-lower'
        : node.format & TEXT_FORMAT.capitalize
          ? 'tt-cap'
          : '';
  const classes = [
    letterCase,
    style?.size && `fs-${style.size}`,
    style?.family && `ff-${style.family}`,
    style?.color && `tc-${style.color}`,
    style?.highlight && `hl-${style.highlight}`,
  ].filter(Boolean);
  return classes.length ? `<span class="${classes.join(' ')}">${html}</span>` : html;
}

function renderInline(node: ArticleInline): string {
  switch (node.type) {
    case 'text':
      return renderText(node);
    case 'linebreak':
      return '<br>';
    case 'tab':
      return ' ';
    case 'link':
    case 'autolink': {
      const inner = node.children.map(renderInline).join('');
      const href = safeLinkUrl(node.url);
      return href ? `<a href="${escapeHtml(href)}" rel="noopener">${inner}</a>` : inner;
    }
  }
}

function inlineText(nodes: ArticleInline[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text') return n.text;
      if (n.type === 'link' || n.type === 'autolink') return inlineText(n.children);
      return ' ';
    })
    .join('');
}

/** ' class="text-center indent-2"': alignment (centre/right/justify) and indentation; nothing by default. */
function blockClass(format: ArticleAlign | undefined, indent = 0): string {
  const map: Partial<Record<ArticleAlign, string>> = {
    center: 'center',
    right: 'right',
    end: 'right',
    justify: 'justify',
  };
  const align = format ? map[format] : undefined;
  const classes = [align && `text-${align}`, indent > 0 && `indent-${indent}`].filter(Boolean);
  return classes.length ? ` class="${classes.join(' ')}"` : '';
}

/** Unique, accent-free id for a heading ("Quyền lợi" → "quyen-loi", then "quyen-loi-2"). */
function headingId(text: string, ctx: Context): string {
  const base = toSlug(text, 'muc');
  let id = base;
  for (let i = 2; ctx.usedIds.has(id); i++) id = `${base}-${i}`;
  ctx.usedIds.add(id);
  return id;
}

function renderListItem(item: ArticleListItem, checklist: boolean): string {
  const inner = item.children.map((c) => (c.type === 'list' ? renderList(c) : renderInline(c))).join('');
  if (!checklist) return `<li>${inner}</li>`;
  return item.checked
    ? `<li class="checked" aria-checked="true">${inner}</li>`
    : `<li aria-checked="false">${inner}</li>`;
}

function renderList(list: ArticleList): string {
  const items = list.children.map((item) => renderListItem(item, list.listType === 'check')).join('');
  if (list.listType === 'check') return `<ul class="checklist">${items}</ul>`;
  if (list.listType === 'bullet') return `<ul>${items}</ul>`;
  return list.start > 1 ? `<ol start="${list.start}">${items}</ol>` : `<ol>${items}</ol>`;
}

/** The article column is 720 px; a 'normal' image narrower than that keeps its own width. */
const ARTICLE_COLUMN = 720;

/** srcset and sizes for an image that has smaller copies; '' for older images without. */
function responsiveAttrs(node: ArticleImage): string {
  const srcset = srcsetAttr(node.srcset);
  if (!srcset) return '';
  const shown = node.layout === 'wide' ? ARTICLE_COLUMN : Math.min(ARTICLE_COLUMN, node.width);
  return ` srcset="${escapeHtml(srcset)}" sizes="(min-width: 768px) ${shown}px, 100vw"`;
}

function renderImage(node: ArticleImage): string {
  const img =
    `<img src="${escapeHtml(node.src)}"${responsiveAttrs(node)} alt="${escapeHtml(node.altText)}" ` +
    `width="${node.width}" height="${node.height}" loading="lazy" decoding="async">`;
  const caption = node.caption?.trim() ? `<figcaption>${escapeHtml(node.caption.trim())}</figcaption>` : '';
  return `<figure${node.layout === 'wide' ? ' class="img-wide"' : ''}>${img}${caption}</figure>`;
}

function renderCell(cell: ArticleTableCell): string {
  // headerState: 1 = header row (scope col), 2 = header column (scope row), 3 = both.
  const tag = cell.headerState ? 'th' : 'td';
  const scope = cell.headerState ? ` scope="${cell.headerState & 1 ? 'col' : 'row'}"` : '';
  const colspan = cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
  const rowspan = cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '';
  const bg = highlightKey(cell.backgroundColor);
  const inner = cell.children
    .map((c) => (c.type === 'list' ? renderList(c) : `<p>${c.children.map(renderInline).join('')}</p>`))
    .join('');
  return `<${tag}${scope}${colspan}${rowspan}${bg ? ` class="hl-${bg}"` : ''}>${inner}</${tag}>`;
}

function renderTable(table: ArticleTable): string {
  const rows = table.children.map((row) => `<tr>${row.children.map(renderCell).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table><tbody>${rows}</tbody></table></div>`;
}

/** Nested <ol>s: each sub-section sits inside its section's <li>. */
function tocList(items: NumberedHeading[], depth: number): string {
  let html = '';
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (!item) break;
    let end = i + 1;
    while (end < items.length && (items[end]?.depth ?? 0) > depth) end += 1;
    const children = items.slice(i + 1, end);
    const link = `<a href="#${item.id}"><span class="toc-num">${item.number}</span>${escapeHtml(item.label)}</a>`;
    html += `<li>${link}${children.length ? tocList(children, depth + 1) : ''}</li>`;
    i = end;
  }
  return `<ol>${html}</ol>`;
}

function renderToc(ctx: Context): string {
  if (ctx.allHeadings.length === 0) return '';
  const list = tocList(numberHeadings(ctx.allHeadings), 0);
  return `<nav class="toc" aria-label="Mục lục"><p class="toc-title">Mục lục</p>${list}</nav>`;
}

function renderFaq(node: ArticleCollapsible, ctx: Context): string {
  const [title, content] = node.children;
  const question = title.children.map(renderInline).join('');
  const answer = content.children.map((b) => renderBlock(b, ctx)).join('');
  return `<details class="faq"><summary>${question}</summary><div class="faq-body">${answer}</div></details>`;
}

function renderLayout(node: ArticleLayout, ctx: Context): string {
  const items = node.children
    .map((item) => `<div class="layout-item">${item.children.map((b) => renderBlock(b, ctx)).join('')}</div>`)
    .join('');
  return `<div class="layout ${LAYOUT_COLUMNS[node.templateColumns] ?? 'cols-1-1'}">${items}</div>`;
}

function renderCode(node: ArticleCode): string {
  const text = node.children
    .map((c) => (c.type === 'linebreak' ? '\n' : c.type === 'tab' ? '\t' : 'text' in c ? c.text : ''))
    .join('');
  return `<pre class="code-block"><code>${escapeHtml(text)}</code></pre>`;
}

function renderBlock(node: ArticleBlock, ctx: Context): string {
  switch (node.type) {
    case 'paragraph': {
      const inner = node.children.map(renderInline).join('');
      return inner.trim() ? `<p${blockClass(node.format, node.indent)}>${inner}</p>` : '';
    }
    case 'quote':
      return `<blockquote${blockClass(node.format, node.indent)}>${node.children.map(renderInline).join('')}</blockquote>`;
    case 'heading': {
      const text = squashSpaces(inlineText(node.children));
      const id = headingId(text, ctx);
      ctx.headings.push({ id, text, level: HEADING_LEVEL[node.tag] });
      const inner = node.children.map(renderInline).join('');
      return `<${node.tag} id="${id}"${blockClass(node.format, node.indent)}>${inner}</${node.tag}>`;
    }
    case 'list':
      return renderList(node);
    case 'article-image':
      return renderImage(node);
    case 'horizontalrule':
      return '<hr>';
    case 'youtube':
      return (
        `<figure class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(node.videoID)}" ` +
        'title="Video YouTube" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" ' +
        'allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></figure>'
      );
    case 'cta': {
      const href = safeLinkUrl(node.url);
      const text = escapeHtml(node.text);
      return href
        ? `<p class="cta"><a class="cta-button" href="${escapeHtml(href)}" rel="noopener">${text}</a></p>`
        : '';
    }
    case 'table':
      return renderTable(node);
    case 'toc':
      return renderToc(ctx);
    case 'collapsible-container':
      return renderFaq(node, ctx);
    case 'layout-container':
      return renderLayout(node, ctx);
    case 'code':
      return renderCode(node);
  }
}

function blockText(node: ArticleBlock): string {
  switch (node.type) {
    case 'article-image':
      return node.caption ?? '';
    case 'horizontalrule':
    case 'youtube':
    case 'toc':
      return '';
    case 'collapsible-container':
      return [inlineText(node.children[0].children), ...node.children[1].children.map(blockText)].join(' ');
    case 'layout-container':
      return node.children.flatMap((item) => item.children.map(blockText)).join(' ');
    case 'code':
      return '';
    case 'cta':
      return node.text;
    case 'list':
      return node.children
        .map((item) => item.children.map((c) => (c.type === 'list' ? blockText(c) : inlineText([c]))).join(' '))
        .join(' ');
    case 'table':
      return node.children
        .flatMap((row) => row.children.flatMap((cell) => cell.children.map((c) => blockText(c))))
        .join(' ');
    default:
      return inlineText(node.children);
  }
}

export function renderArticle(state: ArticleState): RenderedArticle {
  const blocks = state.root.children;
  // First pass collects the headings, so a "Mục lục" block placed above them can still list them all.
  const first: Context = { headings: [], usedIds: new Set(), allHeadings: [] };
  blocks.forEach((b) => renderBlock(b, first));
  const ctx: Context = { headings: [], usedIds: new Set(), allHeadings: first.headings };
  return {
    html: blocks.map((b) => renderBlock(b, ctx)).join(''),
    headings: ctx.headings,
    plainText: squashSpaces(blocks.map(blockText).join(' ')),
    hasToc: blocks.some((b) => b.type === 'toc'),
  };
}

/** Minutes to read at ~200 words a minute, at least 1. */
export const readingMinutes = (plainText: string) =>
  Math.max(1, Math.round(plainText.split(' ').filter(Boolean).length / 200));
