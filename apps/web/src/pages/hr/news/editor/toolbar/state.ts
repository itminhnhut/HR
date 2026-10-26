import { DEFAULT_FONT_SIZE, FONT_FAMILIES } from '@careers/shared';
import { $isCodeNode } from '@lexical/code-core';
import { $isLinkNode } from '@lexical/link';
import { $isListNode } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $getSelectionStyleValueForProperty } from '@lexical/selection';
import { $findCellNode } from '@lexical/table';
import {
  $findMatchingParent,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  type ElementNode,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { useEffect, useState } from 'react';
import { $isIndentFull } from '../blocks';
import { alignFor, type Align } from '../rules';

export type BlockType = 'paragraph' | 'h2' | 'h3' | 'h4' | 'quote' | 'code';
export type ListType = 'bullet' | 'number' | 'check';
/** "Định dạng khác": sub/superscript and letter case. */
export type ExtraFormat = 'strikethrough' | 'superscript' | 'subscript' | 'uppercase' | 'lowercase' | 'capitalize';
export const EXTRA_FORMATS: ExtraFormat[] = [
  'strikethrough',
  'superscript',
  'subscript',
  'uppercase',
  'lowercase',
  'capitalize',
];

/** What the toolbar shows as pressed or chosen, from the current selection. */
export interface ToolbarState {
  block: BlockType | 'list';
  list: ListType | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  /** Inline code. */
  code: boolean;
  /** px of the selected text; null when the selection mixes sizes. */
  fontSize: number | null;
  /** FONT_FAMILIES key ('default' or 'serif'); '' when mixed. */
  fontFamily: string;
  /** Which of the "Định dạng khác" formats the selection has. */
  extra: Record<ExtraFormat, boolean>;
  align: Align;
  /** Indentation of the block at the caret, and whether it may go one step further. */
  indent: number;
  canIndent: boolean;
  color: string;
  highlight: string;
  link: string | null;
  inTable: boolean;
}

export const EMPTY_STATE: ToolbarState = {
  block: 'paragraph',
  list: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  fontSize: DEFAULT_FONT_SIZE,
  fontFamily: 'default',
  extra: {
    strikethrough: false,
    superscript: false,
    subscript: false,
    uppercase: false,
    lowercase: false,
    capitalize: false,
  },
  align: '',
  indent: 0,
  canIndent: true,
  color: '',
  highlight: '',
  link: null,
  inTable: false,
};

/** The block the caret is in: the top-level one, or the cell's paragraph inside a table. */
function blockOf(node: LexicalNode): LexicalNode {
  let current = node;
  for (let parent = current.getParent(); parent && !$isRootOrShadowRoot(parent); parent = current.getParent()) {
    if ($findCellNode(current) === parent) break;
    current = parent;
  }
  return current;
}

const HEADING_TAGS: Partial<Record<string, BlockType>> = { h2: 'h2', h3: 'h3', h4: 'h4' };

function blockType(block: LexicalNode): { block: ToolbarState['block']; list: ToolbarState['list'] } {
  if ($isListNode(block)) {
    const type = block.getListType();
    return { block: 'list', list: type === 'number' || type === 'check' ? type : 'bullet' };
  }
  if ($isHeadingNode(block)) return { block: HEADING_TAGS[block.getTag()] ?? 'h2', list: null };
  if ($isCodeNode(block)) return { block: 'code', list: null };
  return { block: $isQuoteNode(block) ? 'quote' : 'paragraph', list: null };
}

const isBlock = (node: LexicalNode): node is ElementNode => $isElementNode(node) && !node.isInline();

/** Indentation of the innermost block at the caret (a list item counts its nesting). */
function indentAt(anchor: LexicalNode): number {
  const block = $findMatchingParent(anchor, isBlock);
  return block && !$isRootOrShadowRoot(block) ? block.getIndent() : 0;
}

/** Size and font of the selection ('' from Lexical when it mixes several). */
function fontOf(selection: RangeSelection): Pick<ToolbarState, 'fontSize' | 'fontFamily'> {
  const size = $getSelectionStyleValueForProperty(selection, 'font-size', `${DEFAULT_FONT_SIZE}px`);
  const family = $getSelectionStyleValueForProperty(selection, 'font-family', FONT_FAMILIES[0]?.css ?? '');
  const px = Number.parseFloat(size);
  return {
    fontSize: Number.isFinite(px) ? px : null,
    fontFamily: family === '' ? '' : (FONT_FAMILIES.find((f) => f.css === family)?.key ?? 'default'),
  };
}

const extraFormats = (selection: RangeSelection) =>
  Object.fromEntries(EXTRA_FORMATS.map((f) => [f, selection.hasFormat(f)])) as Record<ExtraFormat, boolean>;

export function $readToolbarState(): ToolbarState {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return EMPTY_STATE;
  const anchor = selection.anchor.getNode();
  const block = blockOf(anchor);
  const parent = anchor.getParent();
  const link = $isLinkNode(parent) ? parent : $isLinkNode(anchor) ? anchor : null;
  return {
    ...blockType(block),
    bold: selection.hasFormat('bold'),
    italic: selection.hasFormat('italic'),
    underline: selection.hasFormat('underline'),
    strikethrough: selection.hasFormat('strikethrough'),
    code: selection.hasFormat('code'),
    ...fontOf(selection),
    extra: extraFormats(selection),
    indent: indentAt(anchor),
    canIndent: !$isIndentFull(),
    align: $isElementNode(block) ? alignFor(block.getFormatType()) : '',
    color: $getSelectionStyleValueForProperty(selection, 'color', ''),
    highlight: $getSelectionStyleValueForProperty(selection, 'background-color', ''),
    link: link?.getURL() ?? null,
    inTable: $findCellNode(anchor) !== null,
  };
}

export function useToolbarState(): ToolbarState {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState(EMPTY_STATE);
  useEffect(
    () => editor.registerUpdateListener(({ editorState }) => setState(editorState.read($readToolbarState))),
    [editor],
  );
  return state;
}
