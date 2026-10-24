import { normalizeVietnamPhone } from '@careers/shared';
import { useState, type InputHTMLAttributes } from 'react';
import { formatPhoneInput, phoneInputProps } from '../lib/phone-input';
import { TextField } from './Field';
import { Icon } from './icons';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** An error from the form or the server wins over the field's own check. */
  error?: string;
  hint?: string;
  optional?: boolean | string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>;

/**
 * Vietnamese mobile number: formats while typing (0912 345 678), accepts pasted +84,
 * checks only when the person leaves the field (never mid-typing) and shows a check mark once valid.
 */
export function PhoneField({ value, onChange, error, onBlur, ...rest }: Props) {
  const [left, setLeft] = useState(false);
  const valid = normalizeVietnamPhone(value) !== null;
  const own = left && value.trim() && !valid ? 'Số điện thoại chưa đúng, cần 10 số, ví dụ 0912 345 678.' : undefined;
  return (
    <TextField
      {...phoneInputProps}
      icon="phone"
      {...rest}
      value={value}
      onChange={(e) => {
        onChange(formatPhoneInput(e.target.value));
        if (left && normalizeVietnamPhone(e.target.value)) setLeft(false);
      }}
      onBlur={(e) => {
        setLeft(true);
        onBlur?.(e);
      }}
      error={error ?? own}
      trailing={valid ? <Icon name="check" size={18} stroke={2} className="shrink-0 text-ok" /> : null}
    />
  );
}
