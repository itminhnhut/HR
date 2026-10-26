import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, type BaseSelection } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { $isSelectionUsable } from './selectionGuard';
import { createTestEditor } from './testEditor';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('restoring a saved selection', () => {
  it('should refuse a selection whose text was split after it was saved', () => {
    // Arrange: "một hai ba" with "hai" selected, saved as a toolbar box takes focus
    const { editor, dispose } = createTestEditor();
    cleanup = dispose;
    let saved: BaseSelection | null = null;
    editor.update(
      () => {
        const text = $createTextNode('một hai ba');
        $getRoot().clear().append($createParagraphNode().append(text));
        text.select(4, 7);
        saved = $getSelection()?.clone() ?? null;
      },
      { discrete: true },
    );

    // Act: a size is applied, which splits the text into "một ", "hai" (sized), " ba"
    editor.update(
      () => {
        const [, middle] = $getRoot().getAllTextNodes()[0]?.splitText(4, 7) ?? [];
        middle?.setStyle('font-size: 24px;');
      },
      { discrete: true },
    );
    const usable = editor.read(() => (saved ? $isSelectionUsable(saved) : null));
    const fresh = editor.read(() => {
      const selection = $getSelection();
      return selection ? $isSelectionUsable(selection) : null;
    });

    // Assert
    expect(usable).toBe(false);
    expect(fresh).toBe(true);
  });
});
