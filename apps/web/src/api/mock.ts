import {
  acceptsApplications,
  addDays,
  applicationFieldsSchema,
  CV_MAX_BYTES,
  candidateStage,
  daysBetween,
  effectiveStatus,
  extendTarget,
  fieldErrors,
  foldVietnamese,
  formatDate,
  MAX_OPEN_DAYS,
  formatSalary,
  isListed,
  jobInputSchema,
  locationLabel,
  normalizeVietnamPhone,
  POLICY_VERSION,
  subscribeSchema,
  todayInVietnam,
  toLines,
  validateDeadline,
  type ApplicationDetailDto,
  type ApplicationRowDto,
  type ApplicationStatus,
  type CandidateMe,
  type HrJobDto,
  type JobCardDto,
  type JobDetailDto,
} from '@careers/shared';
import { buildSeed, DB_VERSION, DEMO_HR, DEMO_OTP, type MockDb, type MockJob } from './mock-seed';
import { ApiError, type Api } from './types';

const STORAGE_KEY = 'careers-demo-db';
const GRACE_MS = 60 * 60 * 1000;
const DEDUPE_DAYS = 30; // BR-07

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

let memory: MockDb | null = null;

function load(): MockDb {
  if (memory) return memory;
  const store = safeStorage();
  const wantsReset = typeof location !== 'undefined' && new URLSearchParams(location.search).has('reset');
  if (store && !wantsReset) {
    try {
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null') as MockDb | null;
      if (parsed?.version === DB_VERSION) return (memory = parsed);
    } catch {
      // Corrupt storage: fall through to a fresh seed.
    }
  }
  memory = buildSeed();
  save();
  return memory;
}

function save() {
  try {
    safeStorage()?.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Private mode or full storage: keep working in memory.
  }
}

/** Demo delay. Add ?slow to the URL to see loading skeletons. */
function delay<T>(value: T): Promise<T> {
  let slow = false;
  try {
    slow =
      typeof location !== 'undefined' &&
      (new URLSearchParams(location.search).has('slow') || sessionStorage.getItem('demo-slow') === '1');
    if (slow) sessionStorage.setItem('demo-slow', '1');
  } catch {
    // ignore
  }
  const ms = slow ? 1800 : 220;
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

const fail = (status: number, message: string, errors: Record<string, string> = {}, code?: string) =>
  Promise.reject(new ApiError(status, message, errors, code));

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function statusOf(job: MockJob, now = new Date()) {
  return effectiveStatus(job, now);
}

function toCard(job: MockJob): JobCardDto {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    department: job.department,
    employmentType: job.employmentType,
    remote: job.remote,
    city: job.city,
    deadline: job.deadline,
    status: statusOf(job),
    publishedAt: job.publishedOn ? `${job.publishedOn}T02:00:00.000Z` : null,
    perks: job.perks,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryNote: job.salaryNote,
  };
}

