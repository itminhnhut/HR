import { renderArticle } from '@careers/shared';
import { $insertGeneratedNodes } from '@lexical/clipboard';
import { buildEditorFromExtensions } from '@lexical/extension';
import { $generateNodesFromDOMViaExtension } from '@lexical/html';
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { articleEditorExtension } from './extension';
import { isAccepted, toJson } from './testEditor';

let editor: (LexicalEditor & { dispose: () => void }) | null = null;
afterEach(() => {
  editor?.dispose();
  editor = null;
});

const docsItem = (level: number, text: string) =>
  `<li dir="ltr" aria-level="${level}" style="list-style-type:disc;"><p dir="ltr" role="presentation">` +
  `<span style="font-size:11pt;">${text}</span></p></li>`;

/** What Google Docs puts on the clipboard: everything inside <b id="docs-internal-guid-…">, lists flat. */
const googleDocsHtml = (items: string) =>
  '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c4d">' +
  '<h1 dir="ltr"><span style="font-size:20pt;font-family:Arial">Tiêu đề Docs</span></h1>' +
  `<ul style="margin-top:0;margin-bottom:0;">${items}</ul></b>`;

const GOOGLE_DOCS_HTML = googleDocsHtml(docsItem(1, 'Cấp một') + docsItem(2, 'Cấp hai'));

interface Shape {
  type: string;
  tag?: string;
  text?: string;
  children?: Shape[];
}

/** h2("x"), list(listitem("x"),…): the structure only, without indent or styles. */
function shape(node: Shape): string {
  if (node.type === 'text') return JSON.stringify(node.text);
  const name = node.tag ?? node.type;
  return `${name}(${(node.children ?? []).map(shape).join(',')})`;
}

function pasteHtml(target: LexicalEditor, html: string) {
  target.update(
    () => {
      const paragraph = $createParagraphNode();
      $getRoot().clear().append(paragraph);
      const dom = new DOMParser().parseFromString(html, 'text/html');
      const selection = paragraph.select();
      $insertGeneratedNodes(target, $generateNodesFromDOMViaExtension(dom), selection);
    },
    { discrete: true },
  );
}

describe('pasting from Google Docs', () => {
  it('should turn the Docs title into a big heading and an aria-level 2 item into a nested list', () => {
    // Arrange
    editor = buildEditorFromExtensions(articleEditorExtension(undefined));

    // Act
    pasteHtml(editor, GOOGLE_DOCS_HTML);
    const state = toJson(editor);

    // Assert
    const blocks = (state.root.children as Shape[]).map(shape);
    expect(blocks[0]).toBe('h2("Tiêu đề Docs")');
    expect(blocks[1]).toBe('ul(listitem("Cấp một"),listitem(ul(listitem("Cấp hai"))))');
    expect(isAccepted(state).ok).toBe(true);
  });

  it('should save and publish a nested list as plain nested lists, its nesting level kept as indent', () => {
    // Arrange: four levels, the deepest the site shows
    editor = buildEditorFromExtensions(articleEditorExtension(undefined));
    const items = [1, 2, 3, 4].map((level) => docsItem(level, `L${level}`)).join('');

    // Act
    pasteHtml(editor, googleDocsHtml(items));
    const state = toJson(editor);
    const checked = isAccepted(state);
    const html = checked.ok ? renderArticle(checked.value).html : '';

    // Assert: Lexical writes a nested item's depth as its indent (1, 2, 3); the API accepts it and the
    // page renders bare nested <ul>s, with no indent class on any item.
    expect(JSON.stringify(state)).toMatch(/"indent":3/);
    expect(checked.ok).toBe(true);
    expect(html).toContain(
      '<ul><li>L1</li><li><ul><li>L2</li><li><ul><li>L3</li><li><ul><li>L4</li></ul></li></ul></li></ul></li></ul>',
    );
    expect(html).not.toContain('indent-');
  });
});
