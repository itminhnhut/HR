import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Icon, type IconName } from './icons';

type Variant = 'primary' | 'brand' | 'dark' | 'outline' | 'ghost' | 'light' | 'outlineLight' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

/**
 * One primary look for the main action of a view (apply, send, look up, publish): brand red with a white
 * label (6.7:1; hover 9.2:1). Secondary actions are `outline`. Colour roles: styles.css.
 */
const PRIMARY =
  'bg-brand text-white font-semibold shadow-[0_6px_18px_-8px_rgb(176_33_63/0.6)] transition-colors hover:bg-brand-deep hover:text-white focus-visible:bg-brand-deep';

const VARIANT: Record<Variant, string> = {
  primary: PRIMARY,
  /** Same as primary; kept so older call sites read the same. */
  brand: PRIMARY,
  dark: 'btn-glow bg-navy text-white font-medium',
  outline: 'border border-silver bg-white text-navy hover:bg-mist transition-colors',
  ghost: 'text-body hover:bg-tint transition-colors',
  light: 'bg-white text-navy font-semibold hover:bg-tint transition-colors',
  outlineLight: 'border border-silver/50 text-white hover:bg-white/10 transition-colors',
  /** Destructive: the orange-red error colour (never the brand red), always with an icon. */
  danger: 'bg-error text-white font-medium transition-colors hover:bg-error-deep hover:text-white',
  success: 'border border-ok-line bg-white text-ok font-medium hover:bg-ok-soft transition-colors',
};

/** Two touch heights on public pages: 44px (md) and 52px (lg). sm (40px) is for dense HR tables only. */
const SIZE: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-[15px] gap-2',
  lg: 'min-h-[52px] px-7 text-base gap-2.5',
};

/** Icon sizes follow the button: 16px, or 20px on the large one. */
const iconSize = (size: Size | undefined) => (size === 'lg' ? 20 : 16);

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center rounded-control no-underline disabled:opacity-60 ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
  className?: string;
}

export function Button({
  variant,
  size,
  icon,
  iconRight,
  children,
  className = '',
  type = 'button',
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={iconSize(size)} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize(size)} />}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, iconRight, children, className = '', ...rest }: Common & LinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={iconSize(size)} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize(size)} />}
    </Link>
  );
}

/** External link styled as a button (Zalo, tel:, mailto:). */
export function ButtonAnchor({
  variant,
  size,
  icon,
  children,
  className = '',
  ...rest
}: Common & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={iconSize(size)} />}
      {children}
    </a>
  );
}
