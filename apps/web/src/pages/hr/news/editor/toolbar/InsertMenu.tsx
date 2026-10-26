import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_EDITOR } from 'lexical';
import { useEffect, useRef } from 'react';
import {
  INSERT_CODE_COMMAND,
  INSERT_FAQ_COMMAND,
  INSERT_TOC_COMMAND,
  OPEN_DIALOG_COMMAND,
  OPEN_IMAGE_PICKER_COMMAND,
  UPLOAD_IMAGES_COMMAND,
  type EditorDialog,
} from '../commands';
import { IconGlyph, MenuItem, ToolMenu } from './primitives';

/** The hidden file picker behind "Ảnh" (it stays mounted while the menu closes). */
function ImagePicker({ input }: { input: React.RefObject<HTMLInputElement | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerCommand(
        OPEN_IMAGE_PICKER_COMMAND,
        () => {
          input.current?.click();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    [editor, input],
  );
  return (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      hidden
      onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = '';
        if (files.length) editor.dispatchCommand(UPLOAD_IMAGES_COMMAND, files);
      }}
    />
  );
}

/** "+ Chèn" (playground's insert menu): picture, video, button, table, columns, FAQ, contents, code, divider. */
export function InsertControls() {
  const [editor] = useLexicalComposerContext();
  const fileInput = useRef<HTMLInputElement>(null);
  // The dialog keeps the selection itself and takes focus: do not send focus back to the text.
  const open = (dialog: EditorDialog) => editor.dispatchCommand(OPEN_DIALOG_COMMAND, dialog);
  return (
    <>
      <ImagePicker input={fileInput} />
      <ToolMenu
        label="Chèn"
        trigger={
          <span className="inline-flex items-center gap-1 text-sm font-medium">
            <IconGlyph name="plus" />
            Chèn
          </span>
        }
      >
        {(run) => (
          <>
            <MenuItem icon="image" onClick={() => run(() => fileInput.current?.click(), false)}>
              Ảnh (JPEG, PNG, WebP)
            </MenuItem>
            <MenuItem icon="play" onClick={() => run(() => open({ kind: 'youtube' }), false)}>
              Video YouTube
            </MenuItem>
            <MenuItem icon="cta" onClick={() => run(() => open({ kind: 'cta' }), false)}>
              Nút kêu gọi (ứng tuyển…)
            </MenuItem>
            <MenuItem icon="table" onClick={() => run(() => open({ kind: 'table' }), false)}>
              Bảng
            </MenuItem>
            <MenuItem icon="columns" onClick={() => run(() => open({ kind: 'layout' }), false)}>
              Bố cục cột
            </MenuItem>
            <MenuItem icon="faq" onClick={() => run(() => editor.dispatchCommand(INSERT_FAQ_COMMAND, undefined))}>
              Hỏi đáp (FAQ)
            </MenuItem>
            <MenuItem icon="toc" onClick={() => run(() => editor.dispatchCommand(INSERT_TOC_COMMAND, undefined))}>
              Mục lục
            </MenuItem>
            <MenuItem icon="code" onClick={() => run(() => editor.dispatchCommand(INSERT_CODE_COMMAND, undefined))}>
              Khối code
            </MenuItem>
            <MenuItem
              icon="divider"
              onClick={() => run(() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined))}
            >
              Đường kẻ ngang
            </MenuItem>
          </>
        )}
      </ToolMenu>
    </>
  );
}
