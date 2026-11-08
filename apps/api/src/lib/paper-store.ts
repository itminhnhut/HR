import { del, get, put } from '@vercel/blob';

/**
 * Where papers kept with an absence live (sick notes, certificates). PRIVATE like CVs, in the same store:
 * health papers are read only by HR, through the API, never from a public address.
 */
export interface PaperStore {
  put(pathname: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(pathname: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(pathnames: string[]): Promise<void>;
}

/** Vercel Blob, PRIVATE store (BLOB_READ_WRITE_TOKEN, the one CVs use). */
export const vercelBlobPaperStore: PaperStore = {
  async put(pathname, bytes, contentType) {
    await put(pathname, new Blob([bytes as Uint8Array<ArrayBuffer>]), { access: 'private', contentType, addRandomSuffix: false });
  },
  async get(pathname) {
    const result = await get(pathname, { access: 'private' });
    return result?.statusCode === 200 ? result.stream : null;
  },
  async delete(pathnames) {
    if (pathnames.length > 0) await del(pathnames);
  },
};

/** Cleanup after the data is already saved: a leftover file is logged, not worth failing the request. */
export async function deletePapersQuietly(store: PaperStore, pathnames: readonly string[]): Promise<void> {
  if (pathnames.length === 0) return;
  try {
    await store.delete([...pathnames]);
  } catch (error) {
    console.error('Could not delete absence papers', pathnames, error);
  }
}
