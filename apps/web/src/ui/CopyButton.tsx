import { copyText, useFlash } from '../lib/hooks';
import { Icon } from './icons';

/** A small icon button that copies `text`; shows a check and "Đã sao chép" for a moment. */
export function CopyButton({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [copied, flash] = useFlash();
  return (
    <button
      type="button"
      onClick={() => copyText(text).then((ok) => ok && flash())}
      aria-label={copied ? `Đã sao chép ${label}` : `Sao chép ${label}`}
      title={copied ? 'Đã sao chép' : `Sao chép ${label}`}
      className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-tint ${copied ? 'text-ok' : 'text-slate hover:text-navy'} ${className}`}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} stroke={1.7} />
      <span aria-live="polite" className="sr-only">
        {copied ? 'Đã sao chép' : ''}
      </span>
    </button>
  );
}
