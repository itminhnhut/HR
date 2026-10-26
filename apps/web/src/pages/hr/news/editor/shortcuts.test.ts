import { $createListItemNode, $createListNode } from '@lexical/list';
import { $createTextNode, $getRoot, $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestEditor, toJson } from './testEditor';

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

/** "- " already made a bulleted item; HR goes on typing "[ ] " (or "[x] ") in it. */
function typedInNewBullet(editor: LexicalEditor, typed: string) {
  update(editor, () => {
    const text = $createTextNode(typed);
    $getRoot()
      .clear()
      .append($createListNode('bullet').append($createListItemNode().append(text)));
    text.selectEnd();
  });
}

describe('markdown checklist "- [ ] "', () => {
  it('should turn a new bulleted item into a checklist item when "[ ] " is typed at its start', () => {
    const editor = setup();
    typedInNewBullet(editor, '[ ] ');

    update(editor, () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText('Việc');
    });
    const [list] = toJson(editor).root.children;

    expect(list.listType).toBe('check');
    expect(list.children[0]).toMatchObject({ checked: false });
    expect(list.children[0].children[0].text).toBe('Việc');
  });

  it('should make a checked item from "[x] "', () => {
    const editor = setup();
    typedInNewBullet(editor, '[x] ');

    const [list] = toJson(editor).root.children;

    expect(list.listType).toBe('check');
    expect(list.children[0]).toMatchObject({ checked: true });
  });

  it('should leave "[ ]" alone in the middle of a list item', () => {
    const editor = setup();
    typedInNewBullet(editor, 'Mục [ ] ');

    expect(toJson(editor).root.children[0].listType).toBe('bullet');
  });
});
