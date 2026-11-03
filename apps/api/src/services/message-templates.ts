import {
  DEFAULT_MESSAGE_TEMPLATES,
  fieldErrors,
  messageTemplateSchema,
  TEMPLATE_KEYS,
  type MessageTemplate,
  type MessageTemplatesResponse,
  type TemplateKey,
} from '@careers/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { messageTemplates } from '../db/schema.js';
import { invalid, notFound } from '../lib/http-error.js';

type MessageTemplateRow = typeof messageTemplates.$inferSelect;

const isKey = (v: string): v is TemplateKey => (TEMPLATE_KEYS as string[]).includes(v);

function keyOrFail(raw: string): TemplateKey {
  if (!isKey(raw)) throw notFound('Không có mẫu thư này.');
  return raw;
}

const TEXT_FIELDS = ['subject', 'body', 'note', 'calloutTitle', 'callout', 'closing'] as const;

const toTemplate = (row: MessageTemplateRow): MessageTemplate => ({
  key: row.key,
  subject: row.subject,
  body: row.body,
  note: row.note,
  calloutTitle: row.calloutTitle,
  callout: row.callout,
  closing: row.closing,
});

const differsFromBuiltIn = (t: MessageTemplate) =>
  TEXT_FIELDS.some((field) => t[field] !== DEFAULT_MESSAGE_TEMPLATES[t.key][field]);

/** Every template: HR's wording where saved, the built-in text otherwise. */
export async function listMessageTemplates(db: Db): Promise<MessageTemplatesResponse> {
  const rows = await db.select().from(messageTemplates);
  const saved = new Map(rows.map((row) => [row.key, toTemplate(row)]));
  const templates = TEMPLATE_KEYS.map((key) => saved.get(key) ?? DEFAULT_MESSAGE_TEMPLATES[key]);
  return { templates, customized: templates.filter(differsFromBuiltIn).map((t) => t.key) };
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
