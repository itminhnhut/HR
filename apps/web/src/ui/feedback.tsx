import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './icons';

/**
 * NN/g: skeletons only for waits over about a second. Under that, show
 * nothing and let the content appear directly.
 */
export function useDelayedFlag(active: boolean, ms = 1000): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return show;
}

export function Sk({
  w,
  h,
  className = '',
  round,
  dark,
}: {
  w?: number | string;
  h: number;
  className?: string;
  round?: boolean;
  dark?: boolean;
}) {
  const style: CSSProperties = { width: w, height: h };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block animate-pulse-soft ${round ? 'rounded-full' : 'rounded-control'} ${dark ? 'bg-silver/15' : 'bg-skeleton'} ${className}`}
    />
  );
}

export function LoadingStatus() {
  return (
    <span role="status" className="sr-only">
      Đang tải…
    </span>
  );
}

export function EmptyState({
  icon = 'search',
  title,
  children,
  actions,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto my-10 flex max-w-[540px] flex-col items-center gap-3.5 text-center">
      <span className="flex rounded-full border border-ring bg-white p-4 text-accent">
        <Icon name={icon} size={20} stroke={1.5} />
      </span>
      <h2 className="m-0 font-serif type-h2-sm font-medium">{title}</h2>
      {children && <div className="text-[15px] leading-relaxed text-slate">{children}</div>}
      {actions && <div className="mt-1 flex flex-wrap justify-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div role="alert">
      <EmptyState
        icon="offline"
        title="Chưa tải được trang"
        actions={onRetry && <Button onClick={onRetry}>Tải lại</Button>}
      >
        {message ?? 'Mạng có thể đang chập chờn. Thử tải lại, thông tin bạn đã nhập vẫn được giữ.'}
      </EmptyState>
    </div>
  );
}

export function Notice({
  tone = 'remind',
  icon = 'clock',
  children,
  action,
}: {
  tone?: 'remind' | 'error' | 'ok' | 'mist';
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    remind: 'bg-tint border-silver text-navy',
    error: 'bg-error-soft border-error/30 text-error',
    ok: 'bg-ok-soft border-ok-line text-ok',
    mist: 'bg-mist border-line text-body',
  } as const;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border px-5 py-4 text-sm leading-relaxed ${tones[tone]}`}
    >
      <Icon name={icon} size={18} className="shrink-0" />
      <div className="min-w-[220px] flex-1">{children}</div>
      {action}
    </div>
  );
}
