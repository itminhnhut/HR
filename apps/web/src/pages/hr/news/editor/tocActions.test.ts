import { $createHeadingNode } from '@lexical/rich-text';
import {
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  KEY_ARROW_DOWN_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { INSERT_TOC_COMMAND, MOVE_TOC_COMMAND, SHOW_STATUS_COMMAND, type EditorStatus } from './commands';
import { createTestEditor, toJson, typesOf } from './testEditor';
import { TOC_FLASH_CLASS } from './tocActions';
import { $createTocNode, $isTocNode } from './TocNode';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function setup(withDom = false): { editor: LexicalEditor; messages: (EditorStatus | null)[] } {
  const { editor, dispose } = createTestEditor();
  const messages: (EditorStatus | null)[] = [];
  const stop = editor.registerCommand(SHOW_STATUS_COMMAND, (s) => messages.push(s) > 0, COMMAND_PRIORITY_EDITOR);
  if (withDom) editor.setRootElement(document.body.appendChild(document.createElement('div')));
  cleanup = () => {
    stop();
    dispose();
    editor.setRootElement(null);
  };
  return { editor, messages };
}

const update = (editor: LexicalEditor, fn: () => void) => editor.update(fn, { discrete: true });
const para = (text: string) => $createParagraphNode().append($createTextNode(text));
const heading = (text: string) => $createHeadingNode('h2').append($createTextNode(text));
const rootTypes = (editor: LexicalEditor) => typesOf(toJson(editor).root.children);
const insertToc = (editor: LexicalEditor) =>
  update(editor, () => {
    editor.dispatchCommand(INSERT_TOC_COMMAND, undefined);
  });

describe('Chèn → Mục lục', () => {
  it('should place the contents right before the first heading even with the caret at the end', () => {
    // Arrange
    const { editor, messages } = setup();
    update(editor, () => {
      const last = para('Kết bài');
      $getRoot().clear().append(para('Mở đầu'), heading('Quyền lợi'), para('…'), heading('Lộ trình'), last);
      last.selectEnd();
    });

    // Act
    insertToc(editor);

    // Assert
    expect(rootTypes(editor)).toEqual(['paragraph', 'toc', 'heading', 'paragraph', 'heading', 'paragraph']);
    expect(messages).toEqual([{ tone: 'info', text: 'Đã chèn mục lục trước tiêu đề đầu tiên.' }]);
  });

  it('should place the contents at the very top when the article has no heading yet', () => {
    const { editor, messages } = setup();
    update(editor, () => {
      const last = para('b');
      $getRoot().clear().append(para('a'), last);
      last.selectEnd();
    });

    insertToc(editor);

    expect(rootTypes(editor)).toEqual(['toc', 'paragraph', 'paragraph']);
    expect(messages[0]?.text).toBe('Đã chèn mục lục ở đầu bài.');
  });

  it('should not add a second contents block but show and flash the one there is', () => {
    // Arrange
    const { editor, messages } = setup(true);
    update(editor, () => {
      const last = para('cuối');
      $getRoot().clear().append(heading('A'), $createTocNode(), last);
      last.selectEnd();
    });

    // Act
    insertToc(editor);

    // Assert
    expect(rootTypes(editor)).toEqual(['heading', 'toc', 'paragraph']);
    expect(messages[0]?.text).toMatch(/đã có mục lục/);
    const tocKey = editor.read(() => $getRoot().getChildren().find($isTocNode)?.getKey() ?? '');
    expect(editor.getElementByKey(tocKey)?.classList.contains(TOC_FLASH_CLASS)).toBe(true);
  });
});

describe('moving the contents block', () => {
  function withToc() {
    const { editor } = setup();
    let key = '';
    update(editor, () => {
      const toc = $createTocNode();
      key = toc.getKey();
      $getRoot().clear().append(para('a'), toc, heading('B'));
    });
    return { editor, key };
  }

  it('should move one block up or down with the ↑ / ↓ buttons', () => {
    const { editor, key } = withToc();

    update(editor, () => {
      editor.dispatchCommand(MOVE_TOC_COMMAND, { key, direction: 'down' });
    });
    expect(rootTypes(editor)).toEqual(['paragraph', 'heading', 'toc']);

    update(editor, () => {
      editor.dispatchCommand(MOVE_TOC_COMMAND, { key, direction: 'up' });
      editor.dispatchCommand(MOVE_TOC_COMMAND, { key, direction: 'up' });
    });
    expect(rootTypes(editor)).toEqual(['toc', 'paragraph', 'heading']);
  });

  it('should move the selected contents block with Alt+↓, and leave plain ↓ to the caret', () => {
    const { editor, key } = withToc();
    const select = () =>
      update(editor, () => {
        const selection = $createNodeSelection();
        selection.add(key);
        $setSelection(selection);
      });
    select();

    update(editor, () => {
      editor.dispatchCommand(KEY_ARROW_DOWN_COMMAND, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(rootTypes(editor)).toEqual(['paragraph', 'toc', 'heading']);

    select();
    update(editor, () => {
      editor.dispatchCommand(KEY_ARROW_DOWN_COMMAND, new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
    });
    expect(rootTypes(editor)).toEqual(['paragraph', 'heading', 'toc']);
  });
});
