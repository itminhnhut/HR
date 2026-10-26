import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DRAGSTART_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  mergeRegister,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../../../ui/icons';
import { BarButton, BlockBar } from './BlockBar';
import { ImagePopover } from './ImagePopover';
import { SET_IMAGE_DETAILS_COMMAND } from './commands';
import type { ImageDetails } from './ImageNode';

/** True when exactly this image is selected as a node (clicked, or reached with the arrow keys). */
function $isOnlySelected(nodeKey: NodeKey): boolean {
  const selection = $getSelection();
  return $isNodeSelection(selection) && selection.has(nodeKey) && selection.getNodes().length === 1;
}

/** Enter adds a paragraph after the selected picture; Esc goes back to typing. */
function registerImageKeys(editor: LexicalEditor, nodeKey: NodeKey, clearSelection: () => void) {
  return mergeRegister(
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!$isOnlySelected(nodeKey)) return false;
        event?.preventDefault();
        const paragraph = $createParagraphNode();
        $getNodeByKey(nodeKey)?.insertAfter(paragraph);
        paragraph.select();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
    editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        if (!$isOnlySelected(nodeKey)) return false;
        event.preventDefault();
        clearSelection();
        editor.focus();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );
}

/**
 * Click selects the picture; Delete/Backspace removes it (Lexical's rich text handles a node selection);
 * Enter adds a paragraph after it; Esc goes back to typing. Behaviour from the playground ImageComponent and
 * the edu-viet-uc editor.
 */
function useImageSelection(nodeKey: NodeKey, img: React.RefObject<HTMLImageElement | null>): boolean {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          CLICK_COMMAND,
          (event) => {
            if (event.target !== img.current) return false;
            if (!event.shiftKey) clearSelection();
            setSelected(true);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          DRAGSTART_COMMAND,
          (event) => {
            if (event.target !== img.current) return false;
            event.preventDefault();
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        registerImageKeys(editor, nodeKey, clearSelection),
      ),
    [editor, nodeKey, img, setSelected, clearSelection],
  );
  return isSelected;
}

function ImageBar({ altText, onEdit, onRemove }: { altText: string; onEdit: () => void; onRemove: () => void }) {
  const label = altText ? (
    `Mô tả: ${altText}`
  ) : (
    <span className="inline-flex items-center gap-1.5 font-medium text-error">
      <Icon name="alert" size={15} />
      Cần mô tả ảnh
    </span>
  );
  return (
    <BlockBar label={label}>
      <BarButton onClick={onEdit}>Sửa ảnh</BarButton>
      <BarButton onClick={onRemove} tone="danger">
        Xoá ảnh
      </BarButton>
    </BlockBar>
  );
}

export interface ArticleImageViewProps extends ImageDetails {
  nodeKey: NodeKey;
  src: string;
  width: number;
  height: number;
  askAlt: boolean;
}

export function ArticleImageView({ nodeKey, src, width, height, askAlt, ...details }: ArticleImageViewProps) {
  const [editor] = useLexicalComposerContext();
  const img = useRef<HTMLImageElement>(null);
  const isSelected = useImageSelection(nodeKey, img);
  const [editing, setEditing] = useState(askAlt);
  const { altText, caption, layout } = details;

  const close = useCallback(
    (next?: ImageDetails) => {
      setEditing(false);
      editor.dispatchCommand(SET_IMAGE_DETAILS_COMMAND, { key: nodeKey, ...(next ?? { altText, caption, layout }) });
      editor.focus();
    },
    [editor, nodeKey, altText, caption, layout],
  );
  const save = (next: ImageDetails) => {
    close(next);
    // Back to typing right after the picture.
    editor.update(() => $getNodeByKey(nodeKey)?.selectNext(0, 0));
  };

  return (
    <figure
      className={`article-image-frame m-0 ${layout === 'wide' ? 'img-wide' : ''} ${isSelected ? 'is-selected' : ''}`}
    >
      <img
        ref={img}
        src={src}
        alt={altText}
        width={width}
        height={height}
        draggable={false}
        onDoubleClick={() => setEditing(true)}
      />
      {caption && <figcaption>{caption}</figcaption>}
      {(isSelected || !altText) && (
        <ImageBar
          altText={altText}
          onEdit={() => setEditing(true)}
          onRemove={() => editor.update(() => $getNodeByKey(nodeKey)?.remove())}
        />
      )}
      {editing && <ImagePopover anchor={img} initial={details} onSave={save} onClose={() => close()} />}
    </figure>
  );
}
