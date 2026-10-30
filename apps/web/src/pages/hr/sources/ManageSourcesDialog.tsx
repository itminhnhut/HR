import type { SourceDto } from '@careers/shared';
import { useState } from 'react';
import { ApiError } from '../../../api';
import { useSourceActions, useSources } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { FieldError } from '../../../ui/Field';
import { Notice } from '../../../ui/feedback';
import { errorMessage } from '../parts';

const KIND_NOTE: Record<SourceDto['kind'], string> = {
  system: 'Ứng viên tự nộp trên web, hệ thống quản lý',
  builtin: 'Có sẵn',
  custom: 'HR thêm',
};

function Rename({ source, onDone }: { source: SourceDto; onDone: () => void }) {
  const { update } = useSourceActions();
  const [name, setName] = useState(source.name);
  const error = update.error instanceof ApiError ? (update.error.fieldErrors.name ?? update.error.message) : undefined;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ key: source.key, patch: { name } }, { onSuccess: onDone });
      }}
      className="flex flex-col gap-1.5"
    >
      <span className="flex gap-2">
        <input
          autoFocus
          value={name}
          maxLength={60}
          aria-label={`Tên mới cho ${source.name}`}
          onChange={(e) => setName(e.target.value)}
          className="field-focus min-h-10 min-w-0 flex-1 rounded-control border border-field px-3 text-sm text-navy"
        />
        <Button size="sm" type="submit" disabled={update.isPending || name.trim().length < 2}>
          Lưu
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onDone}>
          Huỷ
        </Button>
      </span>
      <FieldError>{error}</FieldError>
    </form>
  );
}

function SourceRow({ source }: { source: SourceDto }) {
  const { update, remove } = useSourceActions();
  const [renaming, setRenaming] = useState(false);
  const fixed = source.kind === 'system';
  const canDelete = source.kind === 'custom' && source.applications === 0;
  return (
    <li className="flex flex-col gap-2 border-b border-line-soft px-5 py-3 last:border-b-0">
      {renaming ? (
        <Rename source={source} onDone={() => setRenaming(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={`font-medium ${source.hidden ? 'text-muted line-through' : 'text-navy'}`}>
              {source.name}
            </span>
            <span className="text-xs text-slate">
              {source.applications} hồ sơ · {KIND_NOTE[source.kind]}
              {source.hidden ? ' · đã ẩn' : ''}
            </span>
          </span>
          {!fixed && (
            <span className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
                Đổi tên
              </Button>
              {source.key !== 'other' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ key: source.key, patch: { hidden: !source.hidden } })}
                >
                  {source.hidden ? 'Hiện lại' : 'Ẩn'}
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => window.confirm(`Xoá nguồn "${source.name}"?`) && remove.mutate(source.key)}
                >
                  Xoá
                </Button>
              )}
            </span>
          )}
        </div>
      )}
      {(update.error || remove.error) && !renaming && (
        <span role="alert" className="text-[13px] text-error">
          {errorMessage(update.error ?? remove.error)}
        </span>
      )}
    </li>
  );
}

/** "Thêm nguồn" at the top of the list: a name, Enter or the button, and it is there for every HR. */
function AddSource() {
  const { create } = useSourceActions();
  const [name, setName] = useState('');
  const error = create.error instanceof ApiError ? (create.error.fieldErrors.name ?? create.error.message) : undefined;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(name, { onSuccess: () => setName('') });
      }}
      className="flex flex-col gap-1.5 border-b border-line px-5 py-4"
    >
      <span className="flex gap-2">
        <input
          value={name}
          maxLength={60}
          placeholder="Thêm nguồn mới, VD: LinkedIn"
          aria-label="Tên nguồn mới"
          onChange={(e) => setName(e.target.value)}
          className={`field-focus min-h-11 min-w-0 flex-1 rounded-control border px-3 text-sm text-navy ${error ? 'border-error' : 'border-field'}`}
        />
        <Button type="submit" icon="plus" disabled={create.isPending || name.trim().length < 2}>
          Thêm
        </Button>
      </span>
      <FieldError>{error}</FieldError>
    </form>
  );
}

/** "Quản lý nguồn": add, rename, hide, delete (spec-custom-sources.md). The source picker can add one too. */
export function ManageSourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sources = useSources();
  return (
    <Dialog open={open} onClose={onClose} label="Quản lý nguồn hồ sơ">
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="m-0 flex-1 text-lg font-semibold">Nguồn hồ sơ</h2>
          <CloseButton onClick={onClose} />
        </header>
        <AddSource />
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
          {(sources.data ?? []).map((s) => (
            <SourceRow key={s.key} source={s} />
          ))}
        </ul>
        <div className="border-t border-line px-5 py-3">
          <Notice tone="mist" icon="info">
            Ẩn nguồn ít dùng thay vì xoá: hồ sơ cũ và thống kê vẫn giữ. Khi thêm hồ sơ cũng thêm được nguồn ngay trong ô
            "Nguồn hồ sơ".
          </Notice>
        </div>
      </div>
    </Dialog>
  );
}
