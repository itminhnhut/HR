import { describe, expect, it } from 'vitest';
import { envValue } from './site';

describe('envValue', () => {
  it('should treat a placeholder copied from .env.example as not set', () => {
    expect(envValue('[Tên công ty]')).toBe('');
    expect(envValue(' [email HR] ')).toBe('');
  });

  it('should keep a real value, trimmed', () => {
    expect(envValue(' TOP FLOW ')).toBe('TOP FLOW');
    expect(envValue('hr@lee-hr.com')).toBe('hr@lee-hr.com');
  });

  it('should treat a missing value as not set', () => {
    expect(envValue(undefined)).toBe('');
  });
});
