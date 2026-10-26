import { $isCodeNode } from '@lexical/code-core';
import { $isListItemNode } from '@lexical/list';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isTableCellNode, $isTableSelection } from '@lexical/table';
import {
  $createNodeSelection,
  $createParagraphNode,
  $createRangeSelection,
  $findMatchingParent,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  INDENT_CONTENT_COMMAND,
  INSERT_TAB_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_TAB_COMMAND,
  mergeRegister,
  OUTDENT_CONTENT_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { $isBlockHome } from './structure';

/**
 * Keys the article editor handles itself: Tab and Shift+Tab (indent, nest list items, a tab in code; focus
 * never leaves the text), Backspace/Delete next to a picture, video or divider (select it first, like the
 * playground's decorator blocks), Backspace at the start of the first heading, and Backspace on selected table
 * cells (empties them; the table itself goes only with "Xoá bảng").
 */

/** No words between the start of `block` and the caret. */
function $isAtStart(selection: RangeSelection, block: ElementNode): boolean {
  const before = $createRangeSelection();
  before.anchor.set(block.getKey(), 0, 'element');
  before.focus.set(selection.anchor.key, selection.anchor.offset, selection.anchor.type);
  return before.getTextContent() === '';
}

/** No words between the caret and the end of `block`. */
function $isAtEnd(selection: RangeSelection, block: ElementNode): boolean {
  const after = $createRangeSelection();
  after.anchor.set(selection.anchor.key, selection.anchor.offset, selection.anchor.type);
  after.focus.set(block.getKey(), block.getChildrenSize(), 'element');
  return after.getTextContent() === '';
}

const isBlock = (node: LexicalNode): node is ElementNode => $isElementNode(node) && !node.isInline();

/**
 * Tab nests a list item wherever the caret is, indents a block when the caret is at its start (or several
 * blocks are selected), and otherwise types a tab; Shift+Tab always outdents. In code, Tab types a tab.
 * Tables move between cells first (their own handler runs at a higher priority).
 */
function $onTab(editor: LexicalEditor, event: KeyboardEvent): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  event.preventDefault();
  const anchor = selection.anchor.getNode();
  if ($findMatchingParent(anchor, $isCodeNode)) {
    if (!event.shiftKey) editor.dispatchCommand(INSERT_TAB_COMMAND, undefined);
    return true;
  }
  const block = $findMatchingParent(anchor, isBlock);
  const indent =
    event.shiftKey ||
    !selection.isCollapsed() ||
    !!$findMatchingParent(anchor, $isListItemNode) ||
    (block !== null && !$isRootNode(block) && $isAtStart(selection, block));
  if (!indent) return editor.dispatchCommand(INSERT_TAB_COMMAND, undefined) || true;
  editor.dispatchCommand(event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND, undefined);
  return true;
}

/** A block that sits straight in the article, a column or an answer. */
const isHomeBlock = (node: LexicalNode) => !$isBlockHome(node) && $isBlockHome(node.getParent());

/**
 * Backspace at the start of a block right after a picture, video, button, divider or the contents (Delete at
 * the end of one right before it) selects that block instead of removing it; the next press removes it. An
 * empty paragraph left in between goes away.
 */
function $selectBlockBeside(event: KeyboardEvent | null, backward: boolean): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const block = $findMatchingParent(selection.anchor.getNode(), isHomeBlock);
  if (!$isElementNode(block)) return false;
  const beside = backward ? block.getPreviousSibling() : block.getNextSibling();
  if (!$isDecoratorNode(beside) || beside.isInline()) return false;
  if (!(backward ? $isAtStart(selection, block) : $isAtEnd(selection, block))) return false;
  event?.preventDefault();
  if ($isParagraphNode(block) && block.isEmpty()) block.remove();
  const select = $createNodeSelection();
  select.add(beside.getKey());
  $setSelection(select);
  return true;
}

/** Backspace at the start of the first heading (nothing above to join) makes it a paragraph. */
function $headingToParagraph(event: KeyboardEvent | null): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const heading = $findMatchingParent(selection.anchor.getNode(), $isHeadingNode);
  if (!heading || heading.getPreviousSibling() || !$isAtStart(selection, heading)) return false;
  event?.preventDefault();
  const paragraph = $createParagraphNode();
  paragraph.setFormat(heading.getFormatType());
  paragraph.setIndent(heading.getIndent());
  heading.replace(paragraph, true);
  paragraph.selectStart();
  return true;
}

/** Selected table cells are emptied, never the whole table (Lexical removes it when every cell is selected). */
function $clearSelectedCells(event: KeyboardEvent | null): boolean {
  const selection = $getSelection();
  if (!$isTableSelection(selection)) return false;
  event?.preventDefault();
  const cells = selection.getNodes().filter($isTableCellNode);
  for (const cell of cells) cell.clear().append($createParagraphNode());
  cells[0]?.selectStart();
  return true;
}

export function registerArticleKeys(editor: LexicalEditor): () => void {
  const clearCells = () => $clearSelectedCells(null);
  return mergeRegister(
    editor.registerCommand(KEY_TAB_COMMAND, (event) => $onTab(editor, event), COMMAND_PRIORITY_LOW),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => $headingToParagraph(event) || $selectBlockBeside(event, true),
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(KEY_DELETE_COMMAND, (event) => $selectBlockBeside(event, false), COMMAND_PRIORITY_LOW),
    // Before @lexical/table's own handlers (high priority), which delete a fully selected table.
    editor.registerCommand(KEY_BACKSPACE_COMMAND, $clearSelectedCells, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(KEY_DELETE_COMMAND, $clearSelectedCells, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(DELETE_CHARACTER_COMMAND, clearCells, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(DELETE_WORD_COMMAND, clearCells, COMMAND_PRIORITY_CRITICAL),
    editor.registerCommand(DELETE_LINE_COMMAND, clearCells, COMMAND_PRIORITY_CRITICAL),
  );
}
