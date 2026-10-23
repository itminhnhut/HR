import { del, get, put } from '@vercel/blob';

/** Vercel Functions cap request bodies at 4.5 MB; keep headroom for the other fields. */
export const MAX_CV_BYTES = 4 * 1024 * 1024;

export type CvProblem = 'empty' | 'too_large' | 'not_pdf';

export const CV_PROBLEM_MESSAGE: Record<CvProblem, string> = {
  empty: 'File CV đang trống.',
  too_large: 'File CV lớn hơn 4 MB. Hãy nén lại hoặc dán link CV.',
  not_pdf: 'CV cần là file PDF.',
};

/** Check size and the PDF magic bytes, not just the browser-supplied MIME type. */
export async function checkCvFile(file: File): Promise<CvProblem | null> {
  if (file.size === 0) return 'empty';
  if (file.size > MAX_CV_BYTES) return 'too_large';
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-' ? null : 'not_pdf';
}

export async function storeCv(jobId: string, file: File): Promise<string> {
  const blob = await put(`cv/${jobId}/${crypto.randomUUID()}.pdf`, file, {
    access: 'private',
    contentType: 'application/pdf',
  });
  return blob.pathname;
}

export function readCv(pathname: string) {
  return get(pathname, { access: 'private' });
}

export async function deleteCvs(pathnames: string[]): Promise<void> {
  if (pathnames.length > 0) await del(pathnames);
}