function toDetail(job: MockJob): JobDetailDto {
  return {
    ...toCard(job),
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

function toHrJob(job: MockJob): HrJobDto {
  const { perks: _perks, publishedOn: _p, createdAt: _c, ...rest } = job;
  return { ...rest, status: statusOf(job) };
}

function slugify(title: string, db: MockDb, selfId: string | null): string {
  const base =
    foldVietnamese(title)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'viec-lam';
  let slug = base;
  for (let i = 2; db.jobs.some((j) => j.slug === slug && j.id !== selfId); i++) slug = `${base}-${i}`;
  return slug;
}

function candidateFor(db: MockDb, phone: string): CandidateMe {
  const c = findOrCreateCandidate(db, phone);
  // Subscriptions made on closed-job pages count as alerts too (BR-10).
  c.alertDepartments = [...new Set(db.subscribers.filter((s) => s.phone === phone).map((s) => s.department))];
  return c;
}

function findOrCreateCandidate(db: MockDb, phone: string): MockDb['candidates'][number] {
  let c = db.candidates.find((x) => x.phone === phone);
  if (!c) {
    const lastApp = db.applications
      .filter((a) => a.phone === phone)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    c = {
      phone,
      name: lastApp?.fullName ?? null,
      email: lastApp?.email ?? null,
      cvFileName: lastApp?.cvFileName ?? null,
      keepForOtherJobs: lastApp?.keepForOtherJobs ?? false,
      alertDepartments: [],
    };
    db.candidates.push(c);
  }
  return c;
}

function requireHr(db: MockDb) {
  if (!db.session.hr) throw new ApiError(401, 'Phiên đăng nhập đã hết, đăng nhập lại.');
}

function appRow(db: MockDb, a: MockDb['applications'][number]): ApplicationRowDto {
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitle: db.jobs.find((j) => j.id === a.jobId)?.title ?? '—',
    fullName: a.fullName,
    phone: a.phone,
    status: a.status,
    createdAt: a.createdAt,
  };
}

function appDetail(db: MockDb, a: MockDb['applications'][number]): ApplicationDetailDto {
  return {
    ...appRow(db, a),
    email: a.email,
    message: a.message,
    cvFileName: a.cvFileName,
    cvLink: a.cvLink,
    note: a.note,
    keepForOtherJobs: a.keepForOtherJobs,
    thankedAt: a.thankedAt,
  };
}

export const mockApi: Api = {
  async listJobs() {
    const db = load();
    const jobs = db.jobs
      .filter((j) => isListed(statusOf(j)))
      .sort((a, b) => (b.publishedOn ?? '').localeCompare(a.publishedOn ?? ''))
      .map(toCard);
    const cities = [...new Set(jobs.map((j) => j.city))];
    return delay({ jobs, cities });
  },

  async getJob(slug) {
    const db = load();
    const job = db.jobs.find((j) => j.slug === slug);
    if (!job || job.state === 'draft') return fail(404, 'Không tìm thấy tin tuyển dụng.');
    const listed = db.jobs.filter((j) => j.id !== job.id && isListed(statusOf(j)));
    // BR-05: up to 3, same department first, then same city.
    const similar = [
      ...listed.filter((j) => j.department === job.department),
      ...listed.filter((j) => j.department !== job.department && j.city === job.city),
    ]
      .slice(0, 3)
      .map(toCard);
    return delay({ job: toDetail(job), similar });
  },

  async apply(input) {
    const db = load();
    const parsed = applicationFieldsSchema.safeParse(input);
    const errors = parsed.success ? {} : fieldErrors(parsed.error);
    if (!input.cvFile && !input.cvLink?.trim()) errors.cv = 'Đính kèm file CV hoặc dán link CV.';
    if (input.cvFile) {
      if (!/\.pdf$/i.test(input.cvFile.name) && input.cvFile.type !== 'application/pdf')
        errors.cv = 'CV cần là file PDF.';
      else if (input.cvFile.size > CV_MAX_BYTES) errors.cv = 'File lớn hơn 4 MB. Nén lại hoặc dán link CV.';
    }
    if (!parsed.success || Object.keys(errors).length) return fail(422, 'Kiểm tra lại các ô được đánh dấu.', errors);
    if (parsed.data.website)
      return delay({ ok: true as const, firstName: '', phone: '', updatedExisting: false, previousDate: null });

    const job = db.jobs.find((j) => j.id === parsed.data.jobId);
    if (!job) return fail(404, 'Không tìm thấy tin tuyển dụng.');
    const now = new Date();
    const status = statusOf(job, now);
    const deadlineEnd = new Date(`${job.deadline}T23:59:59.999+07:00`).getTime();
    const inGrace =
      status === 'expired' && parsed.data.formOpenedAt <= deadlineEnd && now.getTime() <= deadlineEnd + GRACE_MS;
    if (!acceptsApplications(status) && !inGrace) {
      return fail(
        409,
        'Vị trí này vừa ngừng nhận hồ sơ. Thông tin bạn nhập vẫn còn, xem vị trí tương tự bên dưới.',
        {},
        'job_closed',
      );
    }

    const d = parsed.data;
    const existing = db.applications.find(
      (a) =>
        a.jobId === job.id &&
        a.phone === d.phone &&
        daysBetween(todayInVietnam(new Date(a.createdAt)), todayInVietnam(now)) <= DEDUPE_DAYS,
    );
    const record = {
      fullName: d.fullName,
      phone: d.phone,
      email: d.email,
      message: d.message,
      cvFileName: input.cvFile?.name ?? null,
      cvLink: d.cvLink,
      keepForOtherJobs: d.keepForOtherJobs,
      consentAt: now.toISOString(),
      policyVersion: POLICY_VERSION,
    };
    let previousDate: string | null = null;
    if (existing) {
      previousDate = existing.createdAt;
      Object.assign(existing, record, { status: 'new' as ApplicationStatus, createdAt: now.toISOString() });
    } else {
      db.applications.push({
        id: uid('a'),
        jobId: job.id,
        status: 'new',
        note: null,
        thankedAt: null,
        createdAt: now.toISOString(),
        ...record,
      });
    }
    save();
    return delay({
      ok: true as const,
      firstName: d.fullName.split(/\s+/).pop() ?? d.fullName,
      phone: d.phone,
      updatedExisting: !!existing,
      previousDate,
    });
  },

  async subscribe(input) {
    const db = load();
    const parsed = subscribeSchema.safeParse(input);
    if (!parsed.success) return fail(422, 'Kiểm tra lại thông tin.', fieldErrors(parsed.error));
    const { phone, department, fromJobId } = parsed.data;
    if (!db.subscribers.some((s) => s.phone === phone && s.department === department)) {
      const now = new Date().toISOString();
      db.subscribers.push({
        id: uid('s'),
        phone,
        department,
        fromJobId: fromJobId ?? null,
        consentAt: now,
        policyVersion: POLICY_VERSION,
        createdAt: now,
      });
      save();
    }
    return delay({ ok: true as const });
  },

  async requestOtp(phone) {
    if (!normalizeVietnamPhone(phone))
      return fail(422, 'Số điện thoại chưa đúng.', { phone: 'Số điện thoại chưa đúng, ví dụ 0912 345 678.' });
    return delay({ ok: true as const, devCode: DEMO_OTP });
  },

  async verifyOtp(phone, code) {
    const db = load();
    const normalized = normalizeVietnamPhone(phone);
    if (!normalized) return fail(422, 'Số điện thoại chưa đúng.');
    if (code.trim() !== DEMO_OTP)
      return fail(422, 'Mã chưa đúng hoặc đã hết hạn.', { code: 'Mã chưa đúng hoặc đã hết hạn.' });
    const me = candidateFor(db, normalized);
    db.session.candidatePhone = normalized;
    save();
    return delay(me);
  },

  async googleSignIn() {
    return delay({ email: 'minhanh@gmail.com', needsPhone: true });
  },

  async candidateOverview() {
    const db = load();
    const phone = db.session.candidatePhone;
    if (!phone) return delay(null);
    const me = candidateFor(db, phone);
    const applications = db.applications
      .filter((a) => a.phone === phone)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => {
        const job = db.jobs.find((j) => j.id === a.jobId)!;
        const closed = !acceptsApplications(statusOf(job)) && statusOf(job) !== 'paused';
        return {
          id: a.id,
          jobSlug: job.slug,
          jobTitle: job.title,
          salary: formatSalary(job),
          place: locationLabel(job),
          createdAt: a.createdAt,
          stage: candidateStage(a.status, closed),
        };
      });
    const saved = db.saved
      .map((slug) => db.jobs.find((j) => j.slug === slug))
      .filter((j): j is MockJob => !!j && isListed(statusOf(j)))
      .map(toCard);
    return delay({ me, applications, saved });
  },

  async updateCandidate(patch) {
    const db = load();
    if (!db.session.candidatePhone) return fail(401, 'Đăng nhập lại để tiếp tục.');
    const me = candidateFor(db, db.session.candidatePhone);
    if (patch.name !== undefined) me.name = patch.name.trim() || null;
    if (patch.keepForOtherJobs !== undefined) {
      me.keepForOtherJobs = patch.keepForOtherJobs;
      // Withdrawing consent applies to every application right away (BR-14).
      for (const a of db.applications) if (a.phone === me.phone) a.keepForOtherJobs = patch.keepForOtherJobs;
    }
    if (patch.alertDepartments) {
      me.alertDepartments = patch.alertDepartments;
      db.subscribers = db.subscribers.filter(
        (s) => s.phone !== me.phone || patch.alertDepartments!.includes(s.department),
      );
      const now = new Date().toISOString();
      for (const dep of patch.alertDepartments) {
        if (!db.subscribers.some((s) => s.phone === me.phone && s.department === dep)) {
          db.subscribers.push({
            id: uid('s'),
            phone: me.phone,
            department: dep,
            fromJobId: null,
            consentAt: now,
            policyVersion: POLICY_VERSION,
            createdAt: now,
          });
        }
      }
    }
    if (patch.cvFile) {
      if (patch.cvFile.size > CV_MAX_BYTES) return fail(422, 'File lớn hơn 4 MB.', { cv: 'File lớn hơn 4 MB.' });
      me.cvFileName = patch.cvFile.name;
    }
    save();
    return delay(me);
  },

  async setSavedJob(slug, saved) {
    const db = load();
    db.saved = saved ? [...new Set([...db.saved, slug])] : db.saved.filter((s) => s !== slug);
    save();
    return delay(db.saved);
  },

  async savedJobSlugs() {
    return delay(load().saved);
  },

  async deleteCandidateData() {
    const db = load();
    const phone = db.session.candidatePhone;
    if (phone) {
      db.applications = db.applications.filter((a) => a.phone !== phone);
      db.subscribers = db.subscribers.filter((s) => s.phone !== phone);
      db.candidates = db.candidates.filter((c) => c.phone !== phone);
    }
    db.saved = [];
    db.session.candidatePhone = null;
    save();
    return delay({ ok: true as const });
  },

  async candidateLogout() {
    const db = load();
    db.session.candidatePhone = null;
    save();
    return delay({ ok: true as const });
  },

  async hrMe() {
    const db = load();
    return delay(db.session.hr ? { email: db.session.hr, name: DEMO_HR.name } : null);
  },

  async hrGoogleSignIn() {
    const db = load();
    db.session.hr = DEMO_HR.email;
    save();
    return delay({ email: DEMO_HR.email, name: DEMO_HR.name });
  },

  async hrLogout() {
    const db = load();
    db.session.hr = null;
    save();
    return delay({ ok: true as const });
  },

  async hrJobs() {
    const db = load();
    requireHr(db);
    const now = new Date();
    const order = { expiring: 0, open: 1, paused: 2, draft: 3, expired: 4, filled: 5 } as const;
    const jobs = db.jobs
      .map((j) => {
        const status = statusOf(j, now);
        const apps = db.applications.filter((a) => a.jobId === j.id);
        return {
          id: j.id,
          slug: j.slug,
          title: j.title,
          department: j.department,
          deadline: j.deadline,
          status,
          totalApplications: apps.length,
          newApplications: apps.filter((a) => a.status === 'new').length,
          salaryMin: j.salaryMin,
          salaryMax: j.salaryMax,
          salaryNote: j.salaryNote,
          extendTo: status === 'expiring' || status === 'expired' ? extendTarget(j.deadline, j.publishedOn, now) : null,
        };
      })
      .sort((a, b) => order[a.status] - order[b.status]);
    return delay({ jobs, newApplications: db.applications.filter((a) => a.status === 'new').length });
  },

  async hrJob(id) {
    const db = load();
    requireHr(db);
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return fail(404, 'Không tìm thấy tin.');
    return delay(toHrJob(job));
  },

  async hrSaveJob(id, input) {
    const db = load();
    requireHr(db);
    const parsed = jobInputSchema.safeParse(input);
    const errors = parsed.success ? {} : fieldErrors(parsed.error);
    const existing = id ? db.jobs.find((j) => j.id === id) : null;
    if (id && !existing) return fail(404, 'Không tìm thấy tin.');
    // Live and paused jobs are validated like a publish, so an edit cannot dodge BR-01/BR-18.
    const goesLive = input.intent === 'publish' || (existing != null && existing.state !== 'draft');
    if (goesLive) {
      const problem = validateDeadline(input.deadline);
      if (problem) {
        errors.deadline = {
          missing: 'Chọn hạn nộp.',
          past: 'Hạn nộp không được ở quá khứ.',
          too_far: 'Hạn nộp tối đa 60 ngày từ hôm nay.',
        }[problem];
      } else if (existing?.publishedOn && daysBetween(existing.publishedOn, input.deadline) > MAX_OPEN_DAYS) {
        errors.deadline = `Tin đăng ngày ${formatDate(existing.publishedOn)} chỉ nhận hồ sơ tối đa 60 ngày. Muốn tuyển tiếp hãy "Đăng lại".`;
      }
    }
    if (!parsed.success || Object.keys(errors).length)
      return fail(422, 'Chưa lưu được, kiểm tra các ô được đánh dấu.', errors);
    const { intent, ...data } = parsed.data;
    const today = todayInVietnam();
    const firstBenefit = toLines(data.benefitIncome)[0] ?? toLines(data.benefitEnvironment)[0] ?? '';
    const base: Omit<MockJob, 'id' | 'createdAt'> = {
      ...data,
      // A published link never changes (BR-04/BR-05).
      slug: existing?.publishedOn ? existing.slug : slugify(data.title, db, id),
      perks: firstBenefit,
      deadline: data.deadline || existing?.deadline || addDays(today, 30),
      state: intent === 'publish' ? 'published' : (existing?.state ?? 'draft'),
      publishedOn: intent === 'publish' ? (existing?.publishedOn ?? today) : (existing?.publishedOn ?? null),
    };
    let saved: MockJob;
    if (existing) saved = Object.assign(existing, base);
    else db.jobs.unshift((saved = { ...base, id: uid('j'), createdAt: new Date().toISOString() }));
    save();
    return delay(toHrJob(saved));
  },

  async hrJobAction(id, action) {
    const db = load();
    requireHr(db);
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return fail(404, 'Không tìm thấy tin.');
    const status = statusOf(job);
    const today = todayInVietnam();
    switch (action) {
      case 'publish': {
        if (validateDeadline(job.deadline)) return fail(422, 'Hạn nộp chưa hợp lệ. Mở tin để sửa hạn nộp rồi đăng.');
        job.state = 'published';
        job.publishedOn ??= today;
        break;
      }
      case 'extend': {
        const target = extendTarget(job.deadline, job.publishedOn);
        if (!target) return fail(422, 'Tin đã mở đủ 60 ngày. Dùng "Đăng lại" để tuyển đợt mới.');
        job.deadline = target;
        job.state = 'published';
        break;
      }
      case 'pause':
        if (!acceptsApplications(status)) return fail(422, 'Chỉ tạm dừng được tin đang tuyển.');
        job.state = 'paused';
        break;
      case 'resume':
        if (status !== 'paused') return fail(422, 'Tin này không ở trạng thái tạm dừng.');
        job.state = 'published';
        break;
      case 'fill':
        job.state = 'filled';
        break;
    }
    save();
    return delay({ ok: true as const });
  },

  async hrApplications(jobId) {
    const db = load();
    requireHr(db);
    const all = db.applications
      .filter((a) => !jobId || a.jobId === jobId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => appRow(db, a));
    const counts = { all: all.length, new: 0, seen: 0, interview: 0, passed: 0, rejected: 0 };
    for (const a of all) counts[a.status]++;
    const jobIds = [...new Set(db.applications.map((a) => a.jobId))];
    const jobs = db.jobs.filter((j) => jobIds.includes(j.id)).map((j) => ({ id: j.id, title: j.title }));
    return delay({ applications: all, counts, jobs });
  },

  async hrApplication(id) {
    const db = load();
    requireHr(db);
    const a = db.applications.find((x) => x.id === id);
    if (!a) return fail(404, 'Không tìm thấy hồ sơ.');
    if (a.status === 'new') {
      a.status = 'seen';
      save();
    }
    return delay(appDetail(db, a));
  },

  async hrUpdateApplication(id, patch) {
    const db = load();
    requireHr(db);
    const a = db.applications.find((x) => x.id === id);
    if (!a) return fail(404, 'Không tìm thấy hồ sơ.');
    if (patch.status) a.status = patch.status;
    if (patch.note !== undefined) a.note = patch.note;
    if (patch.thanked) a.thankedAt = new Date().toISOString();
    save();
    return delay(appDetail(db, a));
  },

  async hrSubscribers() {
    const db = load();
    requireHr(db);
    return delay(
      db.subscribers
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => ({
          id: s.id,
          phone: s.phone,
          department: s.department,
          fromJobTitle: db.jobs.find((j) => j.id === s.fromJobId)?.title ?? null,
          createdAt: s.createdAt,
        })),
    );
  },

  async hrDeleteSubscriber(id) {
    const db = load();
    requireHr(db);
    db.subscribers = db.subscribers.filter((s) => s.id !== id);
    save();
    return delay({ ok: true as const });
  },
};

/** Test helper: start from a fresh seed. */
export function resetMockDb(now?: Date) {
  memory = buildSeed(now);
  save();
}
