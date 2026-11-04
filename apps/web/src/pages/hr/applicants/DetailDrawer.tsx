import type { ReactNode } from 'react';
import { CloseButton, Dialog } from '../../../ui/Dialog';

/** A task of its own beside the detail: the narrow right-side drawer, a title with who it is about, and close. */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  action,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  /** Beside the title, e.g. the percent. */
  badge?: ReactNode;
  /** Before the close button, e.g. "Xem CV" and "Chấm lại". */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} label={title} variant="side" sideWidth="narrow">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex flex-none flex-wrap items-center gap-3 border-b border-line px-5 py-3 max-sm:px-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="m-0 text-lg font-semibold">{title}</h2>
              {badge}
            </span>
            <span title={subtitle} className="truncate text-sm text-slate">
              {subtitle}
            </span>
          </div>
          {/* On a phone the actions take their own line under the title, which keeps the width. */}
          {action && <div className="flex items-center gap-2 max-sm:order-last max-sm:w-full">{action}</div>}
          <CloseButton onClick={onClose} />
        </header>
        {children}
      </div>
    </Dialog>
  );
}
