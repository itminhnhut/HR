import {
  LexicalComposerContext,
  createLexicalComposerContext,
  type LexicalComposerContextWithEditor,
} from '@lexical/react/LexicalComposerContext';
import { act, renderHook } from '@testing-library/react';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestEditor } from '../testEditor';
import { useKeepSelection } from './primitives';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function setup(): LexicalEditor {
  const { editor, dispose } = createTestEditor();
  cleanup = dispose;
  editor.update(
    () => {
      $getRoot()
        .clear()
        .append($createParagraphNode().append($createTextNode('một hai ba')));
    },
    { discrete: true },
  );
  return editor;
}

const selectWords = (editor: LexicalEditor, from: number, to: number) =>
  editor.update(() => $getRoot().getAllTextNodes()[0]?.select(from, to), { discrete: true });

function renderKeep(editor: LexicalEditor) {
  const context: LexicalComposerContextWithEditor = [editor, createLexicalComposerContext(null, null)];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LexicalComposerContext.Provider value={context}>{children}</LexicalComposerContext.Provider>
  );
  return renderHook(() => useKeepSelection(), { wrapper }).result;
}

/** Runs `keep.run` and returns the selected words its change saw. */
function wordsSeenByRun(keep: ReturnType<typeof useKeepSelection>): string {
  let seen = '';
  act(() =>
    keep.run(() => {
      const selection = $getSelection();
      seen = $isRangeSelection(selection) ? selection.getTextContent() : '';
    }, false),
  );
  return seen;
}

describe('keeping the selection for a toolbar action', () => {
  it('should put back the words selected when the menu opened', () => {
    // Arrange: "hai" selected as a menu opens, then focus moves and the selection becomes "ba"
    const editor = setup();
    const keep = renderKeep(editor);
    selectWords(editor, 4, 7);
    act(() => keep.current.save());
    selectWords(editor, 8, 10);

    // Act
    const seen = wordsSeenByRun(keep.current);

    // Assert
    expect(seen).toBe('hai');
  });

  it('should act where the caret is now on a later action that saved nothing', () => {
    // Arrange: one menu action on "hai", then the writer selects "ba" and presses a table-bar style button
    const editor = setup();
    const keep = renderKeep(editor);
    selectWords(editor, 4, 7);
    act(() => keep.current.save());
    wordsSeenByRun(keep.current);
    selectWords(editor, 8, 10);

    // Act
    const seen = wordsSeenByRun(keep.current);

    // Assert
    expect(seen).toBe('ba');
  });
});
