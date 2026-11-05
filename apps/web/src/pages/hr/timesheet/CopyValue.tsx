import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { copyText, useFlash } from '../../../lib/hooks';

type CopyState = 'idle' | 'failed';

/**
 * A value with a copy button that shows on hover, over the value's own cell. Outside the tab order inside the grid,
 * where arrows move between cells; pressing it does not move the selection.
 */
export function CopyValue({ text, label, children, side = 'right', inGrid = false }: {
  text: string;
  label: string;
  children: ReactNode;
  side?: 'left' | 'right';
  inGrid?: boolean;
}) {
  const [copied, flash] = useFlash();
  const [state, setState] = useState<CopyState>('idle');
  if (!text) return <>{children}</>;
  const copy = async () => {
    // copyText falls back on an old browser call that can itself throw.
    const ok = await copyText(text).catch(() => false);
    setState(ok ? 'idle' : 'failed');
    if (ok) flash();
  };
  const name = copied ? `Đã sao chép ${label}` : state === 'failed' ? `Chưa sao chép được ${label}` : `Sao chép ${label}`;
  const isShown = copied || state === 'failed';
  return (
    <span className="group/copy relative flex w-full min-w-0 items-center">
      {children}
      <button
        type="button"
        aria-label={name}
        title={name}
        tabIndex={inGrid ? -1 : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void copy();
        }}
        className={`absolute top-1/2 ${side === 'left' ? 'left-0' : 'right-0'} inline-flex size-6 -translate-y-1/2 items-center justify-center rounded border bg-white text-slate-500 shadow-sm transition-opacity group-hover/copy:opacity-100 hover:text-blue-600 focus-visible:opacity-100 ${isShown ? 'opacity-100' : 'opacity-0'}`}
      >
        {copied ? <Check className="size-3.5 text-green-600" /> : state === 'failed' ? <TriangleAlert className="size-3.5 text-red-600" /> : <Copy className="size-3.5" />}
        <span aria-live="polite" className="sr-only">{copied ? 'Đã sao chép' : ''}</span>
      </button>
    </span>
  );
}
