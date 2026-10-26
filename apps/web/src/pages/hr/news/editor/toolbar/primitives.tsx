import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $setSelection,
  COMMAND_PRIORITY_NORMAL,
  KEY_MODIFIER_COMMAND,
  type BaseSelection,
} from 'lexical';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../../../../../ui/icons';
import { $isSelectionUsable } from '../selectionGuard';

const ITEMS = '[role="menuitem"]:not(:disabled),[role="menuitemradio"]';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const mod = isMac ? '⌘' : 'Ctrl';

/** A keyboard shortcut with ⌘ (Mac) or Ctrl: `key` lower case, `shift` for ⌘⇧ combinations. */
export function useShortcut(key: string, shift: boolean, action: () => void) {
  const [editor] = useLexicalComposerContext();
  const latest = useRef(action);
  latest.current = action;
  useEffect(
    () =>
      editor.registerCommand(
        KEY_MODIFIER_COMMAND,
        (event) => {
          const modifier = isMac ? event.metaKey : event.ctrlKey;
          if (!modifier || event.shiftKey !== shift || event.key.toLowerCase() !== key) return false;
          event.preventDefault();
          latest.current();
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    [editor, key, shift],
  );
}

/** Keeps the caret in the text while a toolbar control is pressed with the mouse. */
export const keepFocus = (e: React.MouseEvent) => e.preventDefault();

export const IconGlyph = ({ name }: { name: IconName }) => <Icon name={name} size={18} stroke={1.7} />;
export const Divider = () => <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-line" />;

const buttonBase =
  'inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-control border-0 px-2 text-[15px] transition-colors disabled:opacity-40';

export function ToolButton({
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onClick}
      className={`${buttonBase} ${pressed ? 'bg-navy text-white' : 'bg-transparent text-navy hover:bg-tint'}`}
    >
      {children}
    </button>
  );
}

/**
 * Runs an editor change from a menu or dialog: the selection saved when it opened is put back first (focus
 * may have moved into the menu), then focus returns to the text unless a dialog is opening. A saved selection
 * is used once: a later run without a new `save` (a table button, "Xoá định dạng") acts where the caret is now.
 */
export function useKeepSelection() {
  const [editor] = useLexicalComposerContext();
  const saved = useRef<BaseSelection | null>(null);
  const save = useCallback(() => {
    saved.current = editor.read(() => $getSelection()?.clone() ?? null);
  }, [editor]);
  const run = useCallback(
    (fn: () => void, focus = true) => {
      editor.update(() => {
        const restore = saved.current;
        saved.current = null;
        if (restore && $isSelectionUsable(restore)) $setSelection(restore.clone());
        fn();
      });
      if (focus) editor.focus();
    },
    [editor],
  );
  return { save, run };
}

/** Menu items on screen (a menu may hide some with CSS). */
const visibleItems = (box: HTMLElement) =>
  [...box.querySelectorAll<HTMLElement>(ITEMS)].filter((el) => el.getClientRects().length > 0);

function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const items = visibleItems(e.currentTarget);
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
  items[next]?.focus();
}

export type MenuRun = (fn: () => void, focus?: boolean) => void;

/** While open: focus the first item, close on a press outside. */
function useMenuOpen(box: React.RefObject<HTMLDivElement | null>, panel: React.RefObject<HTMLDivElement | null>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (panel.current) visibleItems(panel.current)[0]?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!box.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [open, box, panel]);
  return [open, setOpen] as const;
}

const GAP = 8;

/**
 * Fixed on screen under its button, kept inside the window, and following the button when the page or the
 * toolbar scrolls. It is rendered in <body>: inside the toolbar (a scrolling row on phones, and a CSS
 * container, which holds fixed children) it would be cut off.
 */
function usePanelPosition(anchor: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const place = () => {
      const button = anchor.current?.getBoundingClientRect();
      const box = panel.current;
      if (!button || !box) return;
      const left = Math.max(GAP, Math.min(button.left, window.innerWidth - box.offsetWidth - GAP));
      box.style.left = `${left}px`;
      box.style.top = `${button.bottom + 4}px`;
      box.style.maxHeight = `${Math.min(440, Math.max(160, window.innerHeight - button.bottom - 4 - GAP))}px`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, panel]);
}

function MenuPanel({
  label,
  anchor,
  panel,
  onEscape,
  children,
}: {
  label: string;
  anchor: React.RefObject<HTMLElement | null>;
  panel: React.RefObject<HTMLDivElement | null>;
  onEscape: () => void;
  children: ReactNode;
}) {
  usePanelPosition(anchor, panel);
  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      onKeyDown={(e) => {
        moveFocus(e);
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onEscape();
      }}
      className="fixed z-40 flex max-h-[min(440px,60dvh)] w-max min-w-[220px] max-w-[min(320px,calc(100vw-16px))] animate-fade flex-col overflow-y-auto overscroll-contain rounded-card border border-line bg-white p-1.5 shadow-[0_10px_30px_rgba(11,31,58,0.14)]"
    >
      {children}
    </div>,
    document.body,
  );
}

function MenuTrigger({
  buttonRef,
  label,
  open,
  onClick,
  children,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={label}
      title={label}
      onMouseDown={keepFocus}
      onClick={onClick}
      className={`${buttonBase} ${open ? 'bg-tint text-navy' : 'bg-transparent text-navy hover:bg-tint'}`}
    >
      {children}
      <Icon name="chevronDown" size={13} className="text-slate" />
    </button>
  );
}

/** A toolbar dropdown (role="menu"): Esc and a press outside close it; arrows move between items. */
export function ToolMenu({
  label,
  trigger,
  className = '',
  children,
}: {
  label: string;
  trigger: ReactNode;
  className?: string;
  children: (run: MenuRun) => ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useMenuOpen(box, panel);
  const keep = useKeepSelection();
  const run: MenuRun = (fn, focus = true) => {
    setOpen(false);
    keep.run(fn, focus);
  };
  return (
    <div ref={box} className={`relative ${className}`}>
      <MenuTrigger
        buttonRef={button}
        label={label}
        open={open}
        onClick={() => {
          if (!open) keep.save();
          setOpen(!open);
        }}
      >
        {trigger}
      </MenuTrigger>
      {open && (
        <MenuPanel
          label={label}
          anchor={button}
          panel={panel}
          onEscape={() => {
            setOpen(false);
            button.current?.focus();
          }}
        >
          {children(run)}
        </MenuPanel>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  glyph,
  children,
  checked,
  disabled,
  onClick,
}: {
  icon?: IconName;
  /** A drawn icon of its own (H2, H3…) instead of `icon`. */
  glyph?: ReactNode;
  children: ReactNode;
  /** For a choice among several (alignment): shown with a check. */
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onClick}
      className="flex min-h-10 w-full items-center gap-2.5 rounded-control border-0 bg-transparent px-2.5 text-left text-sm text-navy hover:bg-tint focus-visible:bg-tint disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {icon && <Icon name={icon} size={17} className="shrink-0 text-slate" />}
      {glyph && <span className="inline-flex shrink-0 text-slate">{glyph}</span>}
      <span className="flex-1">{children}</span>
      {checked && <Icon name="check" size={15} className="text-accent" />}
    </button>
  );
}

export const MenuHeading = ({ children }: { children: ReactNode }) => (
  <span className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{children}</span>
);
