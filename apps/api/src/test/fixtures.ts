import { addDays, todayInVietnam, type JobInput } from '@careers/shared';
import { jobs, type Job, type NewJob } from '../db/schema.js';
import { findHrUser, upsertHrUser } from '../services/hr-accounts.js';
import { HR_EMAIL, type TestContext } from './harness.js';

let counter = 0;

/** An open job published today with a deadline 30 days out, unless overridden. */
export async function insertJob(t: TestContext, overrides: Partial<NewJob> = {}): Promise<Job> {
  counter += 1;
  const today = todayInVietnam(t.clock.now);
  const [job] = await t.db
    .insert(jobs)
    .values({
      slug: `viec-${counter}`,
      title: `Việc ${counter}`,
      department: 'Kỹ thuật',
      employmentType: 'full_time',
      city: 'Hà Nội',
      deadline: addDays(today, 30),
      state: 'published',
      publishedOn: today,
      responsibilities: 'Làm việc A\nLàm việc B',
      benefitIncome: 'Lương tháng 13',
      ...overrides,
    })
    .returning();
  return job;
}

export async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** "name=value" pairs from Set-Cookie headers, ready for a Cookie header. */
export function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

export const HR_PASSWORD = 'Kiem-Tra-Fixture-2026';

/** Creates the HR account if needed and signs in; returns the Cookie header value. */
export async function loginHr(t: TestContext, email = HR_EMAIL, password = HR_PASSWORD): Promise<string> {
  if (!(await findHrUser(t.db, email))) await upsertHrUser(t.db, { email, name: 'Phòng Nhân sự', password });
  const res = await t.send('POST', '/api/hr/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`HR login failed: ${res.status}`);
  return cookiesFrom(res);
}

/** A complete HR form submission (JobInput) that passes validation. */
export function jobInput(overrides: Partial<JobInput> = {}): JobInput {
  return {
    title: 'Kỹ sư phần mềm',
    department: 'Kỹ thuật',
    employmentType: 'full_time',
    remote: false,
    city: 'Hà Nội',
    address: null,
    workingHours: null,
    level: null,
    experience: null,
    education: null,
    language: null,
    headcount: 1,
    salaryMin: 20,
    salaryMax: 30,
    salaryNote: null,
    skills: ['TypeScript'],
    summary: null,
    teamNote: null,
    responsibilities: 'Viết API',
    requirements: '',
    niceToHave: '',
    benefitIncome: 'Lương tháng 13',
    benefitInsurance: '',
    benefitTimeOff: '',
    benefitGrowth: '',
    benefitEnvironment: '',
    plan30: null,
    plan60: null,
    plan90: null,
    deadline: '2026-11-19',
    intent: 'publish',
    ...overrides,
  };
}
