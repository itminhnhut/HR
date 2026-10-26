/** Typed shape of an article body after parseArticleContent (only fields the site renders are typed). */

import type { NewsImageVariant } from './images.js';

export const ARTICLE_IMAGE_TYPE = 'article-image';

/** '' = default (left). Lexical stores alignment in an element's `format`. */
export type ArticleAlign = '' | 'left' | 'start' | 'center' | 'right' | 'end' | 'justify';

export interface ArticleText {
  type: 'text';
  text: string;
  format: number;
  style?: string;
}
export interface ArticleLineBreak {
  type: 'linebreak' | 'tab';
}
export interface ArticleLink {
  type: 'link' | 'autolink';
  url: string;
  children: ArticleInline[];
}
export type ArticleInline = ArticleText | ArticleLineBreak | ArticleLink;
export interface ArticleParagraph {
  type: 'paragraph' | 'quote';
  format?: ArticleAlign;
  /** 0–4 steps of indentation ("Thụt lề"). */
  indent?: number;
  children: ArticleInline[];
}
export interface ArticleHeading {
  type: 'heading';
  /** h2 = section (1), h3 = sub-section (1.1), h4 = sub-sub-section (1.1.1). */
  tag: 'h2' | 'h3' | 'h4';
  format?: ArticleAlign;
  indent?: number;
  children: ArticleInline[];
}
export interface ArticleListItem {
  type: 'listitem';
  /** Only in a checklist. */
  checked?: boolean;
  children: (ArticleInline | ArticleList)[];
}
export interface ArticleList {
  type: 'list';
  listType: 'bullet' | 'number' | 'check';
  start: number;
  children: ArticleListItem[];
}
export interface ArticleImage {
  type: typeof ARTICLE_IMAGE_TYPE;
  src: string;
  altText: string;
  width: number;
  height: number;
  caption?: string;
  /** 'wide' spans the whole content column; 'normal' keeps the image's own width (centred). */
  layout?: 'normal' | 'wide';
  /** Smaller WebP copies made at upload (see NewsImage.srcset). */
  srcset?: NewsImageVariant[];
}
export interface ArticleDivider {
  type: 'horizontalrule';
}
export interface ArticleYouTube {
  type: 'youtube';
  videoID: string;
}
/** A button-like link, e.g. "Ứng tuyển ngay" → a job page. */
export interface ArticleCta {
  type: 'cta';
  text: string;
  url: string;
}
export interface ArticleTableCell {
  type: 'tablecell';
  /** Lexical: 0 none, 1 header row, 2 header column, 3 both. */
  headerState: number;
  colSpan?: number;
  rowSpan?: number;
  backgroundColor?: string | null;
  children: (ArticleParagraph | ArticleList)[];
}
export interface ArticleTableRow {
  type: 'tablerow';
  children: ArticleTableCell[];
}
export interface ArticleTable {
  type: 'table';
  children: ArticleTableRow[];
}
/** HR places it where the table of contents should appear; it lists every H2/H3 of the post. */
export interface ArticleToc {
  type: 'toc';
}
/** A question that opens to show its answer (FAQ). */
export interface ArticleCollapsible {
  type: 'collapsible-container';
  children: [ArticleCollapsibleTitle, ArticleCollapsibleContent];
}
export interface ArticleCollapsibleTitle {
  type: 'collapsible-title';
  children: ArticleInline[];
}
export interface ArticleCollapsibleContent {
  type: 'collapsible-content';
  children: ArticleBlock[];
}
/** Side-by-side columns; widths are one of LAYOUT_COLUMNS. */
export interface ArticleLayout {
  type: 'layout-container';
  templateColumns: string;
  children: ArticleLayoutItem[];
}
export interface ArticleLayoutItem {
  type: 'layout-item';
  children: ArticleBlock[];
}
/** Preformatted code; its text children (text / code-highlight) are shown as typed. */
export interface ArticleCode {
  type: 'code';
  children: (ArticleText | ArticleLineBreak | { type: 'code-highlight'; text: string })[];
}
export type ArticleBlock =
  | ArticleParagraph
  | ArticleHeading
  | ArticleList
  | ArticleImage
  | ArticleDivider
  | ArticleYouTube
  | ArticleCta
  | ArticleTable
  | ArticleToc
  | ArticleCollapsible
  | ArticleLayout
  | ArticleCode;
export interface ArticleRoot {
  type: 'root';
  children: ArticleBlock[];
}
/** What is stored: `{ root }`, exactly the shape the editor loads. */
export interface ArticleState {
  root: ArticleRoot;
}
