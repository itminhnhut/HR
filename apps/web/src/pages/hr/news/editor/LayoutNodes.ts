import { LAYOUT_COLUMNS } from '@careers/shared';
import {
  $createParagraphNode,
  $getDocument,
  $isParagraphNode,
  ElementNode,
  nodeSchema,
  stringValue,
  type LexicalNode,
  type NodeKey,
} from 'lexical';
import { columnCount } from './rules';

/**
 * "Bố cục cột": side-by-side columns, ported from the Lexical playground's LayoutContainerNode and
 * LayoutItemNode (v0.52.0). The widths are one of LAYOUT_COLUMNS and show as the same classes as the public
 * page (`layout cols-1-3` > `layout-item`), so the columns collapse to one on phones in the editor too.
 */

const layoutClass = (template: string) => `layout ${LAYOUT_COLUMNS[template] ?? 'cols-1-1'}`;

const containerSchema = nodeSchema<LayoutContainerNode>()({ templateColumns: stringValue() });

export class LayoutContainerNode extends ElementNode {
  __templateColumns: string;

  constructor(templateColumns: string = '', key?: NodeKey) {
    super(key);
    this.__templateColumns = templateColumns;
  }

  $config() {
    return this.config('layout-container', { extends: ElementNode, json: containerSchema });
  }

  static clone(node: LayoutContainerNode): LayoutContainerNode {
    return new LayoutContainerNode(node.__templateColumns, node.__key);
  }

  createDOM(): HTMLElement {
    const div = $getDocument().createElement('div');
    div.className = layoutClass(this.__templateColumns);
    return div;
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    if (prevNode.__templateColumns !== this.__templateColumns) dom.className = layoutClass(this.__templateColumns);
    return false;
  }

  isShadowRoot(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canIndent(): false {
    return false;
  }

  getTemplateColumns(): string {
    return this.getLatest().__templateColumns;
  }

  setTemplateColumns(templateColumns: string): this {
    const self = this.getWritable();
    self.__templateColumns = templateColumns;
    return self;
  }
}

const isEmptyItem = (node: LexicalNode) =>
  $isLayoutItemNode(node) &&
  node.getChildrenSize() === 1 &&
  $isParagraphNode(node.getFirstChild()) &&
  node.getTextContentSize() === 0;

export class LayoutItemNode extends ElementNode {
  $config() {
    return this.config('layout-item', { extends: ElementNode });
  }

  createDOM(): HTMLElement {
    const div = $getDocument().createElement('div');
    div.className = 'layout-item';
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  canIndent(): false {
    return false;
  }

  /** Backspace at the start of empty columns removes them. */
  collapseAtStart(): boolean {
    const parent = this.getParent();
    if (!parent || !this.is(parent.getFirstChild()) || !parent.getChildren().every(isEmptyItem)) return false;
    parent.remove();
    return true;
  }

  isShadowRoot(): boolean {
    return true;
  }
}

export const $isLayoutContainerNode = (node: LexicalNode | null | undefined): node is LayoutContainerNode =>
  node instanceof LayoutContainerNode;
export const $isLayoutItemNode = (node: LexicalNode | null | undefined): node is LayoutItemNode =>
  node instanceof LayoutItemNode;

export const $createLayoutItemNode = () => new LayoutItemNode().append($createParagraphNode());

/** New columns for one of LAYOUT_COLUMNS, each with an empty paragraph. */
export function $createLayout(template: string): LayoutContainerNode {
  const container = new LayoutContainerNode(template);
  for (let i = 0; i < columnCount(template); i++) container.append($createLayoutItemNode());
  return container;
}
