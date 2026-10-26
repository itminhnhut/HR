import { parseArticleContent } from '@careers/shared';
import { CodeHighlightNode, CodeNode } from '@lexical/code-core';
import { HorizontalRuleNode } from '@lexical/extension';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { createEditor, mergeRegister, type LexicalEditor } from 'lexical';
import { registerArticleBlocks } from './blocks';
import { CollapsibleContainerNode, CollapsibleContentNode, CollapsibleTitleNode } from './CollapsibleNodes';
import { CtaNode } from './CtaNode';
import { ArticleImageNode } from './ImageNode';
import { registerArticleKeys } from './keyboard';
import { LayoutContainerNode, LayoutItemNode } from './LayoutNodes';
import { TocNode } from './TocNode';
import { registerChecklistShortcut } from './shortcuts';
import { registerArticleRules } from './transforms';
import { YouTubeNode } from './YouTubeNode';

/** Test helper: a headless editor with the article's nodes, rules and block commands (no DOM). */
export function createTestEditor(): { editor: LexicalEditor; dispose: () => void } {
  const editor = createEditor({
    namespace: 'test',
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      TableNode,
      TableRowNode,
      TableCellNode,
      HorizontalRuleNode,
      CodeNode,
      CodeHighlightNode,
      ArticleImageNode,
      YouTubeNode,
      CtaNode,
      TocNode,
      CollapsibleContainerNode,
      CollapsibleTitleNode,
      CollapsibleContentNode,
      LayoutContainerNode,
      LayoutItemNode,
    ],
    onError: (error) => {
      throw error;
    },
  });
  const dispose = mergeRegister(
    registerRichText(editor),
    registerArticleRules(editor),
    registerArticleBlocks(editor),
    registerArticleKeys(editor),
    registerChecklistShortcut(editor),
  );
  return { editor, dispose };
}

/** The saved content, as the API receives it. */
export const toJson = (editor: LexicalEditor) => JSON.parse(JSON.stringify(editor.getEditorState().toJSON()));

export const isAccepted = (state: unknown) => parseArticleContent(state, { isAllowedImage: () => true });

export const typesOf = (nodes: { type: string }[]) => nodes.map((n) => n.type);
