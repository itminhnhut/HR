import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $isTableSelection } from '@lexical/table';
import { $getNearestBlockElementAncestorOrThrow } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isBlockFullySelected,
  $isRangeSelection,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
} from 'lexical';

/**
 * "Xoá định dạng", as the Lexical playground's $clearFormatting (v0.52.0): the selected words lose bold,
 * italic, case, colours…; blocks that are wholly selected (or the caret's block) lose alignment and
 * indentation; headings and quotes become paragraphs.
 */

function $clearBlock(block: ElementNode) {
  if (block.getFormatType() !== '') block.setFormat('');
  if (block.getIndent() !== 0) block.setIndent(0);
}

/** Blocks wholly inside the selection, found before anything changes (replacing a heading moves the carets). */
function $fullySelectedBlocks(nodes: LexicalNode[]): Set<string> | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const keys = new Set<string>();
  for (const node of nodes) {
    if (!$isTextNode(node)) continue;
    const block = $getNearestBlockElementAncestorOrThrow(node);
    if ($isBlockFullySelected(block, selection)) keys.add(block.getKey());
  }
  return keys;
}

export function $clearFormatting() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return;
  const { anchor, focus } = selection;
  const nodes = selection.extract();
  if (anchor.key === focus.key && anchor.offset === focus.offset) {
    $clearBlock($getNearestBlockElementAncestorOrThrow(anchor.getNode()));
    return;
  }
  const fullBlocks = $fullySelectedBlocks(nodes);
  for (const node of nodes) {
    if ($isTextNode(node)) {
      if (node.getStyle() !== '') node.setStyle('');
      if (node.getFormat() !== 0) node.setFormat(0);
      const block = $getNearestBlockElementAncestorOrThrow(node);
      if (fullBlocks === null || fullBlocks.has(block.getKey())) $clearBlock(block);
    } else if ($isHeadingNode(node) || $isQuoteNode(node)) {
      node.replace($createParagraphNode(), true);
    }
  }
  // The toolbar reads the format kept on the selection: clear it too (Lexical #8881).
  const cleared = $getSelection();
  if ($isRangeSelection(cleared)) {
    cleared.setFormat(0);
    cleared.setStyle('');
  }
}
