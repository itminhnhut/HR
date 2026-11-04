import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { lastName } from '@careers/shared';
import { useInRouterContext, useLocation } from 'react-router';
import { ApiError } from '../../api';
import { Icon, type IconName } from '../../ui/icons';
import { IconTile } from './design/IconTile';
import { sectionOf } from './design/sections';
import { TONE, type Tone } from './design/tone';

/** Turns any thrown value into the message HR should read. */
export function errorMessage(error: unknown, fallback = 'Chưa thực hiện được, thử lại sau ít phút.'): string {
  return apiMessage(error) ?? fallback;
}

/** The BE message, or undefined so callers can fall back to their own copy. */
export function apiMessage(error: unknown): string | undefined {
  return error instanceof ApiError && error.message ? error.message : undefined;
}

/** The icon of the area this page belongs to, the same as in the menu. */
function SectionMark({ isHiddenOnPhone }: { isHiddenOnPhone: boolean }) {
  const section = sectionOf(useLocation().pathname);
  if (!section) return null;
  return (
    <span className={isHiddenOnPhone ? 'max-lg:hidden' : ''}>
      <IconTile icon={section.icon} tone={section.tone} size={48} />
    </span>
  );
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
  /** The top bar already shows this title below 1024px. */
  titleHiddenOnPhone?: boolean;
}) {
  const isRouted = useInRouterContext();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {isRouted && <SectionMark isHiddenOnPhone={titleHiddenOnPhone} />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1
            className={`m-0 font-serif text-2xl text-navy sm:text-[28px] ${titleHiddenOnPhone ? 'max-lg:sr-only' : ''}`}
          >
            {title}
          </h1>
          {subtitle && <p className="m-0 max-w-[640px] text-sm leading-relaxed text-slate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
  icon?: IconName;
  /** Its colour while active, and of its icon always. Blue without it. */
  tone?: Tone;
}

/** Every tab in the admin: FilterTabs and the tabs of a drawer. */
export function tabClass(isOn: boolean, tone: Tone = 'blue'): string {
  const state = isOn
    ? `${TONE[tone].underline} font-semibold text-navy`
    : 'border-transparent text-slate hover:border-silver hover:text-navy';
  return `-mb-px inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap border-0 border-b-[3px] bg-transparent px-1 text-sm ${state}`;
}

/** The number on a tab: filled in the tab's colour while active; a zero stays quiet. */
export function TabCount({ count, isOn, tone = 'blue' }: { count: number; isOn: boolean; tone?: Tone }) {
  const fill = isOn && count > 0 ? TONE[tone].solid : 'bg-tint text-slate';
  return (
    <span
      className={`inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${fill}`}
    >
      {count}
    </span>
  );
}

/** Underlined filter tabs (aria-pressed buttons), with an icon and a count: one look on every page. */
export function FilterTabs<K extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // No scrollbar: the tabs' underline overlaps the bottom line by 1px, which made browsers draw a stray
      // scrollbar; on narrow screens the faded edge shows that the row scrolls.
      className={`scroll-fade-x flex gap-x-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {items.map((item) => {
        const on = item.key === value;
        const tone = item.tone ?? 'blue';
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.key)}
            className={tabClass(on, tone)}
          >
            {item.icon && <Icon name={item.icon} size={16} className={TONE[tone].text} />}
            {item.label}
            {/* The space keeps the word and the number apart for screen readers. */}{' '}
            {item.count != null && <TabCount count={item.count} isOn={on} tone={tone} />}
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
  // lastName skips notes in brackets: "Nguyễn Văn Hùng (thử)" → H.
  const initial = lastName(name).charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-serif font-medium ${
        solid ? 'bg-primary text-white' : 'border border-primary-line bg-primary-soft text-accent'
      }`}
    >
      {initial}
    </span>
  );
}
