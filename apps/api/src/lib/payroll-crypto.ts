import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

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

/** The version of a key made from the session secret, so a later PAYROLL_KEY (1 and up) is told apart. */
export const DERIVED_KEY_VERSION = 0;

/**
 * PAYROLL_KEY left unset: the key comes from SESSION_SECRET, so bank accounts are still sealed at rest without one more
 * variable to manage. Changing SESSION_SECRET then makes the stored account numbers unreadable (they must be typed again).
 */
export function payrollKeyFromSecret(sessionSecret: string): PayrollKey {
  const key = createHash('sha256').update(`payroll-bank-account:${sessionSecret}`).digest();
  return { version: DERIVED_KEY_VERSION, key };
}

/** What decides the bank-account key at start-up (main.ts). */
export interface PayrollKeySource {
  /** PAYROLL_KEY and PAYROLL_KEY_VERSION as set, or undefined. */
  payrollKey: string | undefined;
  payrollKeyVersion: string | undefined;
  sessionSecret: string;
  /** The secret is the one written in the code (local dev fallback), so anyone could make the key from it. */
  isPublicSecret: boolean;
  /** Accounts land in a real database (DATABASE_URL), not the local in-process PGlite. */
  isRealDb: boolean;
}

/**
 * PAYROLL_KEY when set, else the key made from the session secret. Null (saving or showing a number answers 503) only
 * when that secret is the public local one and the database is real, so real accounts are never sealed with a key
 * anyone can make.
 */
export function payrollKeyOf(source: PayrollKeySource): PayrollKey | null {
  const set = payrollKeyFrom(source.payrollKey, source.payrollKeyVersion);
  if (set) return set;
  if (source.isPublicSecret && source.isRealDb) return null;
  return payrollKeyFromSecret(source.sessionSecret);
}
