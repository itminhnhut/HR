import { effectiveStatus, toLines, type HrJobDto, type JobCardDto, type JobDetailDto } from '@careers/shared';
import type { Job } from '../db/schema.js';

/** Card line under the title: first income perk, else first environment perk. */
export function perksLine(job: Pick<Job, 'benefitIncome' | 'benefitEnvironment'>): string {
  return toLines(job.benefitIncome)[0] ?? toLines(job.benefitEnvironment)[0] ?? '';
}

/** Only the publish date is stored; 09:00 Vietnam time stands in for the hour. */
export function publishedAtIso(publishedOn: string | null): string | null {
  return publishedOn ? `${publishedOn}T02:00:00.000Z` : null;
}

export function toCard(job: Job, now: Date): JobCardDto {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    department: job.department,
    employmentType: job.employmentType,
    remote: job.remote,
    city: job.city,
    deadline: job.deadline,
    status: effectiveStatus(job, now),
    publishedAt: publishedAtIso(job.publishedOn),
    perks: perksLine(job),
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryNote: job.salaryNote,
  };
}

export function toDetail(job: Job, now: Date): JobDetailDto {
  return {
    ...toCard(job, now),
    address: job.address,
    workingHours: job.workingHours,
    level: job.level,
    experience: job.experience,
    education: job.education,
    language: job.language,
    headcount: job.headcount,
    skills: job.skills,
    summary: job.summary,
    teamNote: job.teamNote,
    responsibilities: toLines(job.responsibilities),
    requirements: toLines(job.requirements),
    niceToHave: toLines(job.niceToHave),
    benefits: {
      income: toLines(job.benefitIncome),
      insurance: toLines(job.benefitInsurance),
      timeOff: toLines(job.benefitTimeOff),
      growth: toLines(job.benefitGrowth),
      environment: toLines(job.benefitEnvironment),
    },
    plan: { day30: job.plan30, day60: job.plan60, day90: job.plan90 },
  };
}

export function toHrJob(job: Job, now: Date): HrJobDto {
  const { publishedOn: _p, createdAt: _c, updatedAt: _u, ...rest } = job;
  return { ...rest, status: effectiveStatus(job, now) };
}
