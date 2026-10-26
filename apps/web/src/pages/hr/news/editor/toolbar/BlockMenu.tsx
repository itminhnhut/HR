import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode, $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical';
import type { ReactNode } from 'react';
import { INSERT_CODE_COMMAND } from '../commands';
import { IconGlyph, MenuItem, ToolMenu } from './primitives';
import type { ToolbarState } from './state';

/** Every choice of the block-type dropdown, as in the Lexical playground (lists and code included). */
export type BlockChoice = 'paragraph' | 'h2' | 'h3' | 'h4' | 'quote' | 'bullet' | 'number' | 'check' | 'code';

export const HeadingGlyph = ({ level }: { level: 2 | 3 | 4 }) => (
  <span aria-hidden="true" className="inline-flex w-[18px] justify-center text-[12px] font-semibold">
    H{level}
  </span>
);

const CHOICES: { choice: BlockChoice; label: string; short: string; glyph: ReactNode }[] = [
  { choice: 'paragraph', label: 'Đoạn văn', short: 'Đoạn văn', glyph: <IconGlyph name="paragraph" /> },
  { choice: 'h2', label: 'Tiêu đề lớn (H2)', short: 'Tiêu đề H2', glyph: <HeadingGlyph level={2} /> },
  { choice: 'h3', label: 'Tiêu đề vừa (H3)', short: 'Tiêu đề H3', glyph: <HeadingGlyph level={3} /> },
  { choice: 'h4', label: 'Tiêu đề nhỏ (H4)', short: 'Tiêu đề H4', glyph: <HeadingGlyph level={4} /> },
  { choice: 'quote', label: 'Trích dẫn', short: 'Trích dẫn', glyph: <IconGlyph name="quote" /> },
  { choice: 'bullet', label: 'Danh sách chấm', short: 'DS chấm', glyph: <IconGlyph name="listBullet" /> },
  { choice: 'number', label: 'Danh sách số', short: 'DS số', glyph: <IconGlyph name="listNumber" /> },
  { choice: 'check', label: 'Checklist (ô tích)', short: 'Checklist', glyph: <IconGlyph name="listCheck" /> },
  { choice: 'code', label: 'Khối code', short: 'Khối code', glyph: <IconGlyph name="code" /> },
];

const LIST_COMMANDS = {
  bullet: INSERT_UNORDERED_LIST_COMMAND,
  number: INSERT_ORDERED_LIST_COMMAND,
  check: INSERT_CHECK_LIST_COMMAND,
} as const;

/** What the dropdown shows for the caret's block. */
export const currentChoice = (state: ToolbarState): BlockChoice =>
  state.block === 'list' ? (state.list ?? 'bullet') : state.block;

/** Runs inside the menu's update (selection already restored). Choosing the current list removes it. */
export function applyChoice(editor: LexicalEditor, choice: BlockChoice, current: BlockChoice) {
  if (choice === 'bullet' || choice === 'number' || choice === 'check') {
    editor.dispatchCommand(choice === current ? REMOVE_LIST_COMMAND : LIST_COMMANDS[choice], undefined);
    return;
  }
  if (choice === 'code') {
    editor.dispatchCommand(INSERT_CODE_COMMAND, undefined);
    return;
  }
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;
  $setBlocksType(selection, () => {
    if (choice === 'paragraph') return $createParagraphNode();
    return choice === 'quote' ? $createQuoteNode() : $createHeadingNode(choice);
  });
}

/** "Kiểu đoạn": icon + label of the current block; the menu lists every block type with its icon. */
export function BlockMenu({ state }: { state: ToolbarState }) {
  const [editor] = useLexicalComposerContext();
  const current = currentChoice(state);
  const active = CHOICES.find((c) => c.choice === current) ?? CHOICES[0];
  return (
    <ToolMenu
      label={`Kiểu đoạn: ${active?.label ?? 'Đoạn văn'}`}
      trigger={
        <span className="inline-flex items-center gap-1.5">
          {active?.glyph}
          <span className="w-[76px] truncate text-left text-sm">{active?.short}</span>
        </span>
      }
    >
      {(run) =>
        CHOICES.map(({ choice, label, glyph }) => (
          <MenuItem
            key={choice}
            glyph={glyph}
            checked={choice === current}
            onClick={() => run(() => applyChoice(editor, choice, current))}
          >
            {label}
          </MenuItem>
        ))
      }
    </ToolMenu>
  );
}
