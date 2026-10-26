import {
  effectiveStatus,
  placeLabel,
  toLines,
  type HrJobDto,
  type JobCardDto,
  type JobDetailDto,
} from '@careers/shared';
import type { Job } from '../db/schema.js';

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
    place: placeLabel(job.address),
    deadline: job.deadline,
    status: effectiveStatus(job, now),
    publishedAt: publishedAtIso(job.publishedOn),
    perks: job.benefits.slice(0, 2).join(', '),
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
  };
}

export function toDetail(job: Job, now: Date): JobDetailDto {
  return {
    ...toCard(job, now),
    address: job.address,
    workingHours: job.workingHours,
    experience: job.experience,
    education: job.education,
    responsibilities: toLines(job.responsibilities),
    requirements: toLines(job.requirements),
    preferred: toLines(job.preferred),
    benefits: job.benefits,
    roadmap: job.roadmap,
  };
}

export function toHrJob(job: Job, now: Date): HrJobDto {
  const { publishedOn: _p, createdAt: _c, updatedAt: _u, ...rest } = job;
  return { ...rest, status: effectiveStatus(job, now) };
}
