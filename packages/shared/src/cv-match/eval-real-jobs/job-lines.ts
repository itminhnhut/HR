/// <reference types="node" />
/**
 * Requirement lines of a real ad, in the shape production scores them. The public API only gives the grouped
 * sections, so the HR text is rebuilt from them and passed through `toItems`, as `requirementLines` in
 * apps/api/src/services/cv-score.ts does. `preferred` and `responsibilities` are not scored by production.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { toItems } from '../../format.js';
import { NO_REQUIREMENT } from '../../job-template.js';

const sectionSchema = z.object({ title: z.string().nullable(), items: z.array(z.string()) });

const jobFileSchema = z.object({
  job: z.object({
    slug: z.string(),
    title: z.string(),
    experience: z.string().nullable(),
    education: z.string().nullable(),
    sections: z.object({ requirements: z.array(sectionSchema) }),
  }),
});

export type RealJob = z.infer<typeof jobFileSchema>['job'];

const FIXTURES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');

export function loadJob(slug: string): RealJob {
  const raw: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, `${slug}.json`), 'utf8'));
  return jobFileSchema.parse(raw).job;
}

function requirementsText(job: RealJob): string {
  return job.sections.requirements
    .flatMap((section) => [...(section.title ? [section.title] : []), ...section.items.map((item) => `- ${item}`)])
    .join('\n');
}

const asks = (value: string | null): boolean => !!value?.trim() && value.trim() !== NO_REQUIREMENT;

/** Same lines, same order as `requirementLines` in apps/api/src/services/cv-score.ts. */
export function scoredLines(job: RealJob): string[] {
  return [
    ...(asks(job.experience) ? [`Kinh nghiệm: ${job.experience}`] : []),
    ...(asks(job.education) ? [`Học vấn: ${job.education}`] : []),
    ...toItems(requirementsText(job)),
  ];
}
