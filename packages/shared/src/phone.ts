/**
 * Normalize a Vietnamese mobile number to 0xxxxxxxxx (10 digits).
 * Accepts spaces, dots, dashes and +84 / 84 prefixes. Returns null if invalid.
 */
export function normalizeVietnamPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;
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
