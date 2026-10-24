import {
  DEFAULT_JOB_TEMPLATE,
  DEPARTMENT_SUGGESTIONS,
  fieldErrors,
  jobTemplateSchema,
  type JobTemplate,
  type JobTemplateResponse,
} from '@careers/shared';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { jobs, jobTemplates } from '../db/schema.js';
import { invalid } from '../lib/http-error.js';

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
  const [template, departments, benefits] = await Promise.all([
    storedTemplate(db),
    db.selectDistinct({ name: jobs.department }).from(jobs).orderBy(jobs.department),
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
    departments: [...new Set([...DEPARTMENT_SUGGESTIONS, ...departments.map((d) => d.name)])],
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
