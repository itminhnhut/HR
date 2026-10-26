import { $isCodeNode, CodeNode } from '@lexical/code-core';
import { HorizontalRuleNode } from '@lexical/extension';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode, $isListItemNode } from '@lexical/list';
import { $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $isTableCellNode, TableCellNode, TableNode } from '@lexical/table';
import {
  $copyNode,
  $createLineBreakNode,
  $createParagraphNode,
  $generateNodesFromRawText,
  $isElementNode,
  $isParagraphNode,
  mergeRegister,
  ParagraphNode,
  TextNode,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { CollapsibleContainerNode, CollapsibleContentNode, CollapsibleTitleNode } from './CollapsibleNodes';
import { CtaNode } from './CtaNode';
import { ArticleImageNode } from './ImageNode';
import { LayoutContainerNode, LayoutItemNode } from './LayoutNodes';
import {
  alignFor,
  allowedFormat,
  cellBackground,
  cleanTextStyle,
  headingTagFor,
  indentFor,
  isSafeLink,
  listTypeFor,
} from './rules';
import {
  $fixFaq,
  $fixFaqContent,
  $fixFaqTitle,
  $fixLayout,
  $fixLayoutItem,
  $fixToc,
  $liftToBlockHome,
  $liftToRoot,
  $maxIndentFor,
} from './structure';
import { splitPointFor, TEXT_MAX } from './pasteRules';
import { TocNode } from './TocNode';
import { YouTubeNode } from './YouTubeNode';

/**
 * Node transforms that keep whatever HR types or pastes (Word, Google Docs, other sites) inside what the
 * API accepts (parseArticleContent): they run after every change, before anything is saved.
 */

/** Blocks a too-long text may be split across (the rest goes into a copy of the block). */
const isSplittable = (node: LexicalNode | null | undefined): node is ElementNode =>
  $isParagraphNode(node) || $isQuoteNode(node) || $isHeadingNode(node) || $isListItemNode(node);

/**
 * The API takes at most 10 000 characters in one text: a longer one (a pasted wall of text) is cut after a
 * sentence and the rest starts a new paragraph (in code or a link, a new line).
 */
function $splitLongText(node: TextNode) {
  const text = node.getTextContent();
  if (text.length <= TEXT_MAX) return;
  const [, tail] = node.splitText(splitPointFor(text));
  const parent = tail?.getParent();
  if (!tail) return;
  if (!isSplittable(parent)) {
    tail.insertBefore($createLineBreakNode());
    return;
  }
  const next = $copyNode(parent);
  next.append(tail, ...tail.getNextSiblings());
  parent.insertAfter(next);
}

/** No inline code or highlight; only palette colours, no font or size. Code blocks keep plain text. */
function $fixText(node: TextNode) {
  const inCode = $isCodeNode(node.getParent());
  const format = inCode ? 0 : allowedFormat(node.getFormat());
  if (format !== node.getFormat()) node.setFormat(format);
  const style = inCode ? '' : cleanTextStyle(node.getStyle());
  if (style !== node.getStyle()) node.setStyle(style);
  $splitLongText(node);
}

/** A code block holds plain lines: a paragraph or heading pasted into it gives up its words. */
function $fixCode(node: CodeNode) {
  $liftToBlockHome(node);
  for (const child of node.getChildren()) {
    if (!$isElementNode(child) || child.isInline()) continue;
    if (child.getPreviousSibling()) child.insertBefore($createLineBreakNode());
    for (const part of $generateNodesFromRawText(child.getTextContent())) child.insertBefore(part);
    child.remove();
  }
}

/** A list pasted deeper than the site shows (and the API accepts) comes back to the deepest level. */
function $fixListItem(node: ListItemNode) {
  const max = $maxIndentFor(node);
  if (node.getIndent() > max) node.setIndent(max);
}

/** Alignment the site shows (left/centre/right/justify) and up to 4 steps of indentation. */
function $fixBlockFormat(node: ElementNode) {
  const align = alignFor(node.getFormatType());
  if (align !== node.getFormatType()) node.setFormat(align);
  const indent = indentFor(node.getIndent());
  if (indent !== node.getIndent()) node.setIndent(indent);
}

/** Table cells hold paragraphs and lists only: a heading or quote there becomes a paragraph. */
function $flattenInCell(node: ElementNode): boolean {
  if (!$isTableCellNode(node.getParent())) return false;
  const paragraph = $createParagraphNode();
  paragraph.append(...node.getChildren());
  node.replace(paragraph);
  return true;
}

function $fixHeading(node: HeadingNode) {
  if ($flattenInCell(node)) return;
  const tag = headingTagFor(node.getTag());
  if (tag !== node.getTag()) node.setTag(tag);
  $fixBlockFormat(node);
}

function $fixQuote(node: QuoteNode) {
  if (!$flattenInCell(node)) $fixBlockFormat(node);
}

/** A link the site would not render (javascript:, data:…, or inside code) keeps its words without the link. */
function $fixLink(node: LinkNode) {
  if (isSafeLink(node.getURL()) && !$isCodeNode(node.getParent())) return;
  for (const child of node.getChildren()) node.insertBefore(child);
  node.remove();
}

function $fixList(node: ListNode) {
  const listType = listTypeFor(node.getListType());
  if (listType !== node.getListType()) node.setListType(listType);
}

/** Palette colours only; a cell emptied by a block moving out keeps a paragraph to type in. */
function $fixCell(node: TableCellNode) {
  const color = cellBackground(node.getBackgroundColor());
  if (color !== node.getBackgroundColor()) node.setBackgroundColor(color);
  if (node.isEmpty()) node.append($createParagraphNode());
}

export function registerArticleRules(editor: LexicalEditor): () => void {
  return mergeRegister(
    editor.registerNodeTransform(TextNode, $fixText),
    editor.registerNodeTransform(ParagraphNode, $fixBlockFormat),
    editor.registerNodeTransform(QuoteNode, $fixQuote),
    editor.registerNodeTransform(HeadingNode, $fixHeading),
    editor.registerNodeTransform(LinkNode, $fixLink),
    editor.registerNodeTransform(ListNode, $fixList),
    editor.registerNodeTransform(ListItemNode, $fixListItem),
    editor.registerNodeTransform(TableCellNode, $fixCell),
    // Tables, columns, FAQ and the contents: top level only.
    editor.registerNodeTransform(TableNode, $liftToRoot),
    editor.registerNodeTransform(TocNode, $fixToc),
    editor.registerNodeTransform(CollapsibleContainerNode, $fixFaq),
    editor.registerNodeTransform(CollapsibleTitleNode, $fixFaqTitle),
    editor.registerNodeTransform(CollapsibleContentNode, $fixFaqContent),
    editor.registerNodeTransform(LayoutContainerNode, $fixLayout),
    editor.registerNodeTransform(LayoutItemNode, $fixLayoutItem),
    // Pictures, videos, buttons, dividers, code: blocks of their own, in the article, a column or an answer.
    editor.registerNodeTransform(ArticleImageNode, $liftToBlockHome),
    editor.registerNodeTransform(YouTubeNode, $liftToBlockHome),
    editor.registerNodeTransform(CtaNode, $liftToBlockHome),
    editor.registerNodeTransform(HorizontalRuleNode, $liftToBlockHome),
    editor.registerNodeTransform(CodeNode, $fixCode),
  );
}
