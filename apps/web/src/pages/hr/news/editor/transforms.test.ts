import { $createLinkNode } from '@lexical/link';
import { $createListItemNode, $createListNode } from '@lexical/list';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createTableCellNode, $createTableNode, $createTableRowNode } from '@lexical/table';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { $createArticleImageNode } from './ImageNode';
import { createTestEditor, isAccepted, toJson } from './testEditor';
import { $createYouTubeNode } from './YouTubeNode';

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

const json = toJson;
const accepted = (state: unknown) => isAccepted(state).ok;
const image = () => $createArticleImageNode({ src: 'https://x.test/a.jpg', altText: 'Ảnh', width: 10, height: 5 });

describe('article transforms', () => {
  it('should reshape pasted Word-like content so the API accepts it', () => {
    // Arrange
    const editor = setup();

    // Act: what a paste could produce before the rules run
    editor.update(
      () => {
        const h1 = $createHeadingNode('h1').append($createTextNode('Tiêu đề'));
        const h5 = $createHeadingNode('h5').append($createTextNode('Mục nhỏ'));
        const red = $createTextNode('Chữ đỏ')
          .setFormat(1 | 4 | 16 | 64 | 128)
          .setStyle('color: #b91c1c; font-size: 20pt; font-family: Arial');
        const bad = $createLinkNode('javascript:alert(1)').append($createTextNode('link xấu'));
        const good = $createLinkNode('https://topflow.vn').append($createTextNode('link tốt'));
        const paragraph = $createParagraphNode().append(red, bad, good);
        paragraph.setFormat('end');
        paragraph.setIndent(9);
        const checklist = $createListNode('check').append($createListItemNode().append($createTextNode('việc')));
        $getRoot().clear().append(h1, h5, paragraph, checklist);
      },
      { discrete: true },
    );
    const state = json(editor);

    // Assert
    const [h1, h5, paragraph, list] = state.root.children;
    expect(h1.tag).toBe('h2');
    expect(h5.tag).toBe('h4');
    expect(paragraph).toMatchObject({ format: 'right', indent: 4 });
    // Bold, strikethrough, inline code and superscript stay; highlight goes; colour stays, 20pt snaps to 24px.
    expect(paragraph.children[0]).toMatchObject({ format: 1 | 4 | 16 | 64, style: 'color: #b91c1c;font-size: 24px;' });
    const links = paragraph.children.filter((c: { type: string }) => c.type === 'link');
    expect(links.map((l: { url: string }) => l.url)).toEqual(['https://topflow.vn']);
    expect(paragraph.children[1]).toMatchObject({ type: 'text', text: 'link xấu' });
    expect(list.listType).toBe('check');
    expect(accepted(state)).toBe(true);
  });

  it('should move a picture that ended up inside a paragraph out to its own block', () => {
    const editor = setup();

    editor.update(
      () => {
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createTextNode('trước'), image()));
      },
      { discrete: true },
    );
    const state = json(editor);

    expect(state.root.children.map((c: { type: string }) => c.type)).toEqual(['paragraph', 'article-image']);
    expect(state.root.children[1]).toEqual({
      type: 'article-image',
      version: 1,
      src: 'https://x.test/a.jpg',
      altText: 'Ảnh',
      width: 10,
      height: 5,
      caption: '',
      layout: 'normal',
    });
  });

  it('should keep table cells to paragraphs and lists, with palette colours only', () => {
    const editor = setup();

    editor.update(
      () => {
        const cell = $createTableCellNode(1).append(
          $createHeadingNode('h2').append($createTextNode('Tiêu đề trong ô')),
          $createParagraphNode().append($createTextNode('ô')),
        );
        cell.setBackgroundColor('#ff00ff');
        const colored = $createTableCellNode(0).append($createParagraphNode().append($createTextNode('vàng')));
        colored.setBackgroundColor('#fef08a');
        // A video and a picture dropped into a cell.
        colored.append($createYouTubeNode('dQw4w9WgXcQ'), image());
        $getRoot()
          .clear()
          .append($createTableNode().append($createTableRowNode().append(cell, colored)));
      },
      { discrete: true },
    );
    const state = json(editor);

    const [first, second] = state.root.children[0].children[0].children;
    expect(first.children.map((c: { type: string }) => c.type)).toEqual(['paragraph', 'paragraph']);
    expect(first.backgroundColor).toBeNull();
    expect(second.backgroundColor).toBe('#fef08a');
    expect(state.root.children.map((c: { type: string }) => c.type).sort()).toEqual([
      'article-image',
      'table',
      'youtube',
    ]);
    expect(accepted(state)).toBe(true);
  });

  it('should store a video as its id only', () => {
    const editor = setup();

    editor.update(() => $getRoot().clear().append($createYouTubeNode('dQw4w9WgXcQ')), { discrete: true });

    expect(json(editor).root.children[0]).toEqual({ type: 'youtube', version: 1, videoID: 'dQw4w9WgXcQ', format: '' });
  });
});
