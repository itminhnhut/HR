import type { CvStore } from '../lib/cv-store.js';
import type { GoogleVerifier } from '../lib/google.js';
import type { ImageExt } from '../lib/image-info.js';
import { isImageName, type ImageStore } from '../lib/image-store.js';
import type { FetchFn } from '../lib/indexnow.js';

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

/** A minimal well-formed PDF: header, filler, end-of-file marker. */
export const pdfFile = (name = 'CV.pdf', bytes = 1000) =>
  new File(
    [new TextEncoder().encode('%PDF-1.7\n'), new Uint8Array(bytes), new TextEncoder().encode('\n%%EOF\n')],
    name,
    {
      type: 'application/pdf',
    },
  );

/** Test ID tokens look like `google:<email>`; anything else is an invalid token. */
export const googleToken = (email: string) => `google:${email}`;

export const fakeGoogle: GoogleVerifier = async (idToken) => {
  const email = idToken.startsWith('google:') ? idToken.slice('google:'.length) : null;
  return email ? { email: email.toLowerCase(), name: 'Người Test' } : null;
};

/** In-memory stand-in for the public Vercel Blob store of news images. */
export class MemoryImageStore implements ImageStore {
  static readonly BASE = 'https://teststore.public.blob.vercel-storage.com/news/';
  readonly files = new Map<string, ArrayBuffer>();

  async put(file: Blob, ext: ImageExt) {
    const url = `${MemoryImageStore.BASE}${crypto.randomUUID()}.${ext}`;
    this.files.set(url, await file.arrayBuffer());
    return { url };
  }

  isOwnUrl(url: string) {
    return url.startsWith(MemoryImageStore.BASE) && isImageName(url.slice(MemoryImageStore.BASE.length));
  }

  clear() {
    this.files.clear();
  }
}

export interface FetchCall {
  url: string;
  body: unknown;
}

/** Records outgoing calls (IndexNow) and answers 200, or whatever `respond` returns. */
export class RecordingFetch {
  readonly calls: FetchCall[] = [];
  respond: () => Promise<Response> = async () => new Response(null, { status: 200 });

  readonly fetch: FetchFn = (url, init) => {
    this.calls.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    return this.respond();
  };

  /** Every address sent to IndexNow so far, in order. */
  indexNowUrls(): string[] {
    return this.calls.flatMap((call) => (call.body as { urlList?: string[] } | null)?.urlList ?? []);
  }

  clear() {
    this.calls.length = 0;
    this.respond = async () => new Response(null, { status: 200 });
  }
}
