import {
  $createParagraphNode,
  $getDocument,
  $getSiblingCaret,
  $isElementNode,
  $rewindSiblingCaret,
  booleanValue,
  type EditorConfig,
  ElementNode,
  IS_CHROME,
  IS_FIREFOX,
  nodeSchema,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type RangeSelection,
} from 'lexical';

/**
 * "Hỏi đáp" (FAQ): a question that opens to show its answer. Ported from the Lexical playground's
 * CollapsibleExtension (v0.52.0) with the same JSON types, but the question holds its words directly (the
 * site's schema: `collapsible-title` takes inline content only) and the class names match the public page
 * (details.faq > summary + .faq-body), so the editor looks like the post.
 */

/** Width of the chevron at the right of the question: a click there opens or closes the answer. */
const TOGGLE_ZONE = 48;

const containerSchema = nodeSchema<CollapsibleContainerNode>()({ open: booleanValue() });

/** Chrome and Firefox do not edit well inside <details> (Lexical #5582, #8348): a div stands in there. */
const usesDiv = () => IS_CHROME || IS_FIREFOX;

function setAnswerVisible(content: HTMLElement, open: boolean) {
  if (open) content.removeAttribute('hidden');
  else content.setAttribute('hidden', 'until-found');
}

export class CollapsibleContainerNode extends ElementNode {
  __open: boolean;

  constructor(open: boolean = false, key?: NodeKey) {
    super(key);
    this.__open = open;
  }

  $config() {
    return this.config('collapsible-container', { extends: ElementNode, json: containerSchema });
  }

  static clone(node: CollapsibleContainerNode): CollapsibleContainerNode {
    return new CollapsibleContainerNode(node.__open, node.__key);
  }

  isShadowRoot(): boolean {
    return true;
  }

  canIndent(): false {
    return false;
  }

  /** Backspace at the very start: the FAQ turns back into ordinary paragraphs. */
  collapseAtStart(): boolean {
    const nodes: LexicalNode[] = [];
    for (const child of this.getChildren()) {
      if ($isCollapsibleTitleNode(child)) nodes.push($createParagraphNode().append(...child.getChildren()));
      else if ($isElementNode(child)) nodes.push(...child.getChildren());
    }
    $rewindSiblingCaret($getSiblingCaret(this, 'previous')).splice(1, nodes);
    nodes[0]?.selectStart();
    return true;
  }

  createDOM(_config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const doc = $getDocument();
    if (usesDiv()) {
      const div = doc.createElement('div');
      if (this.__open) div.setAttribute('open', '');
      div.className = 'faq';
      return div;
    }
    const details = doc.createElement('details');
    details.open = this.__open;
    details.className = 'faq';
    details.addEventListener('toggle', () => {
      const open = editor.read('latest', () => this.getLatest().getOpen());
      if (open !== details.open) editor.update(() => this.getLatest().toggleOpen());
    });
    return details;
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    const open = this.__open;
    if (prevNode.__open === open) return false;
    if (dom instanceof HTMLDetailsElement) {
      dom.open = open;
      return false;
    }
    if (open) dom.setAttribute('open', '');
    else dom.removeAttribute('open');
    const content = dom.querySelector<HTMLElement>(':scope > .faq-body');
    if (content) setAnswerVisible(content, open);
    return false;
  }

  getOpen(): boolean {
    return this.getLatest().__open;
  }

  setOpen(open: boolean): this {
    const self = this.getWritable();
    self.__open = open;
    return self;
  }

  toggleOpen(): this {
    return this.setOpen(!this.getOpen());
  }
}

/** The question. Enter moves to the answer; a click on the chevron opens or closes it. */
export class CollapsibleTitleNode extends ElementNode {
  $config() {
    return this.config('collapsible-title', { extends: ElementNode });
  }

  canIndent(): false {
    return false;
  }

  createDOM(_config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const summary = $getDocument().createElement('summary');
    summary.addEventListener('click', (event) => {
      // Clicking the words places the caret; only the chevron toggles.
      if (event.clientX < summary.getBoundingClientRect().right - TOGGLE_ZONE) {
        event.preventDefault();
        return;
      }
      if (!usesDiv()) return;
      editor.update(() => {
        const container = this.getLatest().getParent();
        if ($isCollapsibleContainerNode(container)) container.toggleOpen();
      });
    });
    return summary;
  }

  updateDOM(): boolean {
    return false;
  }

  insertNewAfter(_selection: RangeSelection, restoreSelection = true): ElementNode {
    const container = this.getParent();
    const content = this.getNextSibling();
    if ($isCollapsibleContainerNode(container) && container.getOpen() && $isCollapsibleContentNode(content)) {
      const first = content.getFirstChild();
      if ($isElementNode(first)) return first;
      const paragraph = $createParagraphNode();
      content.append(paragraph);
      return paragraph;
    }
    const paragraph = $createParagraphNode();
    (container ?? this).insertAfter(paragraph, restoreSelection);
    return paragraph;
  }
}

/** The answer: any content block except columns, another FAQ, a table or the contents. */
export class CollapsibleContentNode extends ElementNode {
  $config() {
    return this.config('collapsible-content', { extends: ElementNode });
  }

  isShadowRoot(): boolean {
    return true;
  }

  canIndent(): false {
    return false;
  }

  createDOM(_config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const div = $getDocument().createElement('div');
    div.className = 'faq-body';
    if (!usesDiv()) return div;
    editor.read('latest', () => {
      const container = this.getParent();
      if ($isCollapsibleContainerNode(container) && !container.getOpen()) setAnswerVisible(div, false);
    });
    // Find in page (Ctrl+F) opens a closed answer that holds the match.
    div.addEventListener('beforematch', () =>
      editor.update(() => {
        const container = this.getLatest().getParent();
        if ($isCollapsibleContainerNode(container) && !container.getOpen()) container.setOpen(true);
      }),
    );
    return div;
  }

  updateDOM(): boolean {
    return false;
  }
}

export function $createCollapsibleContainerNode(open: boolean): CollapsibleContainerNode {
  return new CollapsibleContainerNode(open);
}
export const $createCollapsibleTitleNode = () => new CollapsibleTitleNode();
export const $createCollapsibleContentNode = () => new CollapsibleContentNode();

export const $isCollapsibleContainerNode = (node: LexicalNode | null | undefined): node is CollapsibleContainerNode =>
  node instanceof CollapsibleContainerNode;
export const $isCollapsibleTitleNode = (node: LexicalNode | null | undefined): node is CollapsibleTitleNode =>
  node instanceof CollapsibleTitleNode;
export const $isCollapsibleContentNode = (node: LexicalNode | null | undefined): node is CollapsibleContentNode =>
  node instanceof CollapsibleContentNode;

/** A new FAQ, open, with an empty question and answer. */
export function $createFaq(): CollapsibleContainerNode {
  return $createCollapsibleContainerNode(true).append(
    $createCollapsibleTitleNode(),
    $createCollapsibleContentNode().append($createParagraphNode()),
  );
}
