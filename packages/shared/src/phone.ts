/**
 * Normalize a Vietnamese mobile number to 0xxxxxxxxx (10 digits).
 * Accepts spaces, dots, dashes, brackets and +84 / 84 prefixes, with or without a 0 after them. Returns null if invalid: anything else in the
 * input, such as a letter, means it is not a number we can trust, and the digits are not guessed.
 */
export function normalizeVietnamPhone(input: string): string | null {
  if (/[^\d+\s().-]/.test(input)) return null;
  let digits = input.replace(/[^\d+]/g, '');
  // "+84 (0) 912 345 678": the 0 kept after the country code is optional.
  if (digits.startsWith('+84')) digits = `0${digits.slice(3).replace(/^0/, '')}`;
  else if (/^84(?:\d{9}|0\d{9})$/.test(digits)) digits = `0${digits.slice(2).replace(/^0/, '')}`;
  digits = digits.replace(/\+/g, '');
  return /^0[35789]\d{8}$/.test(digits) ? digits : null;
}

/** 0912345678 -> 0912 345 678 */
export function formatPhone(phone: string): string {
  return phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
}

/** Zalo deep link that opens a chat by phone number. */
export function zaloLink(phone: string): string {
  return `https://zalo.me/${phone.replace(/\D/g, '')}`;
}
