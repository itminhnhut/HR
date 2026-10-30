import {
  fieldErrors,
  OTHER_SOURCE,
  sameSourceName,
  sourceCreateSchema,
  sourceKeyFor,
  sourceNameKey,
  SOURCES_MAX,
  sourceUpdateSchema,
  WEBSITE_SOURCE,
  type HrMe,
  type SourceDto,
} from '@careers/shared';
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applications, applicationSources, type ApplicationSourceRow } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';

/** HR's list of application sources (spec-custom-sources.md). */

/** The sources migration 0016 creates; tests put them back after emptying the tables. */
export const DEFAULT_SOURCES = [
  { key: WEBSITE_SOURCE, name: 'Website', kind: 'system' },
  { key: 'email', name: 'Email', kind: 'builtin' },
  { key: 'zalo', name: 'Zalo', kind: 'builtin' },
  { key: 'referral', name: 'Người giới thiệu', kind: 'builtin' },
  { key: 'topcv', name: 'TopCV', kind: 'builtin' },
  { key: 'vietnamworks', name: 'VietnamWorks', kind: 'builtin' },
  { key: 'facebook', name: 'Facebook', kind: 'builtin' },
  { key: OTHER_SOURCE, name: 'Khác', kind: 'builtin' },
] as const;

export async function listSources(db: Db): Promise<SourceDto[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(applicationSources).orderBy(asc(applicationSources.position), asc(applicationSources.createdAt)),
    db
      .select({ key: applications.source, n: sql<number>`count(*)`.mapWith(Number) })
      .from(applications)
      .groupBy(applications.source),
  ]);
  const used = new Map(counts.map((c) => [c.key, c.n]));
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    kind: r.kind,
    hidden: r.hidden,
    applications: used.get(r.key) ?? 0,
  }));
}

async function findSource(db: Db, key: string): Promise<ApplicationSourceRow> {
  const row = await db.query.applicationSources.findFirst({ where: eq(applicationSources.key, key) });
  if (!row) throw notFound('Không tìm thấy nguồn.');
  return row;
}

/** 422 on the name field when another source already has this name (case, tones and spaces ignored). */
function checkUniqueName(all: ApplicationSourceRow[], name: string, exceptKey?: string) {
  const twin = all.find((s) => s.key !== exceptKey && sameSourceName(s.name, name));
  if (twin) throw invalid(`Đã có nguồn ${twin.name}.`, { name: `Đã có nguồn ${twin.name}.` });
}

/** The unique index on name_key catches two HRs adding the same name at the same moment. */
const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

export async function createSource(db: Db, raw: unknown, hr: HrMe): Promise<SourceDto> {
  const parsed = sourceCreateSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại tên nguồn.', fieldErrors(parsed.error));
  const { name } = parsed.data;
  const all = await db.select().from(applicationSources);
  if (all.length >= SOURCES_MAX) throw invalid(`Tối đa ${SOURCES_MAX} nguồn. Ẩn hoặc xoá bớt nguồn ít dùng.`);
  checkUniqueName(all, name);
  const key = sourceKeyFor(name, new Set(all.map((s) => s.key)));
  try {
    await db.insert(applicationSources).values({
      key,
      name,
      nameKey: sourceNameKey(name),
      kind: 'custom',
      position: Math.max(0, ...all.map((s) => s.position)) + 1,
      createdBy: hr.name || hr.email,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw invalid(`Đã có nguồn ${name}.`, { name: `Đã có nguồn ${name}.` });
    throw error;
  }
  return { key, name, kind: 'custom', hidden: false, applications: 0 };
}

/** Rename and / or hide. "Website" never changes; "Khác" is never hidden, so there is always somewhere to pick. */
export async function updateSource(db: Db, key: string, raw: unknown): Promise<SourceDto[]> {
  const source = await findSource(db, key);
  if (source.kind === 'system') throw new HttpError(409, 'Nguồn "Website" do hệ thống quản lý.', {}, 'system_source');
  const parsed = sourceUpdateSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại tên nguồn.', fieldErrors(parsed.error));
  const { name, hidden } = parsed.data;
  if (hidden && key === OTHER_SOURCE) throw new HttpError(409, 'Không ẩn được nguồn "Khác".', {}, 'keep_other');
  if (name) checkUniqueName(await db.select().from(applicationSources), name, key);
  try {
    await db
      .update(applicationSources)
      .set({ ...(name ? { name, nameKey: sourceNameKey(name) } : {}), ...(hidden !== undefined ? { hidden } : {}) })
      .where(eq(applicationSources.key, key));
  } catch (error) {
    if (isUniqueViolation(error) && name) throw invalid(`Đã có nguồn ${name}.`, { name: `Đã có nguồn ${name}.` });
    throw error;
  }
  return listSources(db);
}

/** Only a source HR added and no application uses; otherwise hide it, so the statistics stay. */
export async function deleteSource(db: Db, key: string): Promise<SourceDto[]> {
  const source = await findSource(db, key);
  if (source.kind !== 'custom')
    throw new HttpError(409, 'Nguồn có sẵn không xoá được, chỉ ẩn được.', {}, 'builtin_source');
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(applications)
    .where(eq(applications.source, key));
  if (n > 0) throw new HttpError(409, `Đang có ${n} hồ sơ từ nguồn này. Ẩn nguồn thay vì xoá.`, {}, 'source_in_use');
  await db.delete(applicationSources).where(eq(applicationSources.key, key));
  return listSources(db);
}

/**
 * A source HR may put on an application: it exists, is not "Website", and is not hidden — unless the application
 * already has it (editing the contact of an older application keeps its source).
 */
export async function checkUsableSource(db: Db, key: string, current?: string): Promise<void> {
  const source = await db.query.applicationSources.findFirst({ where: eq(applicationSources.key, key) });
  const usable = source && source.kind !== 'system' && (!source.hidden || key === current);
  if (!usable) throw invalid('Nguồn không dùng được, chọn nguồn khác.', { source: 'Chọn nguồn khác.' });
}
