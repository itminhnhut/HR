import { HIGHLIGHT_COLORS } from '@careers/shared';
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $findCellNode,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableSelection,
  type TableCellNode,
} from '@lexical/table';
import { $getSelection, $isRangeSelection, type LexicalNode } from 'lexical';
import { Icon } from '../../../../../ui/icons';
import { keepFocus, MenuItem, ToolMenu, useKeepSelection } from './primitives';

/** The cells a colour applies to: every selected cell, or the one with the caret. */
function $selectedCells(): TableCellNode[] {
  const selection = $getSelection();
  if ($isTableSelection(selection)) {
    return selection.getNodes().flatMap((n: LexicalNode) => {
      const cell = $findCellNode(n);
      return cell && cell === n ? [cell] : [];
    });
  }
  const cell = $isRangeSelection(selection) ? $findCellNode(selection.anchor.getNode()) : null;
  return cell ? [cell] : [];
}

function $removeTable() {
  const selection = $getSelection();
  const anchor = $isRangeSelection(selection) ? selection.anchor.getNode() : selection?.getNodes()[0];
  if (anchor) $findTableNode(anchor)?.remove();
}

function TableAction({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onClick}
      className={`min-h-9 rounded-control border px-2.5 text-[13px] ${danger ? 'border-transparent text-error hover:bg-error-soft' : 'border-silver bg-white text-navy hover:bg-mist'}`}
    >
      {label}
    </button>
  );
}

/** Shown while the caret is in a table: add/remove rows and columns, cell colour, delete the table. */
export function TableBar() {
  const keep = useKeepSelection();
  const act = (fn: () => void) => keep.run(fn);
  return (
    <div
      role="group"
      aria-label="Bảng"
      className="flex flex-wrap items-center gap-1.5 border-t border-line-soft bg-mist px-3 py-1.5"
    >
      <span className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate">
        <Icon name="table" size={15} />
        Bảng
      </span>
      <TableAction label="+ Hàng dưới" onClick={() => act(() => $insertTableRowAtSelection(true))} />
      <TableAction label="+ Cột phải" onClick={() => act(() => $insertTableColumnAtSelection(true))} />
      <TableAction label="− Xoá hàng" onClick={() => act(() => $deleteTableRowAtSelection())} />
      <TableAction label="− Xoá cột" onClick={() => act(() => $deleteTableColumnAtSelection())} />
      <ToolMenu label="Màu ô" trigger={<span className="text-[13px]">Màu ô</span>}>
        {(run) => (
          <>
            {HIGHLIGHT_COLORS.map((c) => (
              <MenuItem
                key={c.key}
                onClick={() => run(() => $selectedCells().forEach((cell) => cell.setBackgroundColor(c.hex)))}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-[3px] border border-line"
                    style={{ background: c.hex }}
                  />
                  {c.label}
                </span>
              </MenuItem>
            ))}
            <MenuItem
              icon="x"
              onClick={() => run(() => $selectedCells().forEach((cell) => cell.setBackgroundColor(null)))}
            >
              Bỏ màu
            </MenuItem>
          </>
        )}
      </ToolMenu>
      <TableAction label="Xoá bảng" danger onClick={() => act($removeTable)} />
    </div>
  );
}
