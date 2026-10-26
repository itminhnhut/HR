import { renderArticle, type ArticleState } from '@careers/shared';
import { $createCodeNode } from '@lexical/code-core';
import { $createListItemNode, $createListNode } from '@lexical/list';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createTableCellNode, $createTableNode, $createTableRowNode } from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  INDENT_CONTENT_COMMAND,
  type ElementNode,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { $createCollapsibleTitleNode, $createFaq } from './CollapsibleNodes';
import { INSERT_CODE_COMMAND, INSERT_FAQ_COMMAND, INSERT_LAYOUT_COMMAND } from './commands';
import { $createArticleImageNode } from './ImageNode';
import { $createLayout } from './LayoutNodes';
import { createTestEditor, isAccepted, toJson, typesOf } from './testEditor';
import { $createTocNode } from './TocNode';

let cleanup: (() => void) | null = null;

function setup(): LexicalEditor {
  const { editor, dispose } = createTestEditor();
  cleanup = dispose;
  return editor;
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const update = (editor: LexicalEditor, fn: () => void) => editor.update(fn, { discrete: true });
const para = (text: string) => $createParagraphNode().append($createTextNode(text));
const image = () => $createArticleImageNode({ src: 'https://x.test/a.jpg', altText: 'Ảnh', width: 10, height: 5 });
const rootTypes = (editor: LexicalEditor) => typesOf(toJson(editor).root.children);

/** Puts the caret at the end of a paragraph holding `text`, alone in the article. */
function startWith(editor: LexicalEditor, text: string) {
  update(editor, () => {
    const paragraph = para(text);
    $getRoot().clear().append(paragraph);
    paragraph.selectEnd();
  });
}

describe('new editor blocks', () => {
  it('should save contents, FAQ, columns, checklist, code, indent and text formats as the API accepts them', () => {
    // Arrange
    const editor = setup();

    // Act
    update(editor, () => {
      const faq = $createFaq();
      faq.getFirstChildOrThrow<ElementNode>().append($createTextNode('Có cần kinh nghiệm không?'));
      const checklist = $createListNode('check').append(
        $createListItemNode(true).append($createTextNode('CCCD')),
        $createListItemNode(false).append($createTextNode('CV')),
      );
      const heading = $createHeadingNode('h3').append($createTextNode('Lộ trình'));
      heading.setIndent(2);
      const formats = $createParagraphNode().append(
        $createTextNode('m'),
        $createTextNode('2').setFormat('superscript'),
        $createTextNode(' top flow').setFormat('uppercase'),
      );
      const code = $createCodeNode().append($createTextNode('npm i'));
      $getRoot().clear().append($createTocNode(), heading, faq, $createLayout('1fr 3fr'), checklist, formats, code);
    });
    const state = toJson(editor);
    const result = isAccepted(state);

    // Assert
    expect(result.ok).toBe(true);
    expect(rootTypes(editor)).toEqual([
      'toc',
      'heading',
      'collapsible-container',
      'layout-container',
      'list',
      'paragraph',
      'code',
    ]);
    expect(state.root.children[0]).toEqual({ type: 'toc', version: 1 });
    expect(state.root.children[2]).toMatchObject({ open: true });
    expect(state.root.children[3]).toMatchObject({ templateColumns: '1fr 3fr' });
    const html = renderArticle((result as { value: ArticleState }).value).html;
    expect(html).toContain('<nav class="toc"');
    expect(html).toContain('<details class="faq"><summary>Có cần kinh nghiệm không?</summary>');
    expect(html).toContain('<div class="layout cols-1-3">');
    expect(html).toContain('<ul class="checklist"><li class="checked" aria-checked="true">CCCD</li>');
    expect(html).toContain('<h3 id="lo-trinh" class="indent-2">');
    expect(html).toContain('<sup>2</sup>');
    expect(html).toContain('<pre class="code-block"><code>npm i</code></pre>');
  });

  it('should move a table, columns, an FAQ and the contents out of a column to the top level', () => {
    const editor = setup();

    update(editor, () => {
      const layout = $createLayout('1fr 1fr');
      const table = $createTableNode().append($createTableRowNode().append($createTableCellNode(0).append(para('ô'))));
      layout
        .getFirstChildOrThrow<ElementNode>()
        .append(table, $createFaq(), $createTocNode(), $createLayout('1fr 1fr'));
      $getRoot().clear().append(layout);
    });
    const state = toJson(editor);

    expect(isAccepted(state).ok).toBe(true);
    expect(rootTypes(editor).sort()).toEqual(
      ['collapsible-container', 'layout-container', 'layout-container', 'table', 'toc'].sort(),
    );
  });

  it('should keep pictures and code blocks inside a column and an FAQ answer', () => {
    const editor = setup();

    update(editor, () => {
      const layout = $createLayout('1fr 1fr');
      layout.getFirstChildOrThrow<ElementNode>().append(image(), $createCodeNode().append($createTextNode('x')));
      const faq = $createFaq();
      faq.getLastChildOrThrow<ElementNode>().append(image());
      $getRoot().clear().append(layout, faq);
    });
    const [layout, faq] = toJson(editor).root.children;

    expect(typesOf(layout.children[0].children)).toEqual(['paragraph', 'article-image', 'code']);
    expect(typesOf(faq.children[1].children)).toEqual(['paragraph', 'article-image']);
  });

  it('should keep the words of a paragraph pasted into an FAQ question', () => {
    const editor = setup();

    update(editor, () => {
      const faq = $createFaq();
      faq.getFirstChildOrThrow<ElementNode>().append(para('Lương thế nào?'));
      $getRoot().clear().append(faq);
    });
    const state = toJson(editor);

    expect(state.root.children[0].children[0].children).toMatchObject([{ type: 'text', text: 'Lương thế nào?' }]);
    expect(isAccepted(state).ok).toBe(true);
  });

  it('should give a question and an answer to an FAQ that lost one', () => {
    const editor = setup();

    update(editor, () => {
      const faq = $createFaq();
      faq.getLastChildOrThrow().remove();
      faq.append(para('lạc'));
      $getRoot().clear().append(faq);
    });
    const faq = toJson(editor).root.children[0];

    expect(typesOf(faq.children)).toEqual(['collapsible-title', 'collapsible-content']);
    expect(faq.children[1].children[0].children[0].text).toBe('lạc');
  });

  it('should turn unknown column widths into equal columns and unwrap a single column', () => {
    const editor = setup();

    update(editor, () => {
      const odd = $createLayout('1fr 1fr 1fr').setTemplateColumns('repeat(3, 1fr)');
      const single = $createLayout('1fr 1fr');
      single.getLastChildOrThrow().remove();
      single.getFirstChildOrThrow<ElementNode>().append(para('một cột'));
      $getRoot().clear().append(odd, single);
    });
    const state = toJson(editor);

    expect(state.root.children[0].templateColumns).toBe('1fr 1fr 1fr');
    expect(rootTypes(editor)).toEqual(['layout-container', 'paragraph', 'paragraph']);
    expect(isAccepted(state).ok).toBe(true);
  });

  it('should drop a second contents block that was pasted', () => {
    const editor = setup();

    update(editor, () => $getRoot().clear().append($createTocNode(), para('giữa'), $createTocNode()));

    expect(rootTypes(editor)).toEqual(['toc', 'paragraph']);
  });
});

describe('insert commands', () => {
  it('should insert an open FAQ with the caret in its question', () => {
    const editor = setup();
    startWith(editor, 'Mở đầu');

    update(editor, () => {
      editor.dispatchCommand(INSERT_FAQ_COMMAND, undefined);
    });
    const state = toJson(editor);

    expect(rootTypes(editor)).toEqual(['paragraph', 'collapsible-container', 'paragraph']);
    expect(state.root.children[1].open).toBe(true);
    expect(isAccepted(state).ok).toBe(true);
  });

  it('should put a new block in place of the empty line the caret is on', () => {
    const editor = setup();
    update(editor, () => {
      const empty = $createParagraphNode();
      $getRoot().clear().append(para('Mở đầu'), empty);
      empty.select();
    });

    update(editor, () => {
      editor.dispatchCommand(INSERT_FAQ_COMMAND, undefined);
    });

    expect(rootTypes(editor)).toEqual(['paragraph', 'collapsible-container', 'paragraph']);
    expect(toJson(editor).root.children[0].children[0].text).toBe('Mở đầu');
  });

  it('should insert the chosen columns, one empty paragraph in each', () => {
    const editor = setup();
    startWith(editor, 'Mở đầu');

    update(editor, () => {
      editor.dispatchCommand(INSERT_LAYOUT_COMMAND, '1fr 2fr 1fr');
    });
    const layout = toJson(editor).root.children[1];

    expect(layout).toMatchObject({ type: 'layout-container', templateColumns: '1fr 2fr 1fr' });
    expect(layout.children.map((c: { children: { type: string }[] }) => typesOf(c.children))).toEqual([
      ['paragraph'],
      ['paragraph'],
      ['paragraph'],
    ]);
  });

  it('should refuse a column layout the site does not offer', () => {
    const editor = setup();
    startWith(editor, 'Mở đầu');

    update(editor, () => {
      editor.dispatchCommand(INSERT_LAYOUT_COMMAND, '5fr 1fr');
    });

    expect(rootTypes(editor)).toEqual(['paragraph']);
  });

  it('should put a new FAQ after the columns when the caret is in a column', () => {
    const editor = setup();
    update(editor, () => {
      const layout = $createLayout('1fr 1fr');
      $getRoot().clear().append(layout, para('sau'));
      layout.selectStart();
    });

    update(editor, () => {
      editor.dispatchCommand(INSERT_FAQ_COMMAND, undefined);
    });

    expect(rootTypes(editor)).toEqual(['layout-container', 'collapsible-container', 'paragraph']);
  });

  it('should turn the paragraph at the caret into a code block', () => {
    const editor = setup();
    startWith(editor, 'console.log(1)');

    update(editor, () => {
      editor.dispatchCommand(INSERT_CODE_COMMAND, undefined);
    });
    const [code] = toJson(editor).root.children;

    expect(code.type).toBe('code');
    expect(code.children[0].text).toBe('console.log(1)');
  });

  it('should not indent a paragraph past 4 steps', () => {
    const editor = setup();
    startWith(editor, 'Thụt');

    for (let i = 0; i < 6; i++) {
      update(editor, () => {
        editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
      });
    }

    expect(toJson(editor).root.children[0].indent).toBe(4);
  });

  it('should keep a question node out of the article when it is not in an FAQ', () => {
    const editor = setup();

    update(editor, () =>
      $getRoot()
        .clear()
        .append($createCollapsibleTitleNode().append($createTextNode('lạc'))),
    );

    expect(rootTypes(editor)).toEqual(['paragraph']);
  });
});
