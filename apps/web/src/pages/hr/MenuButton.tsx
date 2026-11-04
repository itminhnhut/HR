import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { buttonClass } from '../../ui/Button';
import { Icon } from '../../ui/icons';

type FocusOnOpen = 'first' | 'last';

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return menu ? [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')] : [];
}

/** Where a key sends the focus inside an open menu; null for keys the menu does not use. */
function nextIndex(key: string, current: number, count: number): number | null {
  if (key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowUp') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** Arrows, Home and End inside an open menu. */
function moveFocus(e: KeyboardEvent, menu: HTMLElement | null) {
  const items = menuItems(menu);
  const current = items.findIndex((item) => item === document.activeElement);
  const next = items.length > 0 ? nextIndex(e.key, current, items.length) : null;
  if (next === null) return;
  e.preventDefault();
  items[next]?.focus();
}

function useMenuButton() {
  const [isOpen, setIsOpen] = useState(false);
  const focusOnOpen = useRef<FocusOnOpen>('first');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    menuItems(menu.current)
      .at(focusOnOpen.current === 'first' ? 0 : -1)
      ?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setIsOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  const open = (focus: FocusOnOpen) => {
    focusOnOpen.current = focus;
    setIsOpen(true);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      open(e.key === 'ArrowDown' ? 'first' : 'last');
      return;
    }
    if (e.key === 'Escape' || e.key === 'Tab') {
      // Tab: the browser then moves on from the button, as if the menu had not been there.
      if (e.key === 'Escape') e.preventDefault();
      close();
      return;
    }
    moveFocus(e, menu.current);
  };

  const toggle = () => (isOpen ? setIsOpen(false) : open('first'));
  return { isOpen, root, trigger, menu, close, toggle, onKeyDown };
}

/**
 * A button that opens a list of actions (the WAI-ARIA menu button pattern): focus moves into the menu, arrows,
 * Home and End move inside it, Esc closes it and returns to the button. `children` gets `close`, which also
 * returns the focus, so a dialog opened from an item comes back to the button afterwards.
 */
export function MenuButton({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const { isOpen, root, trigger, menu, close, toggle, onKeyDown } = useMenuButton();
  const id = useId();
  return (
    <div ref={root} onKeyDown={onKeyDown} className="relative">
      <button
        ref={trigger}
        id={`${id}-button`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-menu` : undefined}
        onClick={toggle}
        className={buttonClass('outline', 'compact', 'whitespace-nowrap font-medium')}
      >
        {label}
        <Icon
          name="chevronDown"
          size={16}
          className={`transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={`${id}-button`}
          className="absolute right-0 top-full z-30 mt-1 flex w-[220px] animate-fade flex-col rounded-control border border-line bg-white py-1.5 text-left shadow-[0_10px_30px_rgba(11,31,58,0.12)]"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
