import type { CvStore } from '../lib/cv-store.js';
import type { GoogleVerifier } from '../lib/google.js';
import type { OtpChannel, OtpSender } from '../lib/otp.js';

/** In-memory stand-in for Vercel Blob. */
export class MemoryCvStore implements CvStore {
  readonly files = new Map<string, ArrayBuffer>();

  async put(folder: string, file: File) {
    const pathname = `cv/${folder}/${crypto.randomUUID()}.pdf`;
    this.files.set(pathname, await file.arrayBuffer());
    return pathname;
  }

  async get(pathname: string) {
    const bytes = this.files.get(pathname);
    return bytes ? new Blob([bytes]).stream() : null;
  }

  async delete(pathnames: string[]) {
    for (const p of pathnames) this.files.delete(p);
  }

  clear() {
    this.files.clear();
  }
}

export const pdfFile = (name = 'CV.pdf', bytes = 1000) =>
  new File([new TextEncoder().encode('%PDF-1.7\n'), new Uint8Array(bytes)], name, { type: 'application/pdf' });

/** Test ID tokens look like `google:<email>`; anything else is an invalid token. */
export const googleToken = (email: string) => `google:${email}`;

export const fakeGoogle: GoogleVerifier = async (idToken) => {
  const email = idToken.startsWith('google:') ? idToken.slice('google:'.length) : null;
  return email ? { email: email.toLowerCase(), name: 'Người Test' } : null;
};

/** Captures codes instead of sending them, like an SMS inbox. */
export class RecordingOtpSender implements OtpSender {
  readonly revealsCode = false;
  readonly sent: { phone: string; code: string; channel: OtpChannel }[] = [];

  async send(phone: string, code: string, channel: OtpChannel) {
    this.sent.push({ phone, code, channel });
  }

  lastCode(phone: string): string {
    const hit = [...this.sent].reverse().find((s) => s.phone === phone);
    if (!hit) throw new Error(`No code sent to ${phone}`);
    return hit.code;
  }
}
