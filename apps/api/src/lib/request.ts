import type { Context } from 'hono';
import { HttpError } from './http-error.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids from the URL or body are checked before they reach Postgres, which rejects malformed uuids loudly. */
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên không đọc được.');
  }
}

export interface MultipartBody {
  fields: Record<string, string>;
  file: File | null;
}

/** Multipart form with one optional file field. Everything else arrives as text. */
export async function readMultipart(c: Context, fileField: string): Promise<MultipartBody> {
  let body: Record<string, string | File>;
  try {
    body = await c.req.parseBody();
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên không đọc được.');
  }
  const fields: Record<string, string> = {};
  let file: File | null = null;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') fields[key] = value;
    else if (key === fileField && value.size > 0) file = value;
  }
  return { fields, file };
}
