import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Bank account numbers at rest (spec-luong.md 10.2): AES-256-GCM under PAYROLL_KEY, a random 12-byte IV per value.
 * Stored as base64 of IV ‖ tag ‖ cipher text, with the key version beside it so a later key can be told apart.
 */

export interface PayrollKey {
  version: number;
  /** 32 bytes. */
  key: Buffer;
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

export function sealAccount(plain: string, key: PayrollKey): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key.key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function openAccount(sealed: string, key: PayrollKey): string {
  const raw = Buffer.from(sealed, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key.key, raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
}

/** PAYROLL_KEY (base64 of 32 bytes) and PAYROLL_KEY_VERSION (default 1); null when the key is not set. */
export function payrollKeyFrom(value: string | undefined, version: string | undefined): PayrollKey | null {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('PAYROLL_KEY must be 32 bytes in base64');
  const parsed = Number(version ?? '1');
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('PAYROLL_KEY_VERSION must be a positive integer');
  return { version: parsed, key };
}
