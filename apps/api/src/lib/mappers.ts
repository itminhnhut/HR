import {
  effectiveStatus,
  perksSummary,
  toLines,
  type HrJobDto,
  type JobCardDto,
  type JobDetailDto,
} from '@careers/shared';
import type { Job } from '../db/schema.js';

export function toJobCard(job: Job, now: Date = new Date()): JobCardDto {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    department: job.department,
    employmentType: job.employmentType,
    remote: job.remote,
    city: job.city,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryNote: job.salaryNote,
    deadline: job.deadline,
    status: effectiveStatus(job, now),
    publishedAt: job.publishedAt?.toISOString() ?? null,
    perks: perksSummary(job.benefits),
  };
}

export function toJobDetail(job: Job, now: Date = new Date()): JobDetailDto {
  return {
    ...toJobCard(job, now),
    address: job.address,
    workingHours: job.workingHours,
    experience: job.experience,
    headcount: job.headcount,
    responsibilities: toLines(job.responsibilities),
    requirements: toLines(job.requirements),
    benefits: toLines(job.benefits),
    plan: { day30: job.plan30, day60: job.plan60, day90: job.plan90 },
  };
}

export function toHrJob(job: Job, now: Date = new Date()): HrJobDto {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    department: job.department,
    employmentType: job.employmentType,
    remote: job.remote,
    city: job.city,
    address: job.address,
    workingHours: job.workingHours,
    experience: job.experience,
    headcount: job.headcount,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryNote: job.salaryNote,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    plan30: job.plan30,
    plan60: job.plan60,
    plan90: job.plan90,
    deadline: job.deadline,
    state: job.state,
    status: effectiveStatus(job, now),
  };
}
