import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** OWASP recommendation for scrypt: N=2^17, r=8, p=1 (128 MiB, about 0.2 s per hash). */
const PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...options, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

/** "scrypt$N$r$p$salt$hash" (base64), so the cost can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True for hashes made with weaker settings than today's; they are upgraded at the next sign-in. */
export function needsRehash(stored: string): boolean {
  const [algo, n, r, p] = stored.split('$');
  return algo !== 'scrypt' || Number(n) < PARAMS.N || Number(r) < PARAMS.r || Number(p) < PARAMS.p;
}

let dummy: Promise<string> | undefined;
/** A hash of a random password: unknown emails take as long to reject as wrong passwords. */
export const dummyHash = () => (dummy ??= hashPassword(randomBytes(16).toString('hex')));

export const MIN_PASSWORD_LENGTH = 12;

const COMMON = [
  'password',
  'matkhau',
  'mat-khau',
  '123456',
  'qwerty',
  'admin',
  'abc123',
  'iloveyou',
  'welcome',
  'letmein',
  'tuyendung',
  'nhansu',
  'congty',
];

/** Null when acceptable, else the reason in Vietnamese (shown by scripts/hr-user.ts). */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'Mật khẩu cần ít nhất 3 trong 4 loại: chữ thường, chữ hoa, số, ký tự đặc biệt.';
  const lower = password.toLowerCase();
  const name = email.split('@')[0]?.toLowerCase() ?? '';
  if (name.length >= 3 && lower.includes(name)) return 'Mật khẩu không được chứa tên email.';
  if (COMMON.some((word) => lower.includes(word))) return 'Mật khẩu chứa cụm quá phổ biến, dễ bị đoán.';
  if (/(.)\1{3,}/.test(password)) return 'Mật khẩu không được lặp một ký tự quá 3 lần liền.';
  return null;
}

const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

/** 4 groups of 5 without look-alike characters (≈ 113 bits), always passing `passwordProblem`. */
export function generatePassword(): string {
  for (;;) {
    const chars = Array.from({ length: 20 }, () => ALL[randomInt(ALL.length)]);
    const password = [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-');
    if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      if (!passwordProblem(password, '')) return password;
    }
  }
}

/** Short fingerprint of the stored hash; sessions carry it so a password change signs everyone out. */
export const passwordFingerprint = (stored: string) => stored.slice(-12);
