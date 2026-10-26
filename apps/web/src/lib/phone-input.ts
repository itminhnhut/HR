/**
 * Formats a Vietnamese mobile number while it is typed: digits only, +84/84 becomes 0,
 * at most 10 digits, grouped 4-3-3 ("0912 345 678") so it is easy to read back.
 */
export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+84') || (digits.startsWith('84') && digits.length > 9)) digits = `0${digits.slice(2)}`;
  digits = digits.slice(0, 10);
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(' ');
}

/** Props for any phone <input>: numeric keypad, autofill, live formatting. */
export const phoneInputProps = {
  type: 'tel',
  inputMode: 'tel',
  // "tel" (not "tel-national"): iOS only offers the saved number with it; +84 is turned into 0 anyway.
  autoComplete: 'tel',
  maxLength: 12,
  // A pattern, not a real-looking number: an example that looks typed in reads as filled (the hint has one).
  placeholder: 'VD: 09xx xxx xxx',
} as const;
