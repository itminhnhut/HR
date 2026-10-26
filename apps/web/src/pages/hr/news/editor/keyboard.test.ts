import { $createCodeNode } from '@lexical/code-core';
import { $createListItemNode, $createListNode } from '@lexical/list';
import { $createHeadingNode } from '@lexical/rich-text';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $createTableSelection,
  $isTableCellNode,
} from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_TAB_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestEditor, isAccepted, toJson, typesOf } from './testEditor';
import { $createYouTubeNode } from './YouTubeNode';

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
const key = (name: string, shiftKey = false) => new KeyboardEvent('keydown', { key: name, shiftKey });
const press = (editor: LexicalEditor, name: 'Tab' | 'Backspace' | 'Delete', shiftKey = false) =>
  update(editor, () => {
    const command = { Tab: KEY_TAB_COMMAND, Backspace: KEY_BACKSPACE_COMMAND, Delete: KEY_DELETE_COMMAND }[name];
    editor.dispatchCommand(command, key(name, shiftKey));
  });
const para = (text: string) => $createParagraphNode().append($createTextNode(text));

/** Short form of the article: p("x"), li(...), code(...). */
function shape(node: { type: string; text?: string; children?: unknown[] }): string {
  if (node.type === 'text') return JSON.stringify(node.text);
  if (node.type === 'tab' || node.type === 'linebreak') return node.type;
  const kids = (node.children ?? []) as { type: string }[];
  return `${node.type}(${kids.map(shape).join(',')})`;
}
const doc = (editor: LexicalEditor) => toJson(editor).root.children.map(shape).join(' | ');

describe('Tab', () => {
  it('should nest a list item wherever the caret is, and Shift+Tab should take it back out', () => {
    const editor = setup();
    update(editor, () => {
      const second = $createTextNode('Hai');
      const list = $createListNode('bullet').append(
        $createListItemNode().append($createTextNode('Một')),
        $createListItemNode().append(second),
      );
      $getRoot().clear().append(list);
      second.selectEnd();
    });

    press(editor, 'Tab');
    const nested = doc(editor);
    press(editor, 'Tab', true);

    expect(nested).toBe('list(listitem("Một"),listitem(list(listitem("Hai"))))');
    expect(doc(editor)).toBe('list(listitem("Một"),listitem("Hai"))');
  });

  it('should insert a tab inside a code block instead of leaving the editor', () => {
    const editor = setup();
    update(editor, () => {
      const text = $createTextNode('if (a) {');
      $getRoot().clear().append($createCodeNode().append(text));
      text.selectEnd();
    });

    press(editor, 'Tab');

    expect(doc(editor)).toBe('code("if (a) {",tab)');
  });

  it('should indent a paragraph when the caret is at its start', () => {
    const editor = setup();
    update(editor, () => {
      const text = $createTextNode('Đoạn văn');
      $getRoot().clear().append($createParagraphNode().append(text));
      text.select(0, 0);
    });

    press(editor, 'Tab');

    expect(toJson(editor).root.children[0].indent).toBe(1);
  });

  it('should insert a tab when the caret is inside the words', () => {
    const editor = setup();
    update(editor, () => {
      const text = $createTextNode('Đoạn văn');
      $getRoot().clear().append($createParagraphNode().append(text));
      text.select(5, 5);
    });

    press(editor, 'Tab');

    expect(doc(editor)).toBe('paragraph("Đoạn ",tab,"văn")');
  });
});

describe('Backspace and Delete next to a video, picture or divider', () => {
  function videoBetween(editor: LexicalEditor) {
    update(editor, () => {
      const after = para('Dưới');
      $getRoot().clear().append(para('Trên'), $createYouTubeNode('dQw4w9WgXcQ'), after);
      after.selectStart();
    });
  }

  it('should select the video on the first Backspace and remove it on the second', () => {
    const editor = setup();
    videoBetween(editor);

    press(editor, 'Backspace');
    const selected = editor.read(() => $isNodeSelection($getSelection()));
    const first = typesOf(toJson(editor).root.children);
    press(editor, 'Backspace');

    expect(selected).toBe(true);
    expect(first).toEqual(['paragraph', 'youtube', 'paragraph']);
    expect(doc(editor)).toBe('paragraph("Trên") | paragraph("Dưới")');
  });

  it('should select the video on Delete at the end of the paragraph above it', () => {
    const editor = setup();
    update(editor, () => {
      const before = para('Trên');
      $getRoot().clear().append(before, $createYouTubeNode('dQw4w9WgXcQ'), para('Dưới'));
      before.selectEnd();
    });

    press(editor, 'Delete');

    expect(editor.read(() => $isNodeSelection($getSelection()))).toBe(true);
    expect(typesOf(toJson(editor).root.children)).toEqual(['paragraph', 'youtube', 'paragraph']);
  });
});

describe('Backspace at the start of a heading', () => {
  it('should turn the first heading of the article into a paragraph', () => {
    const editor = setup();
    update(editor, () => {
      const heading = $createHeadingNode('h2').append($createTextNode('Đầu bài'));
      $getRoot().clear().append(heading, para('x'));
      heading.selectStart();
    });

    press(editor, 'Backspace');

    expect(doc(editor)).toBe('paragraph("Đầu bài") | paragraph("x")');
  });

  it('should still join a heading to the paragraph above it', () => {
    const editor = setup();
    update(editor, () => {
      const heading = $createHeadingNode('h2').append($createTextNode('Tiêu đề'));
      $getRoot().clear().append(para('Trên'), heading);
      heading.selectStart();
    });

    press(editor, 'Backspace');

    expect(typesOf(toJson(editor).root.children)).toEqual(['paragraph']);
  });
});

describe('Backspace on selected table cells', () => {
  it('should empty every selected cell and keep the table, even when all cells are selected', () => {
    const editor = setup();
    update(editor, () => {
      const rows = [0, 1].map((r) =>
        $createTableRowNode().append(...[0, 1, 2].map((c) => $createTableCellNode().append(para(`r${r}c${c}`)))),
      );
      const table = $createTableNode().append(...rows);
      $getRoot().clear().append(table, para('sau'));
      const cells = table.getAllTextNodes().map((t) => t.getParent()?.getParent());
      const [first, last] = [cells[0], cells.at(-1)];
      if (!$isTableCellNode(first) || !$isTableCellNode(last)) throw new Error('no cells');
      const selection = $createTableSelection();
      selection.set(table.getKey(), first.getKey(), last.getKey());
      $setSelection(selection);
    });

    press(editor, 'Backspace');
    const state = toJson(editor);

    expect(typesOf(state.root.children)).toEqual(['table', 'paragraph']);
    expect(JSON.stringify(state)).not.toMatch(/r\dc\d/);
    expect(isAccepted(state).ok).toBe(true);
  });
});
