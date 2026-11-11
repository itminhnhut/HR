import { describe, expect, it } from 'vitest';
import {
  DERIVED_KEY_VERSION,
  openAccount,
  payrollKeyFromSecret,
  payrollKeyOf,
  sealAccount,
  type PayrollKeySource,
} from './payroll-crypto.js';

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

describe('which key seals bank accounts', () => {
  const SECRET = 'secret-of-the-test-secret-of-the-test';
  const source = (over: Partial<PayrollKeySource>): PayrollKeySource => ({
    payrollKey: undefined,
    payrollKeyVersion: undefined,
    sessionSecret: SECRET,
    isPublicSecret: false,
    isRealDb: true,
    ...over,
  });

  it('should derive the key from the session secret when PAYROLL_KEY is unset', () => {
    // Act
    const key = payrollKeyOf(source({}));

    // Assert
    expect(key?.version).toBe(DERIVED_KEY_VERSION);
    expect(key?.key.equals(payrollKeyFromSecret(SECRET).key)).toBe(true);
  });

  it('should give no key when the public local secret would seal accounts in a real database', () => {
    // Act
    const key = payrollKeyOf(source({ isPublicSecret: true, isRealDb: true }));

    // Assert
    expect(key).toBeNull();
  });

  it('should keep deriving a key from the public local secret for the local in-process database', () => {
    // Act
    const key = payrollKeyOf(source({ isPublicSecret: true, isRealDb: false }));

    // Assert
    expect(key?.version).toBe(DERIVED_KEY_VERSION);
  });

  it('should use PAYROLL_KEY when it is set, whatever the session secret', () => {
    // Arrange
    const raw = Buffer.alloc(32, 7).toString('base64');

    // Act
    const key = payrollKeyOf(source({ payrollKey: raw, payrollKeyVersion: '2', isPublicSecret: true }));

    // Assert
    expect(key?.version).toBe(2);
  });
});
