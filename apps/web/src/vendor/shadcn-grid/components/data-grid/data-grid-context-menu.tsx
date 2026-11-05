"use client";

import {
  type ReactTable,
  type RowData,
  Subscribe,
} from "@tanstack/react-table";
import * as React from "react";
import { toast } from "sonner";

import type { DataGridFeatures } from "../../lib/data-grid-features";
import type { ContextMenuState } from "../../lib/data-grid-types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { CopyIcon, ScissorsIcon, EraserIcon, Trash2Icon } from "lucide-react";

interface DataGridContextMenuProps<TData extends RowData> {
  table: ReactTable<DataGridFeatures, TData, unknown>;
  dataGridRef: React.RefObject<HTMLDivElement | null>;
}

export function DataGridContextMenu<TData extends RowData>(
  props: DataGridContextMenuProps<TData>,
) {
  return (
    <Subscribe source={props.table.atoms.contextMenu}>
      {(contextMenu) =>
        contextMenu.open ? (
          <ContextMenu {...props} contextMenu={contextMenu} />
        ) : null
      }
    </Subscribe>
  );
}

interface ContextMenuProps<
  TData extends RowData,
> extends DataGridContextMenuProps<TData> {
  contextMenu: ContextMenuState;
}

const ContextMenu = React.memo(ContextMenuImpl, (prev, next) => {
  if (prev.contextMenu.open !== next.contextMenu.open) return false;
  if (!next.contextMenu.open) return true;
  return (
    prev.contextMenu.x === next.contextMenu.x &&
    prev.contextMenu.y === next.contextMenu.y
  );
}) as typeof ContextMenuImpl;

function ContextMenuImpl<TData extends RowData>({
  table,
  dataGridRef,
  contextMenu,
}: ContextMenuProps<TData>) {
  const readOnly = table.getIsReadOnly();
  const canDeleteRows = !readOnly && !!table.options.enableRowDeletion;

  const triggerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      left: `${contextMenu.x}px`,
      top: `${contextMenu.y}px`,
      width: "1px",
      height: "1px",
      padding: 0,
      margin: 0,
      border: "none",
      background: "transparent",
      pointerEvents: "none",
      opacity: 0,
    }),
    [contextMenu.x, contextMenu.y],
  );

  const onFinalFocus = React.useCallback(() => {
    const focusedCell = table.getFocusedCell();
    if (focusedCell && table.options.onCellFocus) {
      table.options.onCellFocus({
        rowId: focusedCell.row.id,
        columnId: focusedCell.column.id,
      });
      return false;
    }
    dataGridRef.current?.focus();
    return false;
  }, [table, dataGridRef]);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) table.closeContextMenu();
    },
    [table],
  );

  const onCopy = React.useCallback(() => {
    void table.copySelectedCells();
  }, [table]);

  const onCut = React.useCallback(() => {
    void table.cutSelectedCells();
  }, [table]);

  const onClear = React.useCallback(() => {
    const cells = table.getSelectedCells();
    if (cells.length === 0) return;

    table.clearCells(cells);

    toast.success(
      `Đã xoá ${cells.length} ô`,
    );
  }, [table]);

  const onDelete = React.useCallback(() => {
    const rowIds = new Set(table.getSelectedCells().map((cell) => cell.rowId));
    if (rowIds.size === 0) return;

    table.deleteRows(Array.from(rowIds));

    toast.success(`Đã xoá ${rowIds.size} dòng`);
  }, [table]);

  return (
    <DropdownMenu open={contextMenu.open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger style={triggerStyle} />
      <DropdownMenuContent
        data-grid-popover=""
        align="start"
        className="w-48"
        finalFocus={onFinalFocus}
      >
        <DropdownMenuItem onClick={onCopy}>
          <CopyIcon
          />
          Sao chép
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCut} disabled={readOnly}>
          <ScissorsIcon
          />
          Cắt
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClear} disabled={readOnly}>
          <EraserIcon
          />
          Xoá
        </DropdownMenuItem>
        {canDeleteRows && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon
              />
              Xoá dòng
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
