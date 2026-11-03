import { Icon, type IconName } from '../../../ui/icons';

const SHORTCUT_HINT = { prev: 'K', next: 'J' } as const;

function StepButton({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint: string;
  onClick?: () => void;
}) {
  // aria-disabled, not disabled: a button that was just pressed keeps the focus when it reaches the end of the list.
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={!onClick}
      title={`${label} (phím ${hint})`}
      onClick={onClick}
      className={`flex size-11 shrink-0 items-center justify-center rounded-control border-0 bg-transparent text-navy transition-colors ${onClick ? 'hover:bg-tint' : 'cursor-not-allowed opacity-40'}`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/**
 * Previous, position, next. Lives outside the part of the detail that is rebuilt for each person, so the button
 * HR just pressed keeps the focus while the next person loads.
 */
export function DetailNav({
  position,
  total,
  onPrev,
  onNext,
}: {
  /** 1-based; null when the open application is not in the list (hidden by a filter). */
  position: number | null;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <nav aria-label="Chuyển hồ sơ" className="flex items-center">
      <StepButton icon="arrowLeft" label="Hồ sơ trước" hint={SHORTCUT_HINT.prev} onClick={onPrev} />
      <span
        role="status"
        className="min-w-9 whitespace-nowrap text-center text-[13px] font-medium tabular-nums text-slate"
      >
        {position ?? '–'}/{total}
      </span>
      <StepButton icon="arrowRight" label="Hồ sơ tiếp" hint={SHORTCUT_HINT.next} onClick={onNext} />
    </nav>
  );
}
