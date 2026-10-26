import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isTableCellNode } from '@lexical/table';
import {
  $findMatchingParent,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  type NodeKey,
} from 'lexical';
import { useEffect } from 'react';

export const LINE_PLACEHOLDER = 'Gõ / để chèn khối…';

/** The empty paragraph holding the caret (not when the whole article is empty: its own placeholder shows). */
function $emptyLineAtCaret(): NodeKey | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const node = selection.anchor.getNode();
  if (!$isParagraphNode(node) || !node.isEmpty() || $findMatchingParent(node, $isTableCellNode)) return null;
  const root = $getRoot();
  if (root.getChildrenSize() === 1 && root.getTextContentSize() === 0) return null;
  return node.getKey();
}

/** "Gõ / để chèn khối…" on the empty line where the caret is, as in Notion (CSS shows the attribute). */
export function LinePlaceholderPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    let marked: HTMLElement | null = null;
    const unmark = () => {
      marked?.removeAttribute('data-placeholder');
      marked = null;
    };
    const stop = editor.registerUpdateListener(({ editorState }) => {
      const key = editorState.read($emptyLineAtCaret);
      const element = key ? editor.getElementByKey(key) : null;
      if (element === marked) return;
      unmark();
      if (!element) return;
      element.setAttribute('data-placeholder', LINE_PLACEHOLDER);
      marked = element;
    });
    return () => {
      stop();
      unmark();
    };
  }, [editor]);
  return null;
}
