import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Icon, type IconName } from './icons';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'light' | 'outlineLight' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-glow bg-accent text-white font-semibold',
  dark: 'btn-glow bg-navy text-white font-medium',
  outline: 'border border-silver bg-white text-navy hover:bg-mist transition-colors',
  ghost: 'text-body hover:bg-tint transition-colors',
  light: 'bg-white text-navy font-semibold hover:bg-tint transition-colors',
  outlineLight: 'border border-silver/50 text-white hover:bg-white/10 transition-colors',
  danger: 'btn-glow bg-error text-white font-medium',
  success: 'border border-ok-line bg-white text-ok font-medium hover:bg-ok-soft transition-colors',
};

const SIZE: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm gap-1.5',
  md: 'min-h-12 px-5 text-[15px] gap-2',
  lg: 'min-h-[54px] px-7 text-base gap-2.5',
};

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
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={16} />}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, iconRight, children, className = '', ...rest }: Common & LinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={16} />}
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
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </a>
  );
}
