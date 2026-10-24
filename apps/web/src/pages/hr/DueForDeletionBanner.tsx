import { useState } from 'react';
import { useDeleteDueApplications } from '../../api/queries';
import { Icon } from '../../ui/icons';
import { errorMessage } from './parts';

/** Applications of jobs that ended more than 30 days ago: the privacy policy promises they are deleted. */
export function DueForDeletionBanner({ count }: { count: number }) {
  const remove = useDeleteDueApplications();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (count === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-card border border-error/30 bg-error-soft px-5 py-4 text-sm text-navy"
    >
      <span className="flex shrink-0 rounded-full border border-error/30 bg-white p-2 text-error">
        <Icon name="trash" size={18} stroke={1.5} />
      </span>
      <span className="min-w-0 flex-[1_1_300px] leading-relaxed">
        <strong className="font-semibold">{count} hồ sơ đến hạn xoá</strong>: thuộc các tin đã đóng hoặc hết hạn quá 30
        ngày. Chính sách dữ liệu hứa xoá các hồ sơ này, kể cả file CV.
        {error && <span className="mt-1 block text-error">{error}</span>}
      </span>
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => {
          if (!confirm) return setConfirm(true);
          setError(null);
          remove.mutate(undefined, { onError: (e) => setError(errorMessage(e)), onSettled: () => setConfirm(false) });
        }}
        className={`min-h-11 rounded-control border px-4 text-sm font-medium transition-colors disabled:opacity-60 lg:min-h-10 ${confirm ? 'border-error bg-error text-white' : 'border-error/40 bg-white text-error hover:bg-error-soft'}`}
      >
        {remove.isPending ? 'Đang xoá…' : confirm ? `Bấm lần nữa để xoá ${count} hồ sơ` : 'Xoá tất cả'}
      </button>
    </div>
  );
}
