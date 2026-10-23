import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * A failure the client should see. Serialized as `{ error, fieldErrors, code }`,
 * which `ApiError` in apps/web/src/api/types.ts reads back.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
    /** Machine-readable reason, e.g. "job_closed". */
    public readonly code?: string,
  ) {
    super(message);
  }

  toBody() {
    return { error: this.message, fieldErrors: this.fieldErrors, ...(this.code ? { code: this.code } : {}) };
  }
}

export const notFound = (message: string) => new HttpError(404, message);
export const invalid = (message: string, fieldErrors: Record<string, string> = {}) =>
  new HttpError(422, message, fieldErrors);
