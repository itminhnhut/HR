import { NEWS_CATEGORY_MAX, type NewsCategoryDto } from '@careers/shared';
import { useState } from 'react';
import { useNewsCategoryActions } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { FieldError, TextField } from '../../../ui/Field';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';

const rowButton =
  'inline-flex min-h-10 items-center gap-1.5 rounded-control border-0 bg-transparent px-2.5 text-sm transition-colors hover:bg-tint disabled:opacity-60';

type OnError = (msg: string | null) => void;

function RenameForm({
  category,
  onDone,
  onError,
}: {
  category: NewsCategoryDto;
  onDone: () => void;
  onError: OnError;
}) {
  const { rename } = useNewsCategoryActions();
  const [name, setName] = useState(category.name);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onError(null);
        rename.mutate({ id: category.id, name }, { onSuccess: onDone, onError: (err) => onError(errorMessage(err)) });
      }}
    >
      <TextField
        label={`Tên mới cho "${category.name}"`}
        className="min-w-0 flex-1"
        value={name}
        maxLength={NEWS_CATEGORY_MAX}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="dark" size="sm" className="min-h-[52px]" disabled={rename.isPending}>
        Lưu
      </Button>
      <Button variant="ghost" size="sm" className="min-h-[52px]" onClick={onDone}>
        Huỷ
      </Button>
    </form>
  );
}

/**
 * Deleting takes a second press. A category that still has posts cannot be deleted (the API refuses, 409):
 * the button is off and says why.
 */
function DeleteButton({ category, onError }: { category: NewsCategoryDto; onError: OnError }) {
  const { remove } = useNewsCategoryActions();
  const [confirm, setConfirm] = useState(false);
  const hintId = `category-${category.id}-in-use`;
  if (category.postCount > 0) {
    return (
      <>
        <button type="button" disabled aria-describedby={hintId} className={`${rowButton} text-body`}>
          <Icon name="trash" size={15} />
          Xoá
        </button>
        <span id={hintId} className="w-full text-xs text-muted">
          Còn {category.postCount} bài – chuyển bài sang chuyên mục khác trước
        </span>
      </>
    );
  }
  return (
    <button
      type="button"
      disabled={remove.isPending}
      className={`${rowButton} ${confirm ? 'font-medium text-error' : 'text-body'}`}
      onClick={() => {
        if (!confirm) return setConfirm(true);
        setConfirm(false);
        onError(null);
        remove.mutate(category.id, { onError: (err) => onError(errorMessage(err)) });
      }}
    >
      <Icon name="trash" size={15} />
      {confirm ? 'Bấm lần nữa để xoá' : 'Xoá'}
    </button>
  );
}

function CategoryRow({ category, onError }: { category: NewsCategoryDto; onError: OnError }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="border-b border-line-soft py-3">
        <RenameForm category={category} onDone={() => setEditing(false)} onError={onError} />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-soft py-2.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{category.name}</span>
        <span className="text-xs text-muted">
          {category.postCount} bài · /tin-tuc/chuyen-muc/{category.slug}
        </span>
      </span>
      <button type="button" className={`${rowButton} text-navy`} onClick={() => setEditing(true)}>
        <Icon name="pencil" size={15} />
        Đổi tên
      </button>
      <DeleteButton category={category} onError={onError} />
    </li>
  );
}

function AddCategory({ onError }: { onError: OnError }) {
  const { create } = useNewsCategoryActions();
  const [name, setName] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onError(null);
        create.mutate(name, { onSuccess: () => setName(''), onError: (err) => onError(errorMessage(err)) });
      }}
    >
      <TextField
        label="Thêm chuyên mục"
        className="min-w-0 flex-1"
        placeholder="Ví dụ: Cẩm nang ứng viên"
        value={name}
        maxLength={NEWS_CATEGORY_MAX}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="submit"
        variant="dark"
        icon="plus"
        className="min-h-[52px]"
        disabled={create.isPending || !name.trim()}
      >
        Thêm
      </Button>
    </form>
  );
}

/** Add, rename, delete categories. Deleting is refused (409) while a category still has posts. */
export function CategoryManager({
  open,
  categories,
  onClose,
}: {
  open: boolean;
  categories: NewsCategoryDto[];
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} label="Chuyên mục">
      <div className="flex max-h-[88dvh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-serif text-[26px] font-medium">Chuyên mục</h2>
            <p className="m-0 text-sm text-slate">Đường dẫn tự sinh từ tên và giữ nguyên khi đổi tên.</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        {categories.length === 0 ? (
          <p className="m-0 text-sm text-muted">Chưa có chuyên mục nào.</p>
        ) : (
          <ul className="m-0 list-none border-t border-line-soft p-0">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} onError={setError} />
            ))}
          </ul>
        )}
        <FieldError>{error}</FieldError>
        <AddCategory onError={setError} />
      </div>
    </Dialog>
  );
}
