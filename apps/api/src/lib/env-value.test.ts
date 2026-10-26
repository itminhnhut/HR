import { describe, expect, it } from 'vitest';
import { companyName, envValue } from './env-value.js';

describe('envValue', () => {
  it('should treat a "[...]" placeholder copied from .env.example as unset', () => {
    expect(envValue('[Tên công ty]')).toBe('');
    expect(envValue('  [Địa chỉ trang]  ')).toBe('');
  });

  it('should keep a real value, trimmed', () => {
    expect(envValue(' TOP FLOW ')).toBe('TOP FLOW');
    expect(envValue(undefined)).toBe('');
  });
});

describe('companyName', () => {
  it('should use the default name when COMPANY_NAME is still the placeholder', () => {
    expect(companyName({ COMPANY_NAME: '[Tên công ty]' })).toBe('TOP FLOW');
  });

  it('should use COMPANY_NAME when it is set', () => {
    expect(companyName({ COMPANY_NAME: 'Công ty Cổ phần Top Flow' })).toBe('Công ty Cổ phần Top Flow');
    expect(companyName({})).toBe('TOP FLOW');
  });
});
