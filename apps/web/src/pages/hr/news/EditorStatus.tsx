import type { NewsStatus } from '@careers/shared';
import { Icon } from '../../../ui/icons';
import { ConfirmDialog } from './parts';
import { StatusMenu } from './StatusMenu';
import { missingFields, wasPublished } from './statusRules';
import type { Autosave } from './useNewsAutosave';

/**
 * The editor's status picker ("Trạng thái"), the confirm before hiding, and "Còn thiếu: …" with links to
 * the fields a refused publish named.
 */

const smooth = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** Scrolls to a form field (wrapped in data-field="<key>") and puts the cursor in it. */
export function jumpToField(key: string) {
  const box = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
  if (!box) return;
  box.scrollIntoView?.({ behavior: smooth(), block: 'center' });
  // The article text before its toolbar; otherwise the field's first control.
  const target =
    box.querySelector<HTMLElement>('[contenteditable="true"]') ??
    box.querySelector<HTMLElement>('input:not([type="hidden"]):not([hidden]), select, textarea, button');
  target?.focus({ preventScroll: true });
}

export function StatusField({
  autosave,
  busy,
  onChoose,
  variant = 'field',
}: {
  autosave: Autosave;
  busy: boolean;
  onChoose: (status: NewsStatus) => void;
  variant?: 'field' | 'badge';
}) {
  const status = autosave.post?.status ?? 'draft';
  const menu = (
    <StatusMenu
      status={status}
      everPublished={wasPublished(autosave.post)}
      busy={busy}
      onChoose={onChoose}
      variant={variant}
    />
  );
  if (variant === 'badge') return menu;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-white p-4 sm:p-5">
      <span className="text-sm font-medium text-navy">Trạng thái</span>
      {menu}
    </div>
  );
}

export function HideConfirm({
  open,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      tone="neutral"
      title="Ẩn bài viết?"
      confirmLabel="Ẩn bài"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      Bài sẽ rời khỏi trang tin tức và Google. Đường dẫn được giữ nguyên, chọn &quot;Đã đăng&quot; để đăng lại.
    </ConfirmDialog>
  );
}

/** "Còn thiếu: Chuyên mục · Ảnh bìa" — each name jumps to its field. */
export function MissingFields({ errors }: { errors: Record<string, string> }) {
  const missing = missingFields(errors);
  if (missing.length === 0) return null;
  return (
    <p role="alert" className="m-0 flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-error">
      <Icon name="alert" size={16} className="shrink-0" />
      <span className="font-medium">Còn thiếu:</span>
      {missing.map((field, i) => (
        <span key={field.key} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">·</span>}
          <button
            type="button"
            onClick={() => jumpToField(field.key)}
            className="min-h-8 border-0 bg-transparent p-0 text-sm font-medium text-error underline underline-offset-2"
          >
            {field.label}
          </button>
        </span>
      ))}
    </p>
  );
}
