import { LAYOUT_COLUMNS } from '@careers/shared';
import { $createCodeNode } from '@lexical/code-core';
import { $isHeadingNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $isTableCellNode } from '@lexical/table';
import { $insertNodeToNearestRoot, $onEscapeDown, $onEscapeUp } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $findMatchingParent,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  INDENT_CONTENT_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  mergeRegister,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import {
  $createFaq,
  $isCollapsibleContainerNode,
  $isCollapsibleContentNode,
  $isCollapsibleTitleNode,
} from './CollapsibleNodes';
import { INSERT_CODE_COMMAND, INSERT_FAQ_COMMAND, INSERT_LAYOUT_COMMAND } from './commands';
import { $createLayout, $isLayoutContainerNode } from './LayoutNodes';
import { $maxIndentFor, $topLevelOf } from './structure';
import { registerTocActions } from './tocActions';

/**
 * The block tools of the "Chèn" menu (FAQ, columns, contents, code) and the keyboard around them, after the
 * Lexical playground's CollapsibleExtension, LayoutExtension and code block. The transforms (structure.ts)
 * keep whatever these produce inside what the API accepts.
 */

const isContainer = (node?: LexicalNode | null): node is ElementNode =>
  $isLayoutContainerNode(node) || $isCollapsibleContainerNode(node);

/** The article itself, or the columns / FAQ / table cell around the caret. */
const isPlace = (node: LexicalNode) => $isRootNode(node) || $isTableCellNode(node) || isContainer(node);

/**
 * Columns, FAQ and the contents go at the top level: at the caret (splitting the paragraph), or right after
 * the columns / FAQ / table the caret is in. A paragraph follows when it is the last block, to keep typing.
 */
function $insertTopLevel(node: LexicalNode) {
  if (!$getSelection()) $getRoot().selectEnd();
  const anchor = $getSelection()?.getNodes()[0] ?? $getRoot();
  const place = $findMatchingParent(anchor, isPlace);
  const top = $topLevelOf(anchor);
  if (place && !$isRootNode(place)) top.insertAfter(node);
  // On an empty line the block takes its place, instead of leaving an empty paragraph above it.
  else if ($isParagraphNode(top) && top.isEmpty()) top.replace(node);
  else $insertNodeToNearestRoot(node);
  if (!node.getNextSibling()) node.insertAfter($createParagraphNode());
}

function $insertFaq(): boolean {
  const faq = $createFaq();
  $insertTopLevel(faq);
  faq.getFirstChild()?.selectStart();
  return true;
}

function $insertLayout(template: string): boolean {
  if (!(template in LAYOUT_COLUMNS)) return false;
  const layout = $createLayout(template);
  $insertTopLevel(layout);
  layout.selectStart();
  return true;
}

/** The caret's block becomes a code block; in a table or an FAQ question a new one goes next to it. */
function $insertCode(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const anchor = selection.anchor.getNode();
  const title = $findMatchingParent(anchor, $isCollapsibleTitleNode);
  const answer = title?.getNextSibling();
  if ($isCollapsibleContentNode(answer)) {
    const code = $createCodeNode();
    answer.splice(0, 0, [code]);
    code.select();
    return true;
  }
  if ($findMatchingParent(anchor, $isTableCellNode)) {
    const code = $createCodeNode();
    $topLevelOf(anchor).insertAfter(code);
    code.select();
    return true;
  }
  $setBlocksType(selection, () => $createCodeNode());
  return true;
}

/** The new line starts plain: no bold or colour carried over from the end of the heading. */
function $selectPlain(paragraph: ElementNode) {
  paragraph.select();
  const caret = $getSelection();
  if (!$isRangeSelection(caret)) return;
  caret.setFormat(0);
  caret.setStyle('');
}

/** Line breaks at the end of a heading (Shift+Enter, then Enter) would show as an empty line on the site. */
function $dropTrailingBreaks(heading: ElementNode) {
  for (let last = heading.getLastChild(); $isLineBreakNode(last); last = heading.getLastChild()) last.remove();
}

