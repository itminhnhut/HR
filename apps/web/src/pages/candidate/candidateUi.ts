import { ApiError } from '../../api';

/** Readable message for a failed request; field errors win over the generic message. */
export function errorText(error: unknown, field: string | null, fallback: string): string {
  if (error instanceof ApiError) return (field && error.fieldErrors[field]) || error.message || fallback;
  return fallback;
}

/** Only same-site paths are allowed as a post-login destination (no open redirects). */
export function safeNextPath(raw: string | null, fallback = '/ho-so-cua-toi'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

export const ACCOUNT_PATH = '/ho-so-cua-toi';
