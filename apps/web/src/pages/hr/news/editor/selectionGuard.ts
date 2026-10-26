import {
  $getNodeByKey,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type BaseSelection,
  type PointType,
} from 'lexical';

/** The point still names a node in the article and an offset inside it. */
function $isPointUsable(point: PointType): boolean {
  const node = $getNodeByKey(point.key);
  if (!node || !node.isAttached()) return false;
  if (point.type === 'text') return $isTextNode(node) && point.offset <= node.getTextContentSize();
  return $isElementNode(node) && point.offset <= node.getChildrenSize();
}

/**
 * A selection saved before a toolbar menu or box took focus can go stale: applying a size or a font splits
 * the text it pointed into. Restoring a stale one makes Lexical throw ("invalid offset"), so it is checked
 * first. Node selections (a picture) are kept as they are.
 */
export function $isSelectionUsable(selection: BaseSelection): boolean {
  if (!$isRangeSelection(selection)) return true;
  return $isPointUsable(selection.anchor) && $isPointUsable(selection.focus);
}
