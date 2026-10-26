import type { NewsStatus } from '@careers/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../ui/icons';
import { NewsStatusBadge } from './parts';
import { statusOptions, type StatusOption } from './statusRules';

/**
 * "Trạng thái": the post's status as a badge with a chevron; the menu lists the statuses HR may pick with a
 * one-line hint (statusRules). Used in the editor (a full-width field) and in each row of the HR list.
 */

const ITEM = '[role="menuitemradio"]:not([aria-disabled="true"])';

/** Fixed under the button and kept on screen: rows sit in a sideways-scrolling table. */
function usePlacement(button: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const place = () => {
      const anchor = button.current?.getBoundingClientRect();
      const box = panel.current;
      if (!anchor || !box) return;
      const below = anchor.bottom + 4;
      const fitsBelow = below + box.offsetHeight < window.innerHeight - 8;
      box.style.top = `${fitsBelow ? below : Math.max(8, anchor.top - box.offsetHeight - 4)}px`;
      box.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - box.offsetWidth - 8))}px`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [button, panel]);
}

function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(ITEM)];
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
  items[next]?.focus();
}

function OptionRow({ option, current, onPick }: { option: StatusOption; current: NewsStatus; onPick: () => void }) {
  const checked = option.status === current;
  return (
    <div
      role="menuitemradio"
      tabIndex={-1}
      aria-checked={checked}
      aria-disabled={option.disabled || undefined}
      onClick={() => !option.disabled && onPick()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !option.disabled) {
          e.preventDefault();
          onPick();
        }
      }}
      className={`flex min-h-11 gap-2.5 rounded-control px-2.5 py-2 text-left outline-none focus-visible:bg-tint ${option.disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-tint'}`}
    >
      <span className="pt-0.5">
        <NewsStatusBadge status={option.status} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] text-body">{option.hint}</span>
        {option.note && <span className="text-xs leading-snug text-muted">{option.note}</span>}
      </span>
      {checked && <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent" />}
    </div>
  );
}

function StatusPanel({
  anchor,
  status,
  options,
  onPick,
  onClose,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  status: NewsStatus;
  options: StatusOption[];
  onPick: (status: NewsStatus) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  usePlacement(anchor, panel);
  useEffect(() => {
    const items = panel.current?.querySelectorAll<HTMLElement>(ITEM);
    ([...(items ?? [])].find((el) => el.getAttribute('aria-checked') === 'true') ?? items?.[0])?.focus();
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [anchor, onClose]);
  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label="Đổi trạng thái"
      onKeyDown={(e) => {
        moveFocus(e);
        if (e.key === 'Escape' || e.key === 'Tab') {
          e.preventDefault();
          onClose();
          anchor.current?.focus();
        }
      }}
      className="fixed z-50 flex w-[min(300px,calc(100vw-16px))] animate-fade flex-col gap-0.5 rounded-card border border-line bg-white p-1.5 shadow-[0_10px_30px_rgba(11,31,58,0.14)]"
    >
      {options.map((option) => (
        <OptionRow key={option.status} option={option} current={status} onPick={() => onPick(option.status)} />
      ))}
    </div>,
    document.body,
  );
}

export function StatusMenu({
  status,
  everPublished,
  busy = false,
  onChoose,
  variant = 'badge',
  postTitle,
}: {
  status: NewsStatus;
  everPublished: boolean;
  busy?: boolean;
  onChoose: (status: NewsStatus) => void;
  /** 'field': full width with the hint (editor); 'badge': the badge alone (list rows, phone bar). */
  variant?: 'field' | 'badge';
  /** Names the post in the button's label (list rows). */
  postTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const options = statusOptions(everPublished);
  const current = options.find((o) => o.status === status);
  const close = useCallback(() => setOpen(false), []);
  const name = `Trạng thái${postTitle !== undefined ? ` bài ${postTitle || 'chưa có tiêu đề'}` : ''}: ${current?.label ?? status} – bấm để đổi`;
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        disabled={busy}
        onClick={() => setOpen(!open)}
        className={
          variant === 'field'
            ? 'flex min-h-12 w-full items-center gap-3 rounded-control border border-field bg-white px-3 text-left hover:border-silver-soft disabled:opacity-60'
            : 'inline-flex min-h-9 items-center gap-1 rounded-full border-0 bg-transparent p-0.5 hover:bg-tint disabled:opacity-60'
        }
      >
        <NewsStatusBadge status={status} />
        {variant === 'field' && <span className="min-w-0 flex-1 truncate text-[13px] text-slate">{current?.hint}</span>}
        <Icon name="chevronDown" size={15} className="shrink-0 text-slate" />
      </button>
      {open && (
        <StatusPanel
          anchor={button}
          status={status}
          options={options}
          onClose={close}
          onPick={(next) => {
            close();
            if (next !== status) onChoose(next);
          }}
        />
      )}
    </>
  );
}
