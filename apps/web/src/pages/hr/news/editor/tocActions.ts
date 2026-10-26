import { $isHeadingNode } from '@lexical/rich-text';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $onUpdate,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  mergeRegister,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { INSERT_TOC_COMMAND, MOVE_TOC_COMMAND, SHOW_STATUS_COMMAND } from './commands';
import { $createTocNode, $isTocNode, type TocNode } from './TocNode';

/**
 * "Chèn → Mục lục": the contents go where readers expect them, right before the first heading of the article
 * (or at the very top), wherever the caret is. A post has one: asking again shows the existing one. The
 * block moves one step up or down with its ↑ / ↓ buttons, or Alt+↑ / Alt+↓ while it is selected.
 */

export const TOC_FLASH_CLASS = 'toc-flash';

const smooth = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** After the update is on screen: scroll the block into view and, if asked, flash it. */
function $revealAfterUpdate(editor: LexicalEditor, key: NodeKey, flash: boolean) {
  $onUpdate(() => {
    const element = editor.getElementByKey(key);
    if (!element) return;
    element.scrollIntoView?.({ behavior: smooth(), block: 'center' });
    if (!flash) return;
    element.classList.add(TOC_FLASH_CLASS);
    window.setTimeout(() => element.classList.remove(TOC_FLASH_CLASS), 1400);
  });
}

const $findToc = (): TocNode | undefined => $getRoot().getChildren().find($isTocNode);

export function $insertToc(editor: LexicalEditor): boolean {
  const existing = $findToc();
  if (existing) {
    $revealAfterUpdate(editor, existing.getKey(), true);
    editor.dispatchCommand(SHOW_STATUS_COMMAND, { tone: 'info', text: 'Bài đã có mục lục, đây là vị trí của nó.' });
    return true;
  }
  const toc = $createTocNode();
  const root = $getRoot();
  const firstHeading = root.getChildren().find($isHeadingNode);
  const first = root.getFirstChild();
  if (firstHeading) firstHeading.insertBefore(toc);
  else if (first) first.insertBefore(toc);
  else root.append(toc);
  $revealAfterUpdate(editor, toc.getKey(), false);
  editor.dispatchCommand(SHOW_STATUS_COMMAND, {
    tone: 'info',
    text: firstHeading ? 'Đã chèn mục lục trước tiêu đề đầu tiên.' : 'Đã chèn mục lục ở đầu bài.',
  });
  return true;
}

/** One block up or down among the article's top-level blocks; false at either end. */
export function $moveToc(key: NodeKey, direction: 'up' | 'down'): boolean {
  const toc = $getNodeByKey(key);
  if (!$isTocNode(toc)) return false;
  const neighbour = direction === 'up' ? toc.getPreviousSibling() : toc.getNextSibling();
  if (!neighbour) return false;
  if (direction === 'up') neighbour.insertBefore(toc);
  else neighbour.insertAfter(toc);
  return true;
}

/** Alt+↑ / Alt+↓ while the contents block is selected. */
function $moveSelectedToc(event: KeyboardEvent, direction: 'up' | 'down'): boolean {
  if (!event.altKey) return false;
  const selection = $getSelection();
  const nodes = $isNodeSelection(selection) ? selection.getNodes() : [];
  const toc = nodes.length === 1 ? nodes[0] : null;
  if (!$isTocNode(toc)) return false;
  event.preventDefault();
  $moveToc(toc.getKey(), direction);
  return true;
}

export function registerTocActions(editor: LexicalEditor): () => void {
  return mergeRegister(
    editor.registerCommand(INSERT_TOC_COMMAND, () => $insertToc(editor), COMMAND_PRIORITY_EDITOR),
    editor.registerCommand(MOVE_TOC_COMMAND, ({ key, direction }) => $moveToc(key, direction), COMMAND_PRIORITY_EDITOR),
    editor.registerCommand(KEY_ARROW_UP_COMMAND, (e) => $moveSelectedToc(e, 'up'), COMMAND_PRIORITY_NORMAL),
    editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (e) => $moveSelectedToc(e, 'down'), COMMAND_PRIORITY_NORMAL),
  );
}
