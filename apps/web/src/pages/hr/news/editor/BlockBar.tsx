import type { ReactNode } from 'react';

const keepSelection = (e: React.MouseEvent) => e.preventDefault();

const styles = {
  plain: 'border border-silver bg-white text-navy hover:bg-mist',
  danger: 'border-0 bg-transparent text-error hover:bg-error-soft',
} as const;

/** A small button under a picture, video or call-to-action button in the editor. */
export function BarButton({
  onClick,
  children,
  label,
  disabled,
  tone = 'plain',
}: {
  onClick: () => void;
  children: ReactNode;
  /** Name and tooltip, for a button showing only a sign (↑, ↓). */
  label?: string;
  disabled?: boolean;
  tone?: keyof typeof styles;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Keep the editor's selection: clicking here is not moving the caret.
      onMouseDown={keepSelection}
      onClick={onClick}
      className={`min-h-9 min-w-9 rounded-control px-2.5 text-[13px] disabled:opacity-40 ${styles[tone]}`}
    >
      {children}
    </button>
  );
}

/** The strip under a block in the editor: what it is, and its buttons. Not part of the text. */
export function BlockBar({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div
      contentEditable={false}
      className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] not-italic leading-snug"
    >
      <span className="min-w-0 flex-1 text-slate">{label}</span>
      {children}
    </div>
  );
}
