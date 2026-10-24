import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ApiError } from '../../api';

/** Turns any thrown value into the message HR should read. */
export function errorMessage(error: unknown, fallback = 'Chưa thực hiện được, thử lại sau ít phút.'): string {
  return apiMessage(error) ?? fallback;
}

/** The BE message, or undefined so callers can fall back to their own copy. */
export function apiMessage(error: unknown): string | undefined {
  return error instanceof ApiError && error.message ? error.message : undefined;
}

export function PageHeading({
  title,
  subtitle,
  action,
  titleHiddenOnPhone = false,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** The navy top bar already shows this title below 1024px. */
  titleHiddenOnPhone?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1
          className={`m-0 font-serif text-[30px] font-medium sm:text-[36px] ${titleHiddenOnPhone ? 'max-lg:sr-only' : ''}`}
        >
          {title}
        </h1>
        {subtitle && <p className="m-0 max-w-[640px] text-sm leading-relaxed text-slate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/**
 * Underlined filter tabs (aria-pressed buttons, like the mockups).
 * `navyOnPhone` paints them white-on-navy below 1024px so they join the top bar.
 */
export function FilterTabs<K extends string>({
  items,
  value,
  onChange,
  label,
  navyOnPhone = false,
  className = '',
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  navyOnPhone?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`scroll-fade-x flex gap-x-6 overflow-x-auto whitespace-nowrap ${className}`}
    >
      {items.map((item) => {
        const on = item.key === value;
        const tone = on
          ? `border-navy font-semibold text-navy ${navyOnPhone ? 'max-lg:border-white max-lg:text-white' : ''}`
          : `border-transparent text-slate hover:text-navy ${navyOnPhone ? 'max-lg:text-silver-soft max-lg:hover:text-white' : ''}`;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.key)}
            className={`-mb-px min-h-12 shrink-0 border-0 border-b-2 bg-transparent px-0.5 text-sm ${tone}`}
          >
            {item.label}
            {item.count != null && (
              <span className={`ml-1 font-normal ${navyOnPhone ? 'text-muted max-lg:text-silver-soft' : 'text-muted'}`}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "⋯" popup menu. Positioned `fixed` from the trigger so it is never clipped
 * by a scrolling table box; closes on outside click, Esc, scroll or resize.
 */
const MENU_WIDTH = 230;

export function PopupMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  /** Only keyboard users get focus moved into the menu; a tap should not light up a focus ring. */
  const byKeyboard = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setStyle(null), []);

  useEffect(() => {
    if (!style) return;
    if (byKeyboard.current)
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      trigger.current?.focus();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [style, close]);

  const toggle = (e: React.MouseEvent) => {
    if (style || !trigger.current) return close();
    byKeyboard.current = e.detail === 0; // Enter/Space on a button fires click with detail 0
    const r = trigger.current.getBoundingClientRect();
    // Align to the trigger's right edge, but never let the menu leave the screen on either side.
    const right = Math.min(Math.max(window.innerWidth - r.right, 8), window.innerWidth - MENU_WIDTH - 8);
    const opensUp = r.bottom + 170 > window.innerHeight;
    setStyle(opensUp ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 });
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={!!style}
        aria-label={label}
        className="inline-flex size-11 items-center justify-center rounded-control border-0 bg-transparent text-body transition-colors hover:bg-tint lg:size-10"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {style && (
        <div
          ref={menu}
          role="menu"
          aria-label={label}
          style={style}
          className="fixed z-30 flex w-[min(230px,calc(100vw-16px))] animate-fade flex-col rounded-card border border-line bg-white py-1.5 text-left shadow-[0_10px_30px_rgba(11,31,58,0.12)]"
        >
          {children(close)}
        </div>
      )}
    </>
  );
}

export function MenuItem({
  children,
  onClick,
  divided = false,
}: {
  children: ReactNode;
  onClick: () => void;
  divided?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2.5 border-0 bg-transparent px-3.5 text-left text-sm text-navy transition-colors hover:bg-tint ${divided ? 'border-t border-line-soft' : ''}`}
    >
      {children}
    </button>
  );
}

/** Letter in a ring/disc, from the given name (last word of a Vietnamese name). */
export function Avatar({ name, size = 42, solid = false }: { name: string; size?: number; solid?: boolean }) {
  const initial = name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-serif font-medium ${
        solid ? 'bg-navy text-white' : 'border border-silver text-accent'
      }`}
    >
      {initial}
    </span>
  );
}
