import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';

/**
 * Native <dialog>: focus trap, Esc to close and inert background for free.
 * `variant="sheet"` slides up from the bottom on phones (and stays a
 * centered panel on wide screens); `variant="panel"` is the big two-column
 * apply modal that turns full-screen on phones; `variant="drawer"` is the
 * full-screen menu that slides in from the left.
 */
export function Dialog({
  open,
  onClose,
  label,
  children,
  variant = 'sheet',
  className = '',
  keepMounted = false,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  variant?: 'sheet' | 'panel' | 'drawer';
  className?: string;
  /** Keep children (and their state) alive while closed. */
  keepMounted?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // The browser focuses the first button (the close X), which shows a focus ring on every open.
      // Focus the dialog itself instead: screen readers announce its label, Tab still reaches the X.
      el.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const shape = {
    panel:
      'm-0 h-dvh max-h-none w-full max-w-none rounded-none sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:w-[min(1040px,calc(100vw-48px))] sm:rounded-[10px]',
    sheet:
      'mb-0 mt-auto w-full max-w-none rounded-t-[14px] sm:m-auto sm:w-[min(480px,calc(100vw-32px))] sm:rounded-[10px]',
    drawer: 'm-0 h-dvh max-h-none w-full max-w-none rounded-none',
  }[variant];
  const motion = { panel: 'animate-pop', sheet: 'animate-sheet', drawer: 'animate-drawer' }[variant];

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`overflow-hidden border-0 bg-white p-0 outline-none text-navy shadow-[0_30px_80px_rgba(3,10,24,0.45)] ${motion} ${shape} ${className}`}
    >
      {(open || keepMounted) && children}
    </dialog>
  );
}

export function CloseButton({
  onClick,
  className = '',
  label = 'Đóng',
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-slate transition-colors hover:bg-mist ${className}`}
    >
      <Icon name="x" size={18} />
    </button>
  );
}

export function SheetHandle() {
  return <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-ring sm:hidden" />;
}
