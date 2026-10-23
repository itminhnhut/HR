import { describe, expect, it } from 'vitest';
import { formatPhone, normalizeVietnamPhone } from './phone.js';

describe('normalizeVietnamPhone', () => {
  it.each([
    ['0912345678', '0912345678'],
    ['0912 345 678', '0912345678'],
    ['0912.345.678', '0912345678'],
    ['+84912345678', '0912345678'],
    ['+84 912 345 678', '0912345678'],
    ['84912345678', '0912345678'],
    ['0389-123-456', '0389123456'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeVietnamPhone(input)).toBe(expected);
  });

  it.each(['', '12345', '091234567', '09123456789', '0212345678', 'abc', '+1 415 555 0100'])('rejects %s', (input) => {
    expect(normalizeVietnamPhone(input)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('groups digits', () => {
    expect(formatPhone('0912345678')).toBe('0912 345 678');
  });
});
