import { numberHeadings, type ArticleHeadingRef, type NumberedHeading } from '@careers/shared';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { TableOfContentsPlugin, type TableOfContentsEntry } from '@lexical/react/LexicalTableOfContentsPlugin';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';
import type { JSX } from 'react';
import { BarButton, BlockBar } from './BlockBar';
import { MOVE_TOC_COMMAND } from './commands';

/**
 * "Mục lục" placed by HR, stored as { type: 'toc' }. On the site renderArticle lists every H2/H3/H4 of the
 * post there, numbered 1 → 1.1 → 1.1.1; in the editor the same list stays live (Lexical's TableOfContentsPlugin) and a click scrolls
 * to that heading. A post holds one at most, always at the top level.
 */

const smooth = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

function scrollToHeading(editor: LexicalEditor, key: NodeKey) {
  editor.getElementByKey(key)?.scrollIntoView({ behavior: smooth(), block: 'center' });
}

interface TocItem {
  heading: NumberedHeading;
  children: TocItem[];
}

/** The numbered headings as a tree (the same nesting as renderArticle's list on the post page). */
function toTree(headings: NumberedHeading[]): TocItem[] {
  const roots: TocItem[] = [];
  const path: TocItem[] = [];
  for (const heading of headings) {
    const item: TocItem = { heading, children: [] };
    path.length = heading.depth;
    const parent = path[heading.depth - 1];
    if (parent) parent.children.push(item);
    else roots.push(item);
    path[heading.depth] = item;
  }
  return roots;
}

function TocList({ items, editor }: { items: TocItem[]; editor: LexicalEditor }) {
  return (
    <ol>
      {items.map(({ heading, children }) => (
        <li key={heading.id}>
          <button type="button" onClick={() => scrollToHeading(editor, heading.id)}>
            <span className="toc-num">{heading.number}</span>
            {heading.label.trim() || '(tiêu đề trống)'}
          </button>
          {children.length > 0 && <TocList items={children} editor={editor} />}
        </li>
      ))}
    </ol>
  );
}

const LEVELS: Partial<Record<string, ArticleHeadingRef['level']>> = { h2: 2, h3: 3, h4: 4 };

function TocEntries({ entries, editor }: { entries: TableOfContentsEntry[]; editor: LexicalEditor }) {
  // An empty heading (being typed, or left by mistake) is not a section: it is not listed.
  const headings = entries.flatMap(([key, text, tag]) => {
    const level = LEVELS[tag];
    return level && text.trim() ? [{ id: key, text, level }] : [];
  });
  if (headings.length === 0) {
    return (
      <p className="toc-empty">
        Chưa có tiêu đề. Mục lục sẽ liệt kê các tiêu đề H2, H3, H4 của bài, đánh số 1, 1.1, 1.1.1.
      </p>
    );
  }
  return <TocList items={toTree(numberHeadings(headings))} editor={editor} />;
}

function TocView({ nodeKey }: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  return (
    <div className={isSelected ? 'is-selected' : ''}>
      <nav className="toc" aria-label="Mục lục">
        <p className="toc-title">Mục lục</p>
        <TableOfContentsPlugin>
          {(entries, tocEditor) => <TocEntries entries={entries} editor={tocEditor} />}
        </TableOfContentsPlugin>
      </nav>
      <BlockBar label="Mục lục tự cập nhật theo các tiêu đề của bài">
        <BarButton
          label="Đưa lên"
          onClick={() => editor.dispatchCommand(MOVE_TOC_COMMAND, { key: nodeKey, direction: 'up' })}
        >
          ↑
        </BarButton>
        <BarButton
          label="Đưa xuống"
          onClick={() => editor.dispatchCommand(MOVE_TOC_COMMAND, { key: nodeKey, direction: 'down' })}
        >
          ↓
        </BarButton>
        <BarButton
          onClick={() => {
            clearSelection();
            setSelected(true);
          }}
        >
          Chọn
        </BarButton>
        <BarButton tone="danger" onClick={() => editor.update(() => $getNodeByKey(nodeKey)?.remove())}>
          Xoá mục lục
        </BarButton>
      </BlockBar>
    </div>
  );
}

export class TocNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return 'toc';
  }

  static clone(node: TocNode): TocNode {
    return new TocNode(node.__key);
  }

  static importJSON(): TocNode {
    return $createTocNode();
  }

  exportJSON(): SerializedLexicalNode {
    return { type: 'toc', version: 1 };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = document.createElement('div');
    const className = config.theme.embedBlock?.base;
    if (typeof className === 'string') el.className = className;
    return el;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getTextContent(): string {
    return '';
  }

  decorate(): JSX.Element {
    return <TocView nodeKey={this.getKey()} />;
  }
}

export function $createTocNode(): TocNode {
  return $applyNodeReplacement(new TocNode());
}

export function $isTocNode(node: LexicalNode | null | undefined): node is TocNode {
  return node instanceof TocNode;
}
