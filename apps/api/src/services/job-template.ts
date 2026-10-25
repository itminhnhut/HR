import {
  DEFAULT_JOB_TEMPLATE,
  addChoiceSchema,
  CHOICES_MAX,
  fieldErrors,
  jobTemplateSchema,
  type JobTemplate,
  type JobTemplateResponse,
} from '@careers/shared';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { jobs, jobTemplates } from '../db/schema.js';
import { invalid } from '../lib/http-error.js';

/** The template's list first, then values typed on earlier jobs. */
const merge = (list: string[], used: (string | null)[]) => [
  ...new Set([...list, ...used.filter((v): v is string => !!v?.trim()).sort((a, b) => a.localeCompare(b, 'vi'))]),
];

/** Only the most used ones, so the checklist stays short. */
const EXTRA_BENEFITS_MAX = 8;
const TEMPLATE_ID = 1;

async function storedTemplate(db: Db): Promise<JobTemplate> {
  const row = await db.query.jobTemplates.findFirst({ where: eq(jobTemplates.id, TEMPLATE_ID) });
  const parsed = jobTemplateSchema.safeParse(row?.data);
  return parsed.success ? parsed.data : DEFAULT_JOB_TEMPLATE;
}

/** Defaults for a new job, plus departments and hand-typed benefits from earlier jobs as suggestions. */
export async function jobTemplate(db: Db): Promise<JobTemplateResponse> {
  const [template, used, benefits] = await Promise.all([
    storedTemplate(db),
    db
      .selectDistinct({ department: jobs.department, experience: jobs.experience, education: jobs.education })
      .from(jobs),
    db
      .select({
        benefit: sql<string>`unnest(${jobs.benefits})`.as('benefit'),
        uses: sql<number>`count(*)`.mapWith(Number),
      })
      .from(jobs)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`, sql`1`),
  ]);
  const known = new Set(template.benefits.map((b) => b.label));
  return {
    template,
    departments: merge(
      template.departments,
      used.map((u) => u.department),
    ),
    experiences: merge(
      template.experiences,
      used.map((u) => u.experience),
    ),
    educations: merge(
      template.educations,
      used.map((u) => u.education),
    ),
    extraBenefits: benefits
      .map((r) => r.benefit)
      .filter((b) => !known.has(b))
      .slice(0, EXTRA_BENEFITS_MAX),
  };
}

/** "Mẫu tin": applies to jobs created from now on; existing jobs keep their own copy. */
export async function saveJobTemplate(db: Db, raw: unknown): Promise<JobTemplateResponse> {
  const parsed = jobTemplateSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chưa lưu được, kiểm tra các ô được đánh dấu.', fieldErrors(parsed.error));
  await db
    .insert(jobTemplates)
    .values({ id: TEMPLATE_ID, data: parsed.data })
    .onConflictDoUpdate({ target: jobTemplates.id, set: { data: parsed.data } });
  return jobTemplate(db);
}

/**
 * Appends one choice to a list of the template, reading the latest template inside a transaction, so two HR
 * adding at the same time, or an HR editing "Mẫu tin" meanwhile, never overwrite each other.
 */
export async function addTemplateChoice(db: Db, raw: unknown): Promise<JobTemplateResponse> {
  const parsed = addChoiceSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chưa thêm được.', fieldErrors(parsed.error));
  const { list, value } = parsed.data;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('job_template'))`);
    const current = await storedTemplate(tx);
    if (current[list].includes(value)) return;
    if (current[list].length >= CHOICES_MAX)
      throw invalid(`Danh sách đã đủ ${CHOICES_MAX} mục.`, { value: 'Danh sách đã đầy.' });
    const data = { ...current, [list]: [...current[list], value] };
    await tx
      .insert(jobTemplates)
      .values({ id: TEMPLATE_ID, data })
      .onConflictDoUpdate({ target: jobTemplates.id, set: { data } });
  });
  return jobTemplate(db);
}
