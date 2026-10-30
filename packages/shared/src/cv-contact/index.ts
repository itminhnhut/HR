/**
 * Rule-based reader for the contact block of a CV (no AI, no network): full name, Vietnamese mobile, email.
 * Each field is null when it cannot be found with reasonable confidence; HR types it in then.
 */
import { findEmail } from './email.js';
import { findName } from './name.js';
import { findPhone } from './phone.js';
import { toContactLines } from './text.js';

export interface CvContact {
  fullName: string | null;
  phone: string | null;
  email: string | null;
}

/** Reads the candidate's full name, phone (0xxxxxxxxx) and email (lowercase) from a CV's plain text. */
export function parseCvContact(text: string): CvContact {
  const lines = toContactLines(text);
  return { fullName: findName(lines), phone: findPhone(lines), email: findEmail(lines) };
}
