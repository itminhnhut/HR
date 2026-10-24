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

export type CvProblem = 'too_large' | 'not_pdf' | 'broken_pdf';

export const CV_PROBLEM_MESSAGE: Record<CvProblem, string> = {
  too_large: 'File lớn hơn 4 MB. Nén lại hoặc dán link CV.',
  not_pdf: 'CV cần là file PDF.',
  broken_pdf: 'File PDF bị lỗi hoặc chưa tải hết. Lưu lại file rồi thử lại, hoặc dán link CV.',
};

/** How far from the end a real PDF writes its "%%EOF" marker (some writers add a few bytes after it). */
const EOF_WINDOW = 1024;

/**
 * Checks size, the PDF header and the end-of-file marker, not just the browser-supplied name or MIME type.
 * A file cut off mid-upload, or a renamed non-PDF, would only show HR "Failed to load PDF document".
 */
export async function checkCvFile(file: File): Promise<CvProblem | null> {
  if (file.size > CV_MAX_BYTES) return 'too_large';
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') return 'not_pdf';
  const tail = new TextDecoder('latin1').decode(await file.slice(Math.max(0, file.size - EOF_WINDOW)).arrayBuffer());
  return tail.includes('%%EOF') ? null : 'broken_pdf';
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
