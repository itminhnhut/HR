import { NEWS_STATUS_LABEL, type NewsStatus } from '@careers/shared';
import type { ReactNode } from 'react';
import { newsCategoryClasses } from '../../../lib/colors';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { Icon } from '../../../ui/icons';

const STATUS_TONE: Record<NewsStatus, string> = {
  draft: 'border border-cat-amber-line bg-cat-amber-soft text-cat-amber',
  published: 'border border-ok-line bg-ok-soft text-ok',
  hidden: 'border border-transparent bg-line text-slate',
};

/** Nháp (amber, hollow dot) / Đã đăng (green) / Đã ẩn (grey, eye-off). */
export function NewsStatusBadge({ status }: { status: NewsStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}
    >
      {status === 'hidden' ? (
        <Icon name="eyeOff" size={13} stroke={1.8} />
      ) : (
        <span
          aria-hidden="true"
          className={`size-[7px] rounded-full ${status === 'published' ? 'bg-ok' : 'border border-cat-amber'}`}
        />
      )}
      {NEWS_STATUS_LABEL[status]}
    </span>
  );
}

/** A post's category with a dot in its colour (same colour as on the public site); "—" when none. */
export function CategoryName({ name, empty = '—' }: { name: string | null; empty?: string }) {
  if (!name) return <>{empty}</>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${newsCategoryClasses(name).fill}`} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** "26/10/2026 14:32" in Vietnam time. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(',', '');
}

/** "14:32" in Vietnam time, for "Đã lưu lúc 14:32". */
export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Asks once more before something that cannot be undone. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
  tone = 'danger',
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Deleting is red; hiding is a reversible change. */
  tone?: 'danger' | 'neutral';
}) {
  return (
    <Dialog open={open} onClose={onClose} label={title}>
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="m-0 font-serif text-[24px] font-medium">{title}</h2>
        <div className="text-[15px] leading-relaxed text-body">{children}</div>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'dark'}
            icon={tone === 'danger' ? 'trash' : 'eyeOff'}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
