import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { FORMAT_TEXT_COMMAND } from 'lexical';
import { $clearFormatting } from '../clearFormat';
import { IconGlyph, MenuItem, ToolMenu, useShortcut, type MenuRun } from './primitives';
import type { ExtraFormat, ToolbarState } from './state';

/** Each label is written the way the format shows it. */
const EXTRA_LABELS: [ExtraFormat, string][] = [
  ['strikethrough', 'Gạch ngang'],
  ['superscript', 'Chỉ số trên (m²)'],
  ['subscript', 'Chỉ số dưới (H₂O)'],
  ['uppercase', 'VIẾT HOA'],
  ['lowercase', 'viết thường'],
  ['capitalize', 'Viết Hoa Đầu Từ'],
];

/** Strikethrough, sub/superscript, letter case and "Xoá định dạng", as in the playground's "Aa" menu. */
export function FormatOptions({ state, run }: { state: ToolbarState; run: MenuRun }) {
  const [editor] = useLexicalComposerContext();
  return (
    <>
      {EXTRA_LABELS.map(([format, label]) => (
        <MenuItem
          key={format}
          checked={state.extra[format]}
          onClick={() => run(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format))}
        >
          {label}
        </MenuItem>
      ))}
      <MenuItem icon="clearFormat" onClick={() => run($clearFormatting)}>
        Xoá định dạng
      </MenuItem>
    </>
  );
}

export function FormatMenu({ state }: { state: ToolbarState }) {
  const [editor] = useLexicalComposerContext();
  useShortcut('x', true, () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough'));
  return (
    <ToolMenu label="Định dạng khác" trigger={<IconGlyph name="textCase" />}>
      {(run) => <FormatOptions state={state} run={run} />}
    </ToolMenu>
  );
}
