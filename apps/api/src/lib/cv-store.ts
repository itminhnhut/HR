import { del, get, put } from '@vercel/blob';
import { CV_MAX_BYTES } from '@careers/shared';

/** Where CV files live. Files are private: only HR reads them, through the API. */
export interface CvStore {
  /** Stores the file and returns its pathname inside the store. */
  put(folder: string, file: File): Promise<string>;
  get(pathname: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(pathnames: string[]): Promise<void>;
}

/** Vercel Blob, PRIVATE store. Locally needs BLOB_READ_WRITE_TOKEN. */
export const vercelBlobCvStore: CvStore = {
  async put(folder, file) {
    const blob = await put(`cv/${folder}/${crypto.randomUUID()}.pdf`, file, {
      access: 'private',
      contentType: 'application/pdf',
    });
    return blob.pathname;
  },
  async get(pathname) {
    const result = await get(pathname, { access: 'private' });
    return result?.statusCode === 200 ? result.stream : null;
  },
  async delete(pathnames) {
    if (pathnames.length > 0) await del(pathnames);
  },
};

export type CvProblem = 'too_large' | 'not_pdf';

export const CV_PROBLEM_MESSAGE: Record<CvProblem, string> = {
  too_large: 'File lớn hơn 4 MB. Nén lại hoặc dán link CV.',
  not_pdf: 'CV cần là file PDF.',
};

/** Checks size and the PDF magic bytes, not just the browser-supplied name or MIME type. */
export async function checkCvFile(file: File): Promise<CvProblem | null> {
  if (file.size > CV_MAX_BYTES) return 'too_large';
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-' ? null : 'not_pdf';
}

export const cvFileName = (file: File) => file.name.slice(0, 200) || 'CV.pdf';

/** Best-effort cleanup after the data is already saved: a leftover file is logged, not worth failing the request. */
export async function deleteFilesQuietly(store: CvStore, pathnames: (string | null)[]): Promise<void> {
  const existing = pathnames.filter((p): p is string => !!p);
  if (existing.length === 0) return;
  try {
    await store.delete(existing);
  } catch (error) {
    console.error('Could not delete CV files', existing, error);
  }
}
