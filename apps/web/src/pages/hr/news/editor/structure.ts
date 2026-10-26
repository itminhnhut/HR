import { MAX_INDENT } from '@careers/shared';
import { $isListItemNode } from '@lexical/list';
import { $isTableCellNode } from '@lexical/table';
import {
  $createParagraphNode,
  $findMatchingParent,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isRootNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
} from 'lexical';
import {
  $createCollapsibleContentNode,
  $createCollapsibleTitleNode,
  $isCollapsibleContainerNode,
  $isCollapsibleContentNode,
  $isCollapsibleTitleNode,
  type CollapsibleContainerNode,
  type CollapsibleContentNode,
  type CollapsibleTitleNode,
} from './CollapsibleNodes';
import {
  $isLayoutContainerNode,
  $isLayoutItemNode,
  type LayoutContainerNode,
  type LayoutItemNode,
} from './LayoutNodes';
import { layoutTemplateFor } from './rules';
import { $isTocNode, type TocNode } from './TocNode';

/**
 * Transforms that keep FAQ, columns and the contents block in the shapes the API accepts
 * (parseArticleContent): FAQ = question + answer, columns = column items only, nothing of these nested in
 * a column or an answer, one "Mục lục" at the top level. Pasted or dragged content that breaks a rule is
 * reshaped, never thrown away.
 */

/** Where content blocks (paragraphs, pictures, code…) may sit: the article, a column, an FAQ answer. */
export const $isBlockHome = (node: LexicalNode | null): boolean =>
  $isRootNode(node) || $isLayoutItemNode(node) || $isCollapsibleContentNode(node);

/**
 * Deepest indentation for a block: 4 steps, but a list inside columns, an answer or a table cell stops at 2
 * (each list level nests two nodes, and the API refuses content nested more than 12 deep).
 */
export function $maxIndentFor(block: ElementNode): number {
  if (!$isListItemNode(block)) return MAX_INDENT;
  const boxed = $findMatchingParent(
    block,
    (n) => $isLayoutItemNode(n) || $isCollapsibleContentNode(n) || $isTableCellNode(n),
  );
  return boxed ? 2 : MAX_INDENT;
}

/** The top-level block holding `node` (walking past columns, answers and table cells). */
export function $topLevelOf(node: LexicalNode): LexicalNode {
  let top = node;
  for (let parent = top.getParent(); parent && !$isRootNode(parent); parent = top.getParent()) top = parent;
  return top;
}

/** Tables, columns, FAQ and the contents live at the top level only: move one found deeper right after. */
export function $liftToRoot(node: LexicalNode) {
  const top = $topLevelOf(node);
  if (top !== node) top.insertAfter(node);
}

/** A picture, video, button, divider or code block inside a paragraph, list or cell moves after it. */
export function $liftToBlockHome(node: LexicalNode) {
  let top = node;
  for (let parent = top.getParent(); parent && !$isBlockHome(parent); parent = top.getParent()) top = parent;
  if (top !== node) top.insertAfter(node);
}

const isInline = (node: LexicalNode) =>
  $isTextNode(node) || $isLineBreakNode(node) || (($isElementNode(node) || $isDecoratorNode(node)) && node.isInline());

/** Words sitting straight in a column or an answer go into a paragraph; an empty one gets a paragraph. */
function $keepBlocksOnly(home: ElementNode) {
  let paragraph: ElementNode | null = null;
  for (const child of home.getChildren()) {
    if (!isInline(child)) {
      paragraph = null;
      continue;
    }
    if (!paragraph) {
      paragraph = $createParagraphNode();
      child.insertBefore(paragraph);
    }
    paragraph.append(child);
  }
  if (home.isEmpty()) home.append($createParagraphNode());
}

/** Puts `node`'s children where it stands, then removes it. */
function $unwrap(node: ElementNode) {
  for (const child of node.getChildren()) node.insertBefore(child);
  node.remove();
}

function $fixFaqParts(node: CollapsibleContainerNode) {
  const children = node.getChildren();
  const title = children.find($isCollapsibleTitleNode);
  const content = children.find($isCollapsibleContentNode);
  if (!title && !content) return $unwrap(node);
  const answer = content ?? $createCollapsibleContentNode();
  const question = title ?? $createCollapsibleTitleNode();
  // Anything else that landed in the FAQ (a picture inserted from the question…) joins the answer.
  const before = content ? children.slice(0, children.indexOf(content)) : children;
  const after = content ? children.slice(children.indexOf(content) + 1) : [];
  const strayBefore = before.filter((c) => c !== question);
  if (strayBefore.length) answer.splice(0, 0, strayBefore);
  if (after.length) answer.append(...after);
  if (node.getFirstChild() !== question) node.splice(0, 0, [question]);
  if (question.getNextSibling() !== answer) question.insertAfter(answer);
}

export function $fixFaq(node: CollapsibleContainerNode) {
  if (!$isRootNode(node.getParent())) return $liftToRoot(node);
  const children = node.getChildren();
  const isWellFormed =
    children.length === 2 && $isCollapsibleTitleNode(children[0]) && $isCollapsibleContentNode(children[1]);
  if (!isWellFormed) $fixFaqParts(node);
}

/** The question holds words only: a pasted paragraph gives up its words, other blocks join the answer. */
export function $fixFaqTitle(node: CollapsibleTitleNode) {
  const container = node.getParent();
  if (!$isCollapsibleContainerNode(container)) {
    node.replace($createParagraphNode().append(...node.getChildren()));
    return;
  }
  for (const child of node.getChildren()) {
    if (!$isElementNode(child) || child.isInline()) continue;
    const answer = node.getNextSibling();
    const wordsOnly = child.getChildren().every(isInline);
    if (wordsOnly || !$isCollapsibleContentNode(answer)) $unwrap(child);
    else answer.splice(0, 0, [child]);
  }
}

export function $fixFaqContent(node: CollapsibleContentNode) {
  if (!$isCollapsibleContainerNode(node.getParent())) return $unwrap(node);
  $keepBlocksOnly(node);
}

export function $fixLayout(node: LayoutContainerNode) {
  if (!$isRootNode(node.getParent())) return $liftToRoot(node);
  // Something other than a column: it joins the column before it (or the first one).
  for (const child of node.getChildren()) {
    if ($isLayoutItemNode(child)) continue;
    const home = child.getPreviousSibling() ?? child.getNextSibling();
    if ($isLayoutItemNode(home)) home.append(child);
  }
  const items = node.getChildren().filter($isLayoutItemNode);
  const template = layoutTemplateFor(node.getTemplateColumns(), items.length);
  if (template === null) {
    // One column (or too many): plain content again.
    items.forEach($unwrap);
    return $unwrap(node);
  }
  if (template !== node.getTemplateColumns()) node.setTemplateColumns(template);
}

export function $fixLayoutItem(node: LayoutItemNode) {
  if (!$isLayoutContainerNode(node.getParent())) return $unwrap(node);
  $keepBlocksOnly(node);
}

/** One "Mục lục" per post, at the top level: a second one (pasted) goes away. */
export function $fixToc(node: TocNode) {
  if (!$isRootNode(node.getParent())) return $liftToRoot(node);
  const first = $getRoot().getChildren().find($isTocNode);
  if (first && first !== node) node.remove();
}
