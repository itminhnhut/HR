import { $isCodeNode, CodeExtension } from '@lexical/code-core';
import { $defaultShouldInsertAfter, ClickAfterLastBlockExtension, HorizontalRuleExtension } from '@lexical/extension';
import { HistoryExtension } from '@lexical/history';
import { LinkExtension } from '@lexical/link';
import { CheckListExtension, ListExtension } from '@lexical/list';
import {
  BOLD_STAR,
  CHECK_LIST,
  CODE,
  HEADING,
  ITALIC_STAR,
  LINK,
  ORDERED_LIST,
  QUOTE,
  UNORDERED_LIST,
  type Transformer,
} from '@lexical/markdown';
import { RichTextExtension } from '@lexical/rich-text';
import { TableExtension } from '@lexical/table';
import { configExtension, defineExtension, mergeRegister, type EditorThemeClasses, type LexicalNode } from 'lexical';
import { registerArticleBlocks } from './blocks';
import {
  $isCollapsibleContainerNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
} from './CollapsibleNodes';
import { CtaNode } from './CtaNode';
import { ArticleImageNode } from './ImageNode';
import { $isLayoutContainerNode, LayoutContainerNode, LayoutItemNode } from './LayoutNodes';
import { registerArticleKeys } from './keyboard';
import { ArticlePasteExtension } from './paste';
import { isSafeLink } from './rules';
import { registerChecklistShortcut } from './shortcuts';
import { TocNode } from './TocNode';
import { registerArticleRules } from './transforms';
import { YouTubeNode } from './YouTubeNode';

/**
 * "## " → big heading, "> " → quote, "- " / "1. " / "[ ] " → lists, "```" → code block, **bold**, *italic*,
 * [text](url).
 */
export const MARKDOWN_SHORTCUTS: Transformer[] = [
  HEADING,
  QUOTE,
  CODE,
  CHECK_LIST,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_STAR,
  ITALIC_STAR,
  LINK,
];

/** Class names on the editor's own elements; the rest of the look comes from .article-prose (same as the site). */
const THEME: EditorThemeClasses = {
  paragraph: 'editor-paragraph',
  quote: 'editor-quote',
  heading: { h2: 'editor-h2', h3: 'editor-h3', h4: 'editor-h4' },
  list: {
    ul: 'editor-ul',
    ol: 'editor-ol',
    listitem: 'editor-li',
    nested: { listitem: 'editor-li-nested' },
    // Same classes as the public page's checklist.
    checklist: 'checklist',
    listitemChecked: 'checked',
    listitemUnchecked: 'unchecked',
  },
  link: 'editor-link',
  code: 'code-block',
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through',
    uppercase: 'tt-upper',
    lowercase: 'tt-lower',
    capitalize: 'tt-cap',
    code: 'editor-code',
  },
  image: 'editor-image',
  hr: 'editor-hr',
  embedBlock: { base: 'editor-embed', focus: 'is-selected' },
  table: 'editor-table',
  tableCell: 'editor-td',
  tableCellHeader: 'editor-th',
  tableCellSelected: 'is-selected',
  tableSelection: 'editor-table-selection',
  tableScrollableWrapper: 'table-wrap',
};

/** Tables: no nested tables; colours only from the palette (the transform enforces it). */
const ArticleTableExtension = configExtension(TableExtension, {
  hasCellMerge: true,
  hasCellBackgroundColor: true,
  hasTabHandler: true,
  hasHorizontalScroll: true,
  hasNestedTables: false,
});

/**
 * A click in the empty space under a last block that cannot take the caret (picture, video, table, code,
 * columns, FAQ) adds a paragraph there to keep writing, instead of sending the caret to the top.
 */
const $shouldInsertAfter = (node: LexicalNode) =>
  $defaultShouldInsertAfter(node) ||
  $isCodeNode(node) ||
  $isLayoutContainerNode(node) ||
  $isCollapsibleContainerNode(node);

/** Paste and typing rules (transforms), the article's own nodes and the "Chèn" block tools. */
const ArticleRulesExtension = defineExtension({
  name: '@careers/news/article-rules',
  nodes: [
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
  dependencies: [
    RichTextExtension,
    ListExtension,
    CheckListExtension,
    LinkExtension,
    HorizontalRuleExtension,
    ArticleTableExtension,
    CodeExtension,
  ],
  register: (editor) =>
    mergeRegister(
      registerArticleRules(editor),
      registerArticleBlocks(editor),
      registerArticleKeys(editor),
      registerChecklistShortcut(editor),
    ),
});

/**
 * The article editor (docs/adr/2026-10-26-tech-lexical-tin-tuc.md). `initialJson` is the saved content
 * (`editorState.toJSON()`), or undefined for an empty post. Build it once per mounted editor.
 */
export function articleEditorExtension(initialJson: string | undefined) {
  return defineExtension({
    name: '@careers/news/article-editor',
    namespace: 'careers-news-article',
    theme: THEME,
    $initialEditorState: initialJson,
    dependencies: [
      RichTextExtension,
      HistoryExtension,
      ListExtension,
      CheckListExtension,
      CodeExtension,
      configExtension(LinkExtension, { validateUrl: isSafeLink }),
      HorizontalRuleExtension,
      ArticleTableExtension,
      ArticlePasteExtension,
      configExtension(ClickAfterLastBlockExtension, { $shouldInsertAfter }),
      ArticleRulesExtension,
    ],
  });
}
