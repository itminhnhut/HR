import { $createCodeNode } from '@lexical/code-core';
import { $createListItemNode, $createListNode, type ListNode } from '@lexical/list';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { $insertPlainText } from './paste';
import { createTestEditor, isAccepted, toJson, typesOf } from './testEditor';

/**
 * Content the API would refuse (too deep, too long, blocks inside code) is reshaped by the editor itself, so a
 * single paste never stops every autosave.
 */

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function setup(): LexicalEditor {
  const { editor, dispose } = createTestEditor();
  cleanup = dispose;
  return editor;
}

const update = (editor: LexicalEditor, fn: () => void) => editor.update(fn, { discrete: true });
const allText = (editor: LexicalEditor) => editor.read(() => $getRoot().getTextContent());

/** A bulleted list nested `levels` deep: L1 > L2 > … (Lexical's shape: a sub-list in its own item). */
function $nestedList(levels: number): ListNode {
  let list = $createListNode('bullet').append($createListItemNode().append($createTextNode(`L${levels}`)));
  for (let level = levels - 1; level >= 1; level--) {
    list = $createListNode('bullet').append(
      $createListItemNode().append($createTextNode(`L${level}`)),
      $createListItemNode().append(list),
    );
  }
  return list;
}

describe('content the API would refuse', () => {
  it('should split a paragraph longer than 10 000 characters into paragraphs the API accepts', () => {
    const editor = setup();
    const long = 'Nội dung dài. '.repeat(860);

    update(editor, () => {
      $getRoot()
        .clear()
        .append($createParagraphNode().append($createTextNode(long)));
    });
    const state = toJson(editor);

    expect(isAccepted(state).ok).toBe(true);
    expect(typesOf(state.root.children)).toEqual(['paragraph', 'paragraph']);
    expect(allText(editor).replace(/\n/g, '')).toBe(long);
  });

  it('should bring a list pasted 6 levels deep back to the deepest level the site shows', () => {
    const editor = setup();

    update(editor, () => {
      $getRoot().clear().append($nestedList(6));
    });
    const state = toJson(editor);

    expect(isAccepted(state)).toMatchObject({ ok: true });
    for (let level = 1; level <= 6; level++) expect(allText(editor)).toContain(`L${level}`);
  });

  it('should keep only the words of paragraphs and headings that landed inside a code block', () => {
    const editor = setup();

    update(editor, () => {
      $getRoot()
        .clear()
        .append(
          $createCodeNode().append(
            $createTextNode('x'),
            $createParagraphNode().append($createTextNode('đậm').setFormat('bold')),
            $createHeadingNode('h2').append($createTextNode('tiêu đề')),
          ),
        );
    });
    const state = toJson(editor);
    const [code] = state.root.children;

    expect(isAccepted(state).ok).toBe(true);
    expect(code.type).toBe('code');
    expect(typesOf(code.children)).toEqual(['text', 'linebreak', 'text', 'linebreak', 'text']);
    expect(code.children.map((c: { format?: number }) => c.format ?? 0)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('paste into a code block', () => {
  it('should insert the plain text, one line per line', () => {
    const editor = setup();
    update(editor, () => {
      const text = $createTextNode('x');
      $getRoot().clear().append($createCodeNode().append(text));
      text.selectEnd();
    });

    update(editor, () => {
      const selection = $getSelection();
      if (selection) $insertPlainText(selection, 'đậm\ntiêu đề');
    });
    const [code] = toJson(editor).root.children;

    expect(code.type).toBe('code');
    expect(typesOf(code.children)).toEqual(['text', 'linebreak', 'text']);
    expect(allText(editor)).toBe('xđậm\ntiêu đề');
  });
});
