import { describe, expect, it } from 'vitest';
import { DERIVED_KEY_VERSION, openAccount, payrollKeyFromSecret, sealAccount } from './payroll-crypto.js';

describe('bank account key made from the session secret', () => {
  it('should seal and open an account number with the same secret', () => {
    const key = payrollKeyFromSecret('secret-of-the-test-secret-of-the-test');

    const sealed = sealAccount('0123456789', key);

    expect(sealed).not.toContain('0123456789');
    expect(openAccount(sealed, payrollKeyFromSecret('secret-of-the-test-secret-of-the-test'))).toBe('0123456789');
  });

  it('should give a 32-byte key marked as the derived version', () => {
    const key = payrollKeyFromSecret('secret-of-the-test-secret-of-the-test');

    expect(key.key).toHaveLength(32);
    expect(key.version).toBe(DERIVED_KEY_VERSION);
  });

  it('should not open an account sealed under another secret', () => {
    const sealed = sealAccount('0123456789', payrollKeyFromSecret('first-secret-first-secret-first-secret'));

    expect(() => openAccount(sealed, payrollKeyFromSecret('other-secret-other-secret-other-secret'))).toThrow();
  });
});
