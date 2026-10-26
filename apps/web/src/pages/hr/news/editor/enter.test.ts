import { $createHeadingNode } from '@lexical/rich-text';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestEditor, toJson, typesOf } from './testEditor';

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

describe('Enter in a heading', () => {
  it.each(['h2', 'h3', 'h4'] as const)('should start a normal paragraph after a %s', (tag) => {
    const editor = setup();
    editor.update(
      () => {
        const heading = $createHeadingNode(tag).append($createTextNode('Quyền lợi'));
        $getRoot().clear().append(heading);
        heading.selectEnd();
      },
      { discrete: true },
    );

    editor.update(
      () => {
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
      },
      { discrete: true },
    );

    expect(typesOf(toJson(editor).root.children)).toEqual(['heading', 'paragraph']);
  });

  it('should start a paragraph when the heading ends with a line break (Shift+Enter, pasted text)', () => {
    // Regression: Lexical compared the caret with the heading's last node (the <br>) and kept a heading.
    const editor = setup();
    editor.update(
      () => {
        const text = $createTextNode('Quyền lợi');
        const heading = $createHeadingNode('h2').append(text, $createLineBreakNode());
        $getRoot().clear().append(heading);
        text.selectEnd();
      },
      { discrete: true },
    );

    editor.update(
      () => {
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
      },
      { discrete: true },
    );
    const [heading, next] = toJson(editor).root.children;

    expect(next.type).toBe('paragraph');
    expect(typesOf(heading.children)).toEqual(['text']);
  });

  it('should start a paragraph when the caret sits on the heading itself, after its words', () => {
    const editor = setup();
    editor.update(
      () => {
        const heading = $createHeadingNode('h3').append($createTextNode('Lộ trình'));
        $getRoot().clear().append(heading);
        heading.select(1, 1);
      },
      { discrete: true },
    );

    editor.update(
      () => {
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
      },
      { discrete: true },
    );

    expect(typesOf(toJson(editor).root.children)).toEqual(['heading', 'paragraph']);
  });

  it('should still split a heading when Enter is pressed in the middle', () => {
    const editor = setup();
    editor.update(
      () => {
        const text = $createTextNode('Quyền lợi');
        $getRoot().clear().append($createHeadingNode('h2').append(text));
        text.select(5, 5);
      },
      { discrete: true },
    );

    editor.update(
      () => {
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
      },
      { discrete: true },
    );

    expect(toJson(editor).root.children.map((c: { tag?: string }) => c.tag)).toEqual(['h2', 'h2']);
  });
});

describe('Enter in a heading, leftovers', () => {
  const enter = (editor: LexicalEditor) =>
    editor.update(
      () => {
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
      },
      { discrete: true },
    );
  const typeText = (editor: LexicalEditor, text: string) =>
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText(text);
      },
      { discrete: true },
    );

  it('should not carry the bold of the heading into the new paragraph', () => {
    const editor = setup();
    editor.update(
      () => {
        const bold = $createTextNode('đậm').setFormat('bold');
        $getRoot()
          .clear()
          .append($createHeadingNode('h2').append($createTextNode('Tiêu đề '), bold));
        bold.selectEnd();
      },
      { discrete: true },
    );

    enter(editor);
    typeText(editor, 'thường');
    const [, paragraph] = toJson(editor).root.children;

    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children[0]).toMatchObject({ text: 'thường', format: 0, style: '' });
  });

  it('should drop a line break left at the end of the heading (Shift+Enter then Enter)', () => {
    const editor = setup();
    editor.update(
      () => {
        const heading = $createHeadingNode('h2').append($createTextNode('Tiêu đề'), $createLineBreakNode());
        $getRoot().clear().append(heading);
        heading.selectEnd();
      },
      { discrete: true },
    );

    enter(editor);
    const [heading, next] = toJson(editor).root.children;

    expect(typesOf(heading.children)).toEqual(['text']);
    expect(next.type).toBe('paragraph');
  });

  it('should turn an empty heading into a paragraph instead of leaving it behind', () => {
    const editor = setup();
    editor.update(
      () => {
        const heading = $createHeadingNode('h2');
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createTextNode('Trên')), heading);
        heading.select();
      },
      { discrete: true },
    );

    enter(editor);
    typeText(editor, 'chữ');

    expect(toJson(editor).root.children.map((c: { type: string }) => c.type)).toEqual(['paragraph', 'paragraph']);
    expect(toJson(editor).root.children[1].children[0].text).toBe('chữ');
  });
});
