/**
 * Exact fractions for money. A daily rate such as 22.450.000 ÷ 22 stays whole until a cell is rounded, so a cell
 * is the same to the dong on every machine (spec 5.7, test catalogue K: "tính bằng phân số đúng").
 */
export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x === 0n ? 1n : x;
};

function make(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new RangeError('Payroll: division by zero');
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
}

/** A decimal number as typed (0,015; 19,5; 6.400.000) to an exact fraction. */
function fromNumber(x: number): Rational {
  if (!Number.isFinite(x)) throw new RangeError(`Payroll: not a finite number: ${x}`);
  if (Number.isInteger(x)) return make(BigInt(x), 1n);
  const text = String(x);
  if (/e/i.test(text)) throw new RangeError(`Payroll: number too small or too large to be exact: ${text}`);
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const scale = 10n ** BigInt(fraction.length);
  const magnitude = BigInt(whole) * scale + BigInt(fraction || '0');
  return make(x < 0 ? -magnitude : magnitude, scale);
}

export type Numeric = Rational | number | bigint;

export function rat(x: Numeric): Rational {
  if (typeof x === 'bigint') return make(x, 1n);
  if (typeof x === 'number') return fromNumber(x);
  return x;
}

export const ZERO: Rational = { n: 0n, d: 1n };
export const ONE: Rational = { n: 1n, d: 1n };

export function add(a: Numeric, b: Numeric): Rational {
  const x = rat(a);
  const y = rat(b);
  return make(x.n * y.d + y.n * x.d, x.d * y.d);
}

export const neg = (a: Numeric): Rational => {
  const x = rat(a);
  return { n: -x.n, d: x.d };
};

export const sub = (a: Numeric, b: Numeric): Rational => add(a, neg(b));

export function mul(...xs: Numeric[]): Rational {
  return xs.reduce<Rational>((acc, x) => {
    const y = rat(x);
    return make(acc.n * y.n, acc.d * y.d);
  }, ONE);
}

export function div(a: Numeric, b: Numeric): Rational {
  const y = rat(b);
  return mul(a, make(y.d, y.n));
}

export const sum = (xs: readonly Numeric[]): Rational => xs.reduce<Rational>((acc, x) => add(acc, x), ZERO);

/** Negative, zero or positive as a is below, equal to or above b. */
export function cmp(a: Numeric, b: Numeric): number {
  const diff = sub(a, b);
  return diff.n === 0n ? 0 : diff.n < 0n ? -1 : 1;
}

export const min = (a: Numeric, b: Numeric): Rational => (cmp(a, b) <= 0 ? rat(a) : rat(b));
export const max = (a: Numeric, b: Numeric): Rational => (cmp(a, b) >= 0 ? rat(a) : rat(b));
export const clamp = (x: Numeric, lo: Numeric, hi: Numeric): Rational => min(max(x, lo), hi);
export const isZero = (x: Numeric): boolean => rat(x).n === 0n;

/** To the dong, half a dong away from zero (spec 5.7, D01). */
export function roundDong(x: Numeric): number {
  const { n, d } = rat(x);
  const magnitude = n < 0n ? -n : n;
  const rounded = (2n * magnitude + d) / (2n * d);
  return Number(n < 0n ? -rounded : rounded);
}

/** The dong, as an exact fraction. */
export const roundedDong = (x: Numeric): Rational => rat(roundDong(x));

/** For display only, such as a percentage or a daily rate kept whole. */
export const toNumber = (x: Numeric): number => {
  const { n, d } = rat(x);
  return Number(n) / Number(d);
};

/**
 * D01. `cell`: a money cell is rounded as it is computed and the next cell uses the rounded value. `as-hr`: full
 * numbers throughout, as HR's workbook does, rounded only when shown.
 */
export type RoundingMode = 'cell' | 'as-hr';

export const moneyCell =
  (mode: RoundingMode) =>
  (x: Numeric): Rational =>
    mode === 'cell' ? roundedDong(x) : rat(x);
