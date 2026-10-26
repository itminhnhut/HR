import { $createLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  type BaseSelection,
} from 'lexical';
import { useEffect, useRef, useState } from 'react';
import { OPEN_LINK_DIALOG_COMMAND } from '../commands';
import { LinkDialog, type LinkDialogState } from '../LinkDialog';
import { IconGlyph, mod, ToolButton, useShortcut } from './primitives';

/** Link dialog state; keeps the selection the dialog would otherwise lose. */
function useLinkActions(currentLink: string | null) {
  const [editor] = useLexicalComposerContext();
  const savedSelection = useRef<BaseSelection | null>(null);
  const [dialog, setDialog] = useState<LinkDialogState | null>(null);

  const open = () =>
    editor.read(() => {
      const selection = $getSelection();
      savedSelection.current = selection?.clone() ?? null;
      const collapsed = $isRangeSelection(selection) ? selection.isCollapsed() : true;
      setDialog({ url: currentLink ?? '', needsText: collapsed && !currentLink });
    });
  /** The dialog took focus; put the selection back before changing the text. */
  const withSelection = (fn: () => void) =>
    editor.update(() => {
      if (savedSelection.current) $setSelection(savedSelection.current.clone());
      fn();
    });
  const close = () => {
    setDialog(null);
    editor.focus();
  };
  const submit = (url: string, text: string) => {
    const needsText = dialog?.needsText ?? false;
    withSelection(() => {
      if (needsText) $insertNodes([$createLinkNode(url).append($createTextNode(text || url))]);
      else editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    });
    close();
  };
  const remove = () => {
    withSelection(() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null));
    close();
  };
  return { dialog, open, submit, remove, close };
}

/** "Chèn link" / "Sửa link" button with its dialog. */
export function LinkControl({ link }: { link: string | null }) {
  const [editor] = useLexicalComposerContext();
  const actions = useLinkActions(link);
  useShortcut('k', false, actions.open);
  const latestOpen = useRef(actions.open);
  latestOpen.current = actions.open;
  useEffect(
    () =>
      editor.registerCommand(
        OPEN_LINK_DIALOG_COMMAND,
        () => {
          latestOpen.current();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    [editor],
  );
  return (
    <>
      <ToolButton label={link ? 'Sửa link' : 'Chèn link'} shortcut={`${mod}+K`} pressed={!!link} onClick={actions.open}>
        <IconGlyph name="link" />
      </ToolButton>
      <LinkDialog state={actions.dialog} onSubmit={actions.submit} onRemove={actions.remove} onClose={actions.close} />
    </>
  );
}
