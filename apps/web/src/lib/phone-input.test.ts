import { describe, expect, it } from 'vitest';
import { formatPhoneInput } from './phone-input';

describe('formatPhoneInput', () => {
  it('groups digits 4-3-3 as they are typed', () => {
    expect(formatPhoneInput('0')).toBe('0');
    expect(formatPhoneInput('09123')).toBe('0912 3');
    expect(formatPhoneInput('0912345')).toBe('0912 345');
    expect(formatPhoneInput('0912345678')).toBe('0912 345 678');
  });

  it('drops anything that is not a digit and stops at 10 digits', () => {
    expect(formatPhoneInput('0912.345-678')).toBe('0912 345 678');
    expect(formatPhoneInput('09123456789999')).toBe('0912 345 678');
    expect(formatPhoneInput('abc')).toBe('');
  });

  it('turns +84 / 84 into a leading 0', () => {
    expect(formatPhoneInput('+84 912 345 678')).toBe('0912 345 678');
    expect(formatPhoneInput('84912345678')).toBe('0912 345 678');
  });

  it('keeps editing stable when the formatted value is typed into again', () => {
    expect(formatPhoneInput(formatPhoneInput('0912345678'))).toBe('0912 345 678');
    expect(formatPhoneInput('0912 345 67')).toBe('0912 345 67');
  });
});
