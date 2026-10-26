import { $getRoot } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { $createArticleImageNode, $isArticleImageNode, PENDING_ALT_TEXT } from './ImageNode';
import { createTestEditor, isAccepted, toJson } from './testEditor';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const srcset = [
  { url: 'https://x.test/a-480.webp', width: 480 },
  { url: 'https://x.test/a.jpg', width: 1200 },
];

describe('ArticleImageNode', () => {
  it('should save the smaller copies of a picture, so the site can offer them', () => {
    // Arrange
    const { editor, dispose } = createTestEditor();
    cleanup = dispose;

    // Act
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append(
            $createArticleImageNode({ src: 'https://x.test/a.jpg', altText: 'Ảnh', width: 1200, height: 600, srcset }),
          );
      },
      { discrete: true },
    );

    // Assert
    const saved = toJson(editor);
    expect(saved.root.children[0]).toMatchObject({ src: 'https://x.test/a.jpg', srcset });
    expect(isAccepted(saved).ok).toBe(true);
  });

  it('should keep the copies when a saved article is opened again', () => {
    const { editor, dispose } = createTestEditor();
    cleanup = dispose;
    const image = {
      type: 'article-image',
      version: 1,
      src: 'https://x.test/a.jpg',
      altText: 'Ảnh',
      width: 1200,
      height: 600,
      caption: '',
      layout: 'normal',
      srcset,
    };
    const state = { root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children: [image] } };

    editor.setEditorState(editor.parseEditorState(JSON.stringify(state)));

    expect(toJson(editor).root.children[0].srcset).toEqual(srcset);
  });

  it('should save older pictures without copies as before', () => {
    const { editor, dispose } = createTestEditor();
    cleanup = dispose;

    editor.update(
      () => {
        $getRoot()
          .clear()
          .append($createArticleImageNode({ src: 'https://x.test/a.jpg', altText: 'Ảnh', width: 10, height: 5 }));
      },
      { discrete: true },
    );

    expect(toJson(editor).root.children[0]).not.toHaveProperty('srcset');
  });
});

describe('a picture still waiting for its description', () => {
  it('should save a draft the API accepts, marked as waiting for a description', () => {
    // Arrange
    const { editor, dispose } = createTestEditor();
    cleanup = dispose;

    // Act: a fresh upload, popover closed without a description
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append($createArticleImageNode({ src: 'https://x.test/a.jpg', altText: '', width: 1200, height: 600 }));
      },
      { discrete: true },
    );
    const saved = toJson(editor);

    // Assert
    expect(isAccepted(saved).ok).toBe(true);
    expect(saved.root.children[0]).toMatchObject({ altText: PENDING_ALT_TEXT, altPending: true });
  });

  it('should still ask for the description after the draft is reopened, and stop once it is written', () => {
    // Arrange
    const { editor, dispose } = createTestEditor();
    cleanup = dispose;
    const saved = {
      root: {
        type: 'root',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        children: [
          { type: 'article-image', version: 1, src: 'https://x.test/a.jpg', width: 10, height: 5, caption: '' },
        ],
      },
    };
    const image = { ...saved.root.children[0], altText: PENDING_ALT_TEXT, altPending: true };

    // Act
    editor.setEditorState(editor.parseEditorState({ root: { ...saved.root, children: [image] } }));
    const reopened = editor.read(() => {
      const node = $getRoot().getFirstChild();
      return $isArticleImageNode(node) ? node.getAltText() : null;
    });
    editor.update(
      () => {
        const node = $getRoot().getFirstChild();
        if ($isArticleImageNode(node)) node.setDetails({ altText: 'Đội ngũ', caption: '', layout: 'normal' });
      },
      { discrete: true },
    );

    // Assert
    expect(reopened).toBe('');
    const [described] = toJson(editor).root.children;
    expect(described.altText).toBe('Đội ngũ');
    expect(described).not.toHaveProperty('altPending');
  });
});
