import { HistoryExtension } from '@lexical/history';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useExtensionSignalValue } from '@lexical/react/useExtensionSignalValue';
import { FORMAT_TEXT_COMMAND, REDO_COMMAND, UNDO_COMMAND, type TextFormatType } from 'lexical';
import { $clearFormatting } from '../clearFormat';
import { IconGlyph, isMac, mod, ToolButton, useKeepSelection } from './primitives';
import type { ToolbarState } from './state';

export function HistoryButtons() {
  const [editor] = useLexicalComposerContext();
  const canUndo = useExtensionSignalValue(HistoryExtension, 'canUndo');
  const canRedo = useExtensionSignalValue(HistoryExtension, 'canRedo');
  return (
    <>
      <ToolButton
        label="Hoàn tác"
        shortcut={`${mod}+Z`}
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <IconGlyph name="undo" />
      </ToolButton>
      <ToolButton
        label="Làm lại"
        shortcut={isMac ? '⌘+Shift+Z' : 'Ctrl+Y'}
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <IconGlyph name="redo" />
      </ToolButton>
    </>
  );
}

export function TextFormatButtons({ state }: { state: ToolbarState }) {
  const [editor] = useLexicalComposerContext();
  const format = (f: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f);
  return (
    <>
      <ToolButton label="Đậm" shortcut={`${mod}+B`} pressed={state.bold} onClick={() => format('bold')}>
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton label="Nghiêng" shortcut={`${mod}+I`} pressed={state.italic} onClick={() => format('italic')}>
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton label="Gạch chân" shortcut={`${mod}+U`} pressed={state.underline} onClick={() => format('underline')}>
        <span className="underline">U</span>
      </ToolButton>
      <ToolButton label="Mã (code) trong dòng" pressed={state.code} onClick={() => format('code')}>
        <IconGlyph name="code" />
      </ToolButton>
    </>
  );
}

/** "Xoá định dạng" (playground's clear formatting): words lose formats and colours, blocks their alignment. */
export function ClearFormatButton() {
  const keep = useKeepSelection();
  return (
    <ToolButton label="Xoá định dạng" onClick={() => keep.run($clearFormatting)}>
      <IconGlyph name="clearFormat" />
    </ToolButton>
  );
}
