import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../ui/icons';
import { STATUS_GROUPS, type Step } from './statusGroups';
import { MARK_STROKE, StatusMark } from './StatusMark';
import type { StatusLook } from './statusStyle';

/**
 * The current status as a button; pressing it lists every step in its three groups. A step that cannot be chosen now
 * stays in the list, and choosing it says why (a hover title never shows on a phone).
 */
export function StatusMenu({
  active,
  lookOf,
  reasonOf,
  isBusy,
  onChoose,
  onLocked,
}: {
  active: Step;
  lookOf: (step: Step) => StatusLook & { filled: string };
  reasonOf: (step: Step) => string | null;
  isBusy: boolean;
  onChoose: (step: Step) => void;
  onLocked: (why: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = lookOf(active);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Node && !box.current?.contains(e.target)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);
  const choose = (step: Step) => {
    setIsOpen(false);
    const why = reasonOf(step);
    if (why) onLocked(why);
    else if (step !== active && step !== 'awaiting') onChoose(step);
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Trạng thái: ${current.label}`}
        disabled={isBusy}
        onClick={() => setIsOpen((o) => !o)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-control border px-3 text-sm font-semibold lg:min-h-10 ${current.filled}`}
      >
        <StatusMark look={current} />
        <Icon name="chevronDown" size={16} stroke={MARK_STROKE} className="shrink-0" />
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label="Chọn trạng thái"
          className="absolute top-full left-0 z-30 mt-1 flex w-[min(280px,calc(100vw-32px))] flex-col rounded-control border border-line bg-white py-1 shadow-[0_10px_30px_rgba(11,31,58,0.15)]"
        >
          {STATUS_GROUPS.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-label={group.label}
              className="border-b border-line-soft py-1 last:border-b-0"
            >
              <span
                aria-hidden
                className="block px-3.5 pt-1 text-[11px] font-semibold tracking-wide text-muted uppercase"
              >
                {group.label}
              </span>
              {group.steps.map((step) => {
                const isOn = step === active;
                const isLocked = !isOn && !!reasonOf(step);
                return (
                  <button
                    key={step}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isOn}
                    aria-disabled={isLocked || undefined}
                    onClick={() => choose(step)}
                    className={`flex min-h-11 w-full items-center gap-2 border-0 bg-transparent px-3.5 text-left text-sm hover:bg-tint lg:min-h-9 ${isLocked ? 'text-muted' : 'text-navy'} ${isOn ? 'font-semibold' : ''}`}
                  >
                    <StatusMark look={lookOf(step)} />
                    {isOn && <Icon name="check" size={14} stroke={MARK_STROKE} className="ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