/**
 * Enter at the end of a heading starts a paragraph, as in the playground. Lexical only does so when the caret
 * is on the heading's last node, so a heading ending with a line break (Shift+Enter, pasted from Docs) or a
 * caret placed on the heading element itself gave another heading. Here "the end" means no words after the
 * caret; trailing line breaks are dropped. Enter on an empty heading turns it into a paragraph (as Enter on
 * an empty list item leaves the list), so no empty heading is left in the contents.
 */
function $enterAfterHeading(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const heading = $findMatchingParent(selection.anchor.getNode(), $isHeadingNode);
  if (!heading) return false;
  const rest = $createRangeSelection();
  rest.anchor.set(selection.anchor.key, selection.anchor.offset, selection.anchor.type);
  rest.focus.set(heading.getKey(), heading.getChildrenSize(), 'element');
  if (rest.getTextContent().trim() !== '') return false;
  if (!rest.isCollapsed()) rest.removeText();
  $dropTrailingBreaks(heading);
  const paragraph = $createParagraphNode();
  if (heading.getTextContent().trim() === '') {
    paragraph.setFormat(heading.getFormatType());
    heading.replace(paragraph);
  } else {
    heading.insertAfter(paragraph);
  }
  $selectPlain(paragraph);
  return true;
}

/** Enter in an FAQ question opens the answer and moves there, instead of splitting the question. */
function $enterAnswer(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const title = $findMatchingParent(selection.anchor.getNode(), $isCollapsibleTitleNode);
  const container = title?.getParent();
  if (!title || !$isCollapsibleContainerNode(container)) return false;
  if (!container.getOpen()) container.setOpen(true);
  title.getNextSibling()?.selectStart();
  return true;
}

const isBlock = (node: LexicalNode): node is ElementNode => $isElementNode(node) && !node.isInline();

/** True when a block at the caret is already indented as far as it may go. */
export function $isIndentFull(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  return selection.getNodes().some((node) => {
    const block = $findMatchingParent(node, isBlock);
    return block !== null && !$isRootNode(block) && block.getIndent() >= $maxIndentFor(block);
  });
}

export function registerArticleBlocks(editor: LexicalEditor): () => void {
  const escapeDown = (event: KeyboardEvent) => $onEscapeDown(isContainer, event);
  const escapeUp = (event: KeyboardEvent) => $onEscapeUp(isContainer, event);
  return mergeRegister(
    registerTocActions(editor),
    editor.registerCommand(INSERT_FAQ_COMMAND, $insertFaq, COMMAND_PRIORITY_EDITOR),
    editor.registerCommand(INSERT_LAYOUT_COMMAND, $insertLayout, COMMAND_PRIORITY_EDITOR),
    editor.registerCommand(INSERT_CODE_COMMAND, $insertCode, COMMAND_PRIORITY_EDITOR),
    editor.registerCommand(INSERT_PARAGRAPH_COMMAND, $enterAnswer, COMMAND_PRIORITY_LOW),
    editor.registerCommand(INSERT_PARAGRAPH_COMMAND, $enterAfterHeading, COMMAND_PRIORITY_LOW),
    // Stops Lexical's indent (rich text and lists) at the limit: returning true ends the command.
    editor.registerCommand(INDENT_CONTENT_COMMAND, $isIndentFull, COMMAND_PRIORITY_NORMAL),
    // Arrow keys at the edge of columns / an FAQ that end the article add a paragraph to keep writing.
    editor.registerCommand(KEY_ARROW_DOWN_COMMAND, escapeDown, COMMAND_PRIORITY_LOW),
    editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, escapeDown, COMMAND_PRIORITY_LOW),
    editor.registerCommand(KEY_ARROW_UP_COMMAND, escapeUp, COMMAND_PRIORITY_LOW),
    editor.registerCommand(KEY_ARROW_LEFT_COMMAND, escapeUp, COMMAND_PRIORITY_LOW),
  );
}
