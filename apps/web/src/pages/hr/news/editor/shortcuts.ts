import { $isListItemNode, $isListNode } from '@lexical/list';
import { $getSelection, $isRangeSelection, TextNode, type LexicalEditor } from 'lexical';

/**
 * "- [ ] Việc" typed at the start of a line: Lexical's "- " shortcut makes a bulleted item first, so its
 * checklist shortcut never fires. Typing "[ ] " (or "[x] ") at the start of that new, single item turns the
 * list into a checklist, as the markdown shortcut would.
 */

const CHECK_PREFIX = /^\[( |x|X)?\] /;

function $checklistFromBullet(node: TextNode) {
  const item = node.getParent();
  const list = item?.getParent();
  if (!$isListItemNode(item) || item.getFirstChild() !== node) return;
  if (!$isListNode(list) || list.getListType() !== 'bullet' || list.getChildrenSize() !== 1) return;
  const match = CHECK_PREFIX.exec(node.getTextContent());
  const selection = $getSelection();
  if (!match || !$isRangeSelection(selection) || !selection.isCollapsed()) return;
  if (selection.anchor.key !== node.getKey() || selection.anchor.offset !== match[0].length) return;
  node.spliceText(0, match[0].length, '', true);
  list.setListType('check');
  item.setChecked(match[1]?.toLowerCase() === 'x');
}

export const registerChecklistShortcut = (editor: LexicalEditor): (() => void) =>
  editor.registerNodeTransform(TextNode, $checklistFromBullet);
