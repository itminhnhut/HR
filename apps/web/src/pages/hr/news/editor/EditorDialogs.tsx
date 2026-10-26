import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  type BaseSelection,
  type LexicalNode,
} from 'lexical';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../../../ui/Dialog';
import { INSERT_LAYOUT_COMMAND, OPEN_DIALOG_COMMAND, type EditorDialog } from './commands';
import { CtaForm } from './CtaDialog';
import { $createCtaNode, $isCtaNode, type CtaPayload } from './CtaNode';
import { TableForm, YouTubeForm, type TableSize } from './EmbedDialogs';
import { LayoutForm } from './LayoutDialog';
import { $createYouTubeNode } from './YouTubeNode';

const TITLES: Record<EditorDialog['kind'], string> = {
  youtube: 'Chèn video YouTube',
  table: 'Chèn bảng',
  layout: 'Chèn bố cục cột',
  cta: 'Nút kêu gọi',
};

/** A new block at the caret (kept from when the dialog opened), or at the end of the article. */
function $insertBlock(node: LexicalNode) {
  if (!$getSelection()) $getRoot().selectEnd();
  $insertNodeToNearestRoot(node);
}

/** Opens on OPEN_DIALOG_COMMAND, keeping the selection to insert at and the CTA being edited. */
function useDialogCommand() {
  const [editor] = useLexicalComposerContext();
  const [dialog, setDialog] = useState<EditorDialog | null>(null);
  const [ctaInitial, setCtaInitial] = useState<CtaPayload | null>(null);
  const saved = useRef<BaseSelection | null>(null);
  useEffect(
    () =>
      editor.registerCommand(
        OPEN_DIALOG_COMMAND,
        (next) => {
          saved.current = $getSelection()?.clone() ?? null;
          const node = next.kind === 'cta' && next.key ? $getNodeByKey(next.key) : null;
          setCtaInitial($isCtaNode(node) ? node.getPayload() : null);
          setDialog(next);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    [editor],
  );
  const close = () => {
    setDialog(null);
    // After the native <dialog> has closed: closing hands focus back to what had it before (the menu item, now
    // gone), which would swallow the first key typed into the new block.
    window.requestAnimationFrame(() => editor.focus());
  };
  const apply = (fn: () => void) => {
    editor.update(() => {
      if (saved.current) $setSelection(saved.current.clone());
      fn();
    });
    close();
  };
  return { editor, dialog, ctaInitial, close, apply };
}

/**
 * The YouTube, table, column layout and call-to-action dialogs. They live next to the toolbar, outside the editable area,
 * and open from OPEN_DIALOG_COMMAND (toolbar menu, or "Sửa nút" under a button).
 */
export function EditorDialogs() {
  const { editor, dialog, ctaInitial, close, apply } = useDialogCommand();
  const insertTable = ({ rows, columns, headerRow }: TableSize) =>
    apply(() =>
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        rows: String(rows),
        columns: String(columns),
        includeHeaders: { rows: headerRow, columns: false },
      }),
    );
  const saveCta = (cta: CtaPayload) =>
    apply(() => {
      const node = dialog?.kind === 'cta' && dialog.key ? $getNodeByKey(dialog.key) : null;
      if ($isCtaNode(node)) node.setPayload(cta);
      else $insertBlock($createCtaNode(cta));
    });

  return (
    <Dialog open={!!dialog} onClose={close} label={dialog ? TITLES[dialog.kind] : 'Chèn'}>
      {dialog?.kind === 'youtube' && (
        <YouTubeForm onSubmit={(id) => apply(() => $insertBlock($createYouTubeNode(id)))} onClose={close} />
      )}
      {dialog?.kind === 'table' && <TableForm onSubmit={insertTable} onClose={close} />}
      {dialog?.kind === 'layout' && (
        <LayoutForm
          onSubmit={(template) => apply(() => editor.dispatchCommand(INSERT_LAYOUT_COMMAND, template))}
          onClose={close}
        />
      )}
      {dialog?.kind === 'cta' && <CtaForm initial={ctaInitial} onSubmit={saveCta} onClose={close} />}
    </Dialog>
  );
}
