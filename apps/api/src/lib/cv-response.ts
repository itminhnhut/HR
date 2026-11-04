/** A CV from the private store, shown in the browser and kept out of caches and search engines. */
export const cvResponse = (stream: ReadableStream, fullName: string) =>
  new Response(stream, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(`CV-${fullName}.pdf`)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
