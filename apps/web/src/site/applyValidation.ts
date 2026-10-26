import { CV_MAX_BYTES, normalizeVietnamPhone } from '@careers/shared';

/** saved = the CV stored in the signed-in account (one CV per account). */
export type CvMode = 'saved' | 'file' | 'link';

export type ApplyErrors = Partial<
  Record<'fullName' | 'phone' | 'email' | 'cv' | 'cvLink' | 'consent' | 'message' | 'captcha', string>
>;

export interface ApplyFormValues {
  fullName: string;
  phone: string;
  email: string;
  cvFile: File | null;
  cvLink: string;
  mode: CvMode;
  consent: boolean;
}

/** Same words as the server (packages/shared validation.ts), so a message never changes after sending. */
export const APPLY_MESSAGES = {
  fullName: 'Nhập họ và tên.',
  phoneMissing: 'Nhập số điện thoại (Zalo).',
  phoneWrong: 'Số điện thoại chưa đúng, cần 10 số, ví dụ 0912 345 678.',
  email: 'Email chưa đúng.',
  cvMissing: 'Đính kèm file CV hoặc dán link CV.',
  cvLink: 'Dán link CV bắt đầu bằng http:// hoặc https://',
  consent: 'Hãy tích ô đồng ý để gửi hồ sơ.',
} as const;

/** Checks the form before sending; an empty field asks for it, a wrong one says what is wrong. */
export function validateApply(f: ApplyFormValues): ApplyErrors {
  const e: ApplyErrors = {};
  if (f.fullName.trim().length < 2) e.fullName = APPLY_MESSAGES.fullName;
  if (!f.phone.trim()) e.phone = APPLY_MESSAGES.phoneMissing;
  else if (!normalizeVietnamPhone(f.phone)) e.phone = APPLY_MESSAGES.phoneWrong;
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = APPLY_MESSAGES.email;
  if (f.mode === 'file' && !f.cvFile) e.cv = APPLY_MESSAGES.cvMissing;
  if (f.mode === 'link' && !/^https?:\/\/\S+/i.test(f.cvLink.trim())) e.cv = APPLY_MESSAGES.cvLink;
  if (!f.consent) e.consent = APPLY_MESSAGES.consent;
  return e;
}

export function checkCvFile(file: File): string | null {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return 'CV cần là file PDF.';
  if (file.size > CV_MAX_BYTES) return 'File lớn hơn 4 MB. Nén lại hoặc dán link CV.';
  return null;
}

/**
 * After a refused send: focus the first field with a problem and scroll it to the middle of the form, so
 * its message is not hidden under the sticky "Gửi hồ sơ" bar at the bottom.
 */
export function revealFirstError(root: ParentNode = document) {
  const field = root.querySelector<HTMLElement>('dialog[open] [aria-invalid="true"], dialog[open] [data-error="true"]');
  if (!field) return;
  field.focus({ preventScroll: true });
  const message = field.getAttribute('aria-describedby');
  const target = (message && document.getElementById(message)) || field;
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView?.({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
}
