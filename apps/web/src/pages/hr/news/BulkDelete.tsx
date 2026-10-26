import type { HrNewsRowDto } from '@careers/shared';
import { useMemo, useState } from 'react';
import { useDeleteNews } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { errorMessage } from '../parts';
import { ConfirmDialog } from './parts';

/**
 * Ticked drafts for "Xoá N bản nháp". Only drafts can be ticked; a ticked post that is no longer a draft
 * (published from its row) or no longer exists drops out by itself.
 */
export function useDraftSelection(rows: HrNewsRowDto[]) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const drafts = useMemo(() => new Set(rows.filter((r) => r.status === 'draft').map((r) => r.id)), [rows]);
  const selected = useMemo(() => new Set([...ticked].filter((id) => drafts.has(id))), [ticked, drafts]);
  const onSelect = (id: string, on: boolean) =>
    setTicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  return { selected, onSelect, clear: () => setTicked(new Set()) };
}

interface BulkDeleteBarProps {
  selected: ReadonlySet<string>;
  onClear: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

/** "Đã chọn 2 bản nháp · Bỏ chọn · Xoá 2 bản nháp", then a confirm; deletes one after another. */
export function BulkDeleteBar({ selected, onClear, onDone, onError }: BulkDeleteBarProps) {
  const remove = useDeleteNews();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = selected.size;
  if (count === 0) return null;
  const run = async () => {
    setBusy(true);
    try {
      for (const id of selected) await remove.mutateAsync(id);
      onDone(`Đã xoá ${count} bản nháp.`);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
      setAsking(false);
      onClear();
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-tint px-4 py-2.5 sm:px-[22px]">
      <span role="status" className="text-sm font-medium text-navy">
        Đã chọn {count} bản nháp
      </span>
      <button
        type="button"
        onClick={onClear}
        className="min-h-10 border-0 bg-transparent px-1 text-sm text-link underline"
      >
        Bỏ chọn
      </button>
      <Button variant="danger" size="sm" icon="trash" className="ml-auto" onClick={() => setAsking(true)}>
        Xoá {count} bản nháp
      </Button>
      <ConfirmDialog
        open={asking}
        title={`Xoá ${count} bản nháp?`}
        confirmLabel={`Xoá ${count} bài`}
        busy={busy}
        onConfirm={() => void run()}
        onClose={() => setAsking(false)}
      >
        Các bản nháp đã chọn sẽ bị xoá hẳn. Không khôi phục được.
      </ConfirmDialog>
    </div>
  );
}
