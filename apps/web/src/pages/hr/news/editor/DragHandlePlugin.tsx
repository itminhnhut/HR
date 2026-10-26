import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin';
import {
  $getNodeByKey,
  $getRoot,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  mergeRegister,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { useEffect, useRef, type RefObject } from 'react';
import { Icon } from '../../../../ui/icons';
import { dropPlace, type DropPlace } from './dragDrop';

const HANDLE = 'drag-handle';
/** What Lexical's handle puts in the drag data: the dragged block's key. */
const DRAG_DATA_FORMAT = 'application/x-lexical-drag-block';
/** The drop line's inset from the editor's sides (the handle sits in the left padding). */
const LINE_INSET = 24;

interface Target {
  node: LexicalNode;
  rect: DOMRect;
  place: DropPlace;
}

/** The top-level block a pointer at `y` drops next to, with its place on screen. */
function $dropTarget(editor: LexicalEditor, y: number): Target | null {
  const blocks = $getRoot()
    .getChildren()
    .flatMap((node) => {
      const rect = editor.getElementByKey(node.getKey())?.getBoundingClientRect();
      return rect ? [{ node, rect }] : [];
    });
  const place = dropPlace(
    blocks.map((b) => b.rect),
    y,
  );
  const block = place ? blocks[place.index] : undefined;
  return place && block ? { ...block, place } : null;
}

const isBlockDrag = (event: DragEvent) => !!event.dataTransfer?.types.includes(DRAG_DATA_FORMAT);

function showLine(line: HTMLElement | null, anchor: HTMLElement, target: Target) {
  if (!line) return;
  const box = anchor.getBoundingClientRect();
  const y = target.place.before ? target.rect.top : target.rect.bottom;
  line.style.transform = `translate(${LINE_INSET}px, ${y - box.top - 2 + anchor.scrollTop}px)`;
  line.style.width = `${box.width - LINE_INSET * 2}px`;
  line.style.opacity = '.4';
}

/** The drop line and the drop itself follow the pointer: top half of a block = before it. */
function useDropPlacement(anchor: HTMLElement, line: RefObject<HTMLDivElement | null>) {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          DRAGOVER_COMMAND,
          (event) => {
            if (!isBlockDrag(event)) return false;
            const target = $dropTarget(editor, event.clientY);
            if (target) showLine(line.current, anchor, target);
            event.preventDefault();
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          DROP_COMMAND,
          (event) => {
            const dragged = $getNodeByKey(event.dataTransfer?.getData(DRAG_DATA_FORMAT) ?? '');
            const target = dragged ? $dropTarget(editor, event.clientY) : null;
            if (!dragged || !target) return false;
            event.preventDefault();
            if (target.node !== dragged) {
              if (target.place.before) target.node.insertBefore(dragged);
              else target.node.insertAfter(dragged);
            }
            if (line.current) line.current.style.opacity = '0';
            return true;
          },
          COMMAND_PRIORITY_CRITICAL,
        ),
      ),
    [editor, anchor, line],
  );
}

/**
 * The ⋮⋮ handle left of the block under the mouse, and the line where it will drop (Lexical's
 * DraggableBlockPlugin, as in the playground, with our own drop placement). Desktop only; the contents
 * block also has ↑ / ↓ buttons.
 */
export function DragHandlePlugin({ anchor }: { anchor: HTMLElement }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  useDropPlacement(anchor, lineRef);
  return (
    <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchor}
      menuRef={menuRef}
      targetLineRef={lineRef}
      menuComponent={
        <div ref={menuRef} className={HANDLE} title="Kéo để di chuyển khối">
          <Icon name="grip" size={16} stroke={1.8} />
        </div>
      }
      targetLineComponent={<div ref={lineRef} className="drag-target-line" />}
      isOnMenu={(element) => !!element.closest(`.${HANDLE}`)}
    />
  );
}
