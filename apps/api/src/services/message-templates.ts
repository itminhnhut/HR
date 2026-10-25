import {
  DEFAULT_MESSAGE_TEMPLATES,
  fieldErrors,
  messageTemplateSchema,
  TEMPLATE_KEYS,
  type MessageTemplatesResponse,
  type TemplateKey,
} from '@careers/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { messageTemplates } from '../db/schema.js';
import { invalid, notFound } from '../lib/http-error.js';

const isKey = (v: string): v is TemplateKey => (TEMPLATE_KEYS as string[]).includes(v);

function keyOrFail(raw: string): TemplateKey {
  if (!isKey(raw)) throw notFound('Không có mẫu thư này.');
  return raw;
}

/** Every template: HR's wording where saved, the built-in text otherwise. */
export async function listMessageTemplates(db: Db): Promise<MessageTemplatesResponse> {
  const saved = new Map((await db.select().from(messageTemplates)).map((row) => [row.key, row]));
  return {
    templates: TEMPLATE_KEYS.map((key) => {
      const row = saved.get(key);
      return row ? { key, subject: row.subject, body: row.body } : DEFAULT_MESSAGE_TEMPLATES[key];
    }),
    customized: TEMPLATE_KEYS.filter((key) => saved.has(key)),
  };
}

export async function saveMessageTemplate(db: Db, rawKey: string, raw: unknown): Promise<MessageTemplatesResponse> {
  const key = keyOrFail(rawKey);
  const parsed = messageTemplateSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chưa lưu được, kiểm tra các ô được đánh dấu.', fieldErrors(parsed.error));
  await db
    .insert(messageTemplates)
    .values({ key, ...parsed.data })
    .onConflictDoUpdate({ target: messageTemplates.key, set: parsed.data });
  return listMessageTemplates(db);
}

/** "Dùng lại mẫu gốc". */
export async function resetMessageTemplate(db: Db, rawKey: string): Promise<MessageTemplatesResponse> {
  await db.delete(messageTemplates).where(eq(messageTemplates.key, keyOrFail(rawKey)));
  return listMessageTemplates(db);
}
