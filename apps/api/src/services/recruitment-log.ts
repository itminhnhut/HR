import { RECRUITMENT_LOG_GROUPS, type RecruitmentLogGroup, type RecruitmentLogPageDto } from '@careers/shared';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { applications, jobs, recruitmentLog } from '../db/schema.js';
import { invalid } from '../lib/http-error.js';

/** "Nhật ký tuyển dụng" (spec-nhat-ky-ho-so.md): one line per thing done in the applicants area. */

export interface RecruitmentEntry {
  /** Null for what belongs to no application (a source). */
  applicationId: string | null;
  group: RecruitmentLogGroup;
  action: string;
  actor: string;
  from?: string | null;
  to?: string | null;
  detail?: string | null;
  at?: Date;
}

type Writer = Pick<Db, 'insert' | 'select'>;

/** The name and job the line keeps, so it still reads after the application is gone. */
async function subjectOf(db: Writer, applicationId: string | null) {
  if (!applicationId) return { candidateName: null, jobTitle: null };
  const [row] = await db
    .select({ candidateName: applications.fullName, jobTitle: jobs.title })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.id, applicationId));
  return row ?? { candidateName: null, jobTitle: null };
}

export async function logRecruitment(db: Writer, entry: RecruitmentEntry): Promise<void> {
  const subject = await subjectOf(db, entry.applicationId);
  await db.insert(recruitmentLog).values({
    applicationId: entry.applicationId,
    ...subject,
    actor: entry.actor,
    action: entry.action,
    group: entry.group,
    detail: entry.detail ?? null,
    fromValue: entry.from ?? null,
    toValue: entry.to ?? null,
    at: entry.at ?? new Date(),
  });
}

/** What on a line can name or reach the person: dropped with the application (spec §8.1). */
const PERSONAL_GROUPS: readonly RecruitmentLogGroup[] = ['ho-so', 'ghi-chu', 'sep-duyet'];

/**
 * Before an application is deleted: its lines stay, without the candidate's name, and without the old and new words
 * where those could be a name, a phone, an email, a note or a comment. The job title stays.
 */
export async function forgetCandidate(db: Pick<Db, 'update'>, applicationIds: readonly string[]): Promise<void> {
  if (applicationIds.length === 0) return;
  const ofThem = inArray(recruitmentLog.applicationId, [...applicationIds]);
  await db.update(recruitmentLog).set({ candidateName: null }).where(ofThem);
  await db
    .update(recruitmentLog)
    .set({ fromValue: null, toValue: null, detail: null })
    .where(and(ofThem, inArray(recruitmentLog.group, [...PERSONAL_GROUPS])));
}

const PAGE_SIZE = 100;

const querySchema = z.object({
  nhom: z.enum(RECRUITMENT_LOG_GROUPS).optional(),
  tim: z.string().trim().max(100).optional(),
  tu: z.coerce.number().int().min(0).default(0),
});

const TONED = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const WITH_TONES = TONED + TONED.toUpperCase();
const toneless = (text: string) =>
  [...text]
    .map((c) => (c === 'đ' || c === 'Đ' ? 'd' : c.normalize('NFD').replace(/[̀-ͯ]/g, '')))
    .join('')
    .toLowerCase();
const WITHOUT_TONES = toneless(WITH_TONES);

/** Every word typed, in any order, without tones or case, in the name, job, who, what or the words of the change. */
function searchWhere(words: string | undefined): SQL | undefined {
  const parts = toneless(words ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  const r = recruitmentLog;
  const all = sql`lower(translate(concat_ws(' ', ${r.candidateName}, ${r.jobTitle}, ${r.actor}, ${r.action}, ${r.detail}, ${r.fromValue}, ${r.toValue}), ${WITH_TONES}, ${WITHOUT_TONES}))`;
  return and(...parts.map((part) => sql`${all} like ${`%${part.replace(/[\\%_]/g, '\\$&')}%`}`));
}

export async function readRecruitmentLog(db: Db, raw: unknown): Promise<RecruitmentLogPageDto> {
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) throw invalid('Không đọc được nhật ký.', {});
  const { nhom, tim, tu } = parsed.data;
  const rows = await db
    .select()
    .from(recruitmentLog)
    .where(and(nhom ? eq(recruitmentLog.group, nhom) : undefined, searchWhere(tim)))
    .orderBy(desc(recruitmentLog.at), desc(recruitmentLog.id))
    .limit(PAGE_SIZE + 1)
    .offset(tu);
  const lines = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id,
    applicationId: r.applicationId,
    candidateName: r.candidateName,
    jobTitle: r.jobTitle,
    isDeleted: r.applicationId === null && r.group !== 'nguon',
    group: r.group,
    action: r.action,
    actor: r.actor,
    from: r.fromValue,
    to: r.toValue,
    detail: r.detail,
    at: r.at.toISOString(),
  }));
  return { lines, hasMore: rows.length > PAGE_SIZE };
}
