import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from './icons';

/** An error under a field: orange-red text with an alert icon, so it never relies on colour alone. */
export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <span id={id} role="alert" className="flex items-start gap-1.5 text-[13px] leading-snug text-error">
      <Icon name="alert" size={15} className="mt-px shrink-0" />
      <span>{children}</span>
    </span>
  );
}

interface FieldShell {
  label: ReactNode;
  optional?: boolean | string;
  hint?: ReactNode;
  error?: string;
  icon?: IconName;
  className?: string;
  /** Shown at the end of the box, e.g. a check mark when the value is valid. */
  trailing?: ReactNode;
}

const boxBase = 'field-focus flex items-center gap-3 rounded-control border bg-white px-4';

export function TextField({
  label,
  optional,
  hint,
  error,
  icon,
  className = '',
  trailing,
  ...input
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-navy">
        {label}{' '}
        {optional && (
          <span className="font-normal text-muted">({optional === true ? 'không bắt buộc' : optional})</span>
        )}
      </label>
      <div className={`${boxBase} min-h-[52px] ${error ? 'border-error' : 'border-field'}`}>
        {icon && <Icon name={icon} size={18} className="shrink-0 text-muted" />}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-navy outline-none placeholder:text-placeholder"
          {...input}
        />
        {trailing}
      </div>
      {hint && !error && <span className="text-[13px] text-muted">{hint}</span>}
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
}

export function TextArea({
  label,
  optional,
  hint,
  error,
  className = '',
  counter,
  ...rest
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement> & { counter?: { value: number; max: number } }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-navy">
        {label}{' '}
        {optional && (
          <span className="font-normal text-muted">({optional === true ? 'không bắt buộc' : optional})</span>
        )}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={`field-focus rounded-control border bg-white px-4 py-3 text-[15px] text-navy outline-none placeholder:text-placeholder ${error ? 'border-error' : 'border-field'}`}
        {...rest}
      />
      <div className="flex justify-between gap-4">
        {hint && !error ? <span className="text-[13px] text-muted">{hint}</span> : <FieldError>{error}</FieldError>}
        {counter && (
          <span className="ml-auto text-xs text-muted">
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The select fills its whole bordered box (not just the text line), so a tap anywhere on the box opens it.
 * The leading icon and the chevron sit underneath and let taps through.
 */
export function SelectField({
  label,
  icon,
  className = '',
  children,
  hideLabel,
  ...rest
}: Omit<FieldShell, 'error' | 'hint' | 'optional'> &
  SelectHTMLAttributes<HTMLSelectElement> & { hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-navy'}>
        {label}
      </label>
      <div className={`${boxBase} relative min-h-[46px] border-field`}>
        {icon && <Icon name={icon} size={17} className="pointer-events-none shrink-0 text-muted" />}
        <select
          id={id}
          className={`absolute inset-0 size-full min-w-0 cursor-pointer appearance-none truncate rounded-control border-0 bg-transparent pr-9 text-[15px] text-navy outline-none ${icon ? 'pl-11' : 'pl-4'}`}
          {...rest}
        >
          {children}
        </select>
        <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 text-slate" />
      </div>
    </div>
  );
}

export function Checkbox({
  children,
  className = '',
  error,
  ...rest
}: { children: ReactNode; className?: string; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  return (
    <>
      <label className={`flex items-start gap-2.5 text-[13px] leading-relaxed text-body ${className}`}>
        <input
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="mt-0.5 size-[18px] shrink-0 accent-accent max-sm:size-5"
          {...rest}
        />
        <span>{children}</span>
      </label>
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </>
  );
}
