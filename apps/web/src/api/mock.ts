import {
  DEFAULT_JOB_TEMPLATE,
  DEPARTMENT_SUGGESTIONS,
  acceptsApplications,
  addDays,
  applicationFieldsSchema,
  CV_MAX_BYTES,
  candidateStage,
  daysBetween,
  endedOn,
  jobTemplateSchema,
  matchesQuery,
  effectiveStatus,
  fieldErrors,
  foldVietnamese,
  formatSalary,
  isListed,
  jobInputSchema,
  placeLabel,
  normalizeVietnamPhone,
  POLICY_VERSION,
  todayInVietnam,
  toLines,
  validateDeadline,
  type ApplicationDetailDto,
  type HrMe,
  type HrUserDto,
  type ApplicationRowDto,
  type CandidateMe,
  type HrJobDto,
  type JobCardDto,
  type JobDetailDto,
} from '@careers/shared';
import { buildSeed, DB_VERSION, DEMO_CANDIDATE_EMAIL, type MockDb, type MockHrUser, type MockJob } from './mock-seed';
import { ApiError, type Api } from './types';

const STORAGE_KEY = 'careers-demo-db';
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
    place: placeLabel(job.address),
    deadline: job.deadline,
    status: statusOf(job),
    publishedAt: job.publishedOn ? `${job.publishedOn}T02:00:00.000Z` : null,
    perks: job.benefits.slice(0, 2).join(', '),
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
  };
}

function toDetail(job: MockJob): JobDetailDto {
  return {
    ...toCard(job),
    address: job.address,
    workingHours: job.workingHours,
    experience: job.experience,
    education: job.education,
    responsibilities: toLines(job.responsibilities),
    requirements: toLines(job.requirements),
    benefits: job.benefits,
    roadmap: job.roadmap,
  };
}

function toHrJob(job: MockJob): HrJobDto {
  const { publishedOn: _p, createdAt: _c, ...rest } = job;
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

const sameEmail = (a: string | null | undefined, b: string) => !!a && a.trim().toLowerCase() === b;

function candidateFor(db: MockDb, email: string): CandidateMe {
  const c = findOrCreateCandidate(db, email);
  // Alerts live with the phone, including sign-ups from closed-job pages (BR-10).
  // Only alerts this account turned on: its phone is not verified (same rule as the BE).
  const alertDepartments = db.subscribers.filter((s) => s.candidateEmail === email).map((s) => s.department);
  return {
    email: c.email,
    phone: c.phone,
    name: c.name,
    cvFileName: c.cvFileName,
    alertDepartments,
  };
}

/** Like the BE: the account is created at first Google sign-in, pre-filled from the latest application. */
function findOrCreateCandidate(db: MockDb, email: string): MockDb['candidates'][number] {
  let c = db.candidates.find((x) => x.email === email);
  if (!c) {
    const lastApp = db.applications
      .filter((a) => sameEmail(a.email, email))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    c = {
      email,
      phone: lastApp?.phone ?? null,
      name: lastApp?.fullName ?? null,
      cvFileName: lastApp?.cvFileName ?? null,
      alertDepartments: [],
    };
    db.candidates.push(c);
  }
  return c;
}

const NEEDS_PHONE = 'Nhập số điện thoại (Zalo) để nhận báo việc mới.';
const DELETE_AFTER_DAYS = 30;

const DEADLINE_MESSAGE = {
  missing: 'Chọn hạn nộp.',
  past: 'Hạn nộp không được ở quá khứ.',
  too_far: 'Hạn nộp tối đa 60 ngày từ hôm nay.',
} as const;

function requireHr(db: MockDb): MockHrUser {
  const me = db.hrUsers.find((u) => u.id === db.session.hr);
  if (!me) throw new ApiError(401, 'Phiên đăng nhập đã hết, đăng nhập lại.');
  return me;
}

const toHrMe = (u: MockHrUser): HrMe => ({ id: u.id, email: u.email, name: u.name });
const toUserDto = (u: MockHrUser, me: MockHrUser): HrUserDto => ({
  id: u.id,
  email: u.email,
  name: u.name,
  lastLoginAt: u.lastLoginAt,
  isMe: u.id === me.id,
});

/** Like the BE's generatePassword: three groups of five letters and digits. */
function tempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const group = () => Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

/** Jobs that ended more than 30 days ago: their applications are due for deletion (same rule as the BE). */
function dueJobIds(db: MockDb, now = new Date()): string[] {
  const cutoff = addDays(todayInVietnam(now), -DELETE_AFTER_DAYS);
  return db.jobs
    .filter((j) => {
      const ended = endedOn(j, now);
      return ended !== null && ended < cutoff;
    })
    .map((j) => j.id);
}

const firstLine = (text: string | null) =>
  text
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim() ?? null;

function appRow(db: MockDb, a: MockDb['applications'][number]): ApplicationRowDto {
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitle: db.jobs.find((j) => j.id === a.jobId)?.title ?? '—',
    fullName: a.fullName,
    phone: a.phone,
    status: a.status,
    createdAt: a.createdAt,
    hasCv: !!(a.cvFileName || a.cvLink),
    noteLine: firstLine(a.note),
    interviewAt: a.interviewAt,
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
    noteUpdatedAt: a.noteUpdatedAt,
    noteUpdatedBy: a.noteUpdatedBy,
    otherApplications: db.applications
      .filter((o) => o.phone === a.phone && o.id !== a.id)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .map((o) => ({
        id: o.id,
        jobTitle: db.jobs.find((j) => j.id === o.jobId)?.title ?? '—',
        status: o.status,
        createdAt: o.createdAt,
      })),
  };
}

export const mockApi: Api = {
  async listJobs() {
    const db = load();
    const jobs = db.jobs
      .filter((j) => isListed(statusOf(j)))
      .sort((a, b) => (b.publishedOn ?? '').localeCompare(a.publishedOn ?? ''))
      .map(toCard);
    return delay({ jobs });
  },

  async getJob(slug) {
    const db = load();
    const job = db.jobs.find((j) => j.slug === slug);
    if (!job || job.state === 'draft') return fail(404, 'Không tìm thấy tin tuyển dụng.');
    const listed = db.jobs.filter((j) => j.id !== job.id && isListed(statusOf(j)));
    // BR-05: up to 3, same department first.
    const similar = [
      ...listed.filter((j) => j.department === job.department),
      ...listed.filter((j) => j.department !== job.department),
    ]
      .slice(0, 3)
      .map(toCard);
    return delay({ job: toDetail(job), similar });
  },

  async apply(input) {
    const db = load();
    const parsed = applicationFieldsSchema.safeParse(input);
    const errors = parsed.success ? {} : fieldErrors(parsed.error);
    const account = db.session.candidateEmail ? db.candidates.find((c) => c.email === db.session.candidateEmail) : null;
    const savedCv = input.useSavedCv && account?.cvFileName ? account.cvFileName : null;
    if (input.useSavedCv && !savedCv) errors.cv = 'Tài khoản chưa có CV đã lưu. Tải file hoặc dán link CV.';
    else if (!savedCv && !input.cvFile && !input.cvLink?.trim()) errors.cv = 'Đính kèm file CV hoặc dán link CV.';
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
    if (!acceptsApplications(statusOf(job, now))) {
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
      email: db.session.candidateEmail ?? d.email,
      message: d.message,
      cvFileName: input.cvFile?.name ?? savedCv,
      cvLink: d.cvLink,
      consentAt: now.toISOString(),
      policyVersion: POLICY_VERSION,
    };
    let previousDate: string | null = null;
    if (existing) {
      previousDate = existing.createdAt;
      // Same as the BE: content replaced, HR's status and note kept, moved to the top of HR's list.
      Object.assign(existing, record, { createdAt: now.toISOString() });
    } else {
      db.applications.push({
        id: uid('a'),
        jobId: job.id,
        status: 'new',
        note: null,
        noteUpdatedAt: null,
        noteUpdatedBy: null,
        interviewAt: null,
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

  async lookupApplications(phone) {
    const db = load();
    const normalized = normalizeVietnamPhone(phone);
    if (!normalized) {
      return fail(422, 'Số điện thoại chưa đúng.', { phone: 'Số điện thoại chưa đúng, ví dụ 0912 345 678.' });
    }
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const applications = db.applications
      .filter((a) => a.phone === normalized && new Date(a.createdAt).getTime() >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((a) => {
        const job = db.jobs.find((j) => j.id === a.jobId);
        if (!job) return [];
        return [
          {
            jobTitle: job.title,
            jobSlug: job.slug,
            appliedOn: todayInVietnam(new Date(a.createdAt)),
            stage: candidateStage(a.status, !acceptsApplications(statusOf(job))),
          },
        ];
      });
    return delay({ applications });
  },

  async googleSignIn() {
    const db = load();
    db.session.candidateEmail = DEMO_CANDIDATE_EMAIL;
    const me = candidateFor(db, DEMO_CANDIDATE_EMAIL);
    save();
    return delay(me);
  },

  async candidateOverview() {
    const db = load();
    const email = db.session.candidateEmail;
    if (!email) return delay(null);
    const me = candidateFor(db, email);
    const applications = db.applications
      .filter((a) => sameEmail(a.email, email))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((a) => {
        const job = db.jobs.find((j) => j.id === a.jobId);
        if (!job) return [];
        return [
          {
            id: a.id,
            jobSlug: job.slug,
            jobTitle: job.title,
            salary: formatSalary(job),
            place: placeLabel(job.address),
            createdAt: a.createdAt,
            stage: candidateStage(a.status, !acceptsApplications(statusOf(job))),
          },
        ];
      });
    return delay({ me, applications });
  },

  async updateCandidate(patch) {
    const db = load();
    const email = db.session.candidateEmail;
    if (!email) return fail(401, 'Đăng nhập lại để tiếp tục.');
    const me = findOrCreateCandidate(db, email);
    let phone = me.phone;
    if (patch.phone !== undefined) {
      phone = patch.phone.trim() ? normalizeVietnamPhone(patch.phone) : null;
      if (patch.phone.trim() && !phone) {
        return fail(422, 'Số điện thoại chưa đúng.', { phone: 'Số điện thoại chưa đúng, ví dụ 0912 345 678.' });
      }
    }
    const own = db.subscribers.filter((s) => s.candidateEmail === email);
    const departments = patch.alertDepartments ?? own.map((s) => s.department);
    if (departments.length > 0 && !phone) return fail(422, NEEDS_PHONE, { alertDepartments: NEEDS_PHONE });
    if (patch.cvFile && patch.cvFile.size > CV_MAX_BYTES) {
      return fail(422, 'File lớn hơn 4 MB.', { cv: 'File lớn hơn 4 MB.' });
    }
    if (patch.name !== undefined) me.name = patch.name.trim() || null;
    if (patch.alertDepartments || phone !== me.phone) {
      const consentedAt = new Map(own.map((s) => [s.department, s.consentAt]));
      db.subscribers = db.subscribers.filter((s) => s.candidateEmail !== email);
      const now = new Date().toISOString();
      for (const dep of phone ? departments : []) {
        db.subscribers.push({
          id: uid('s'),
          phone: phone ?? '',
          department: dep,
          fromJobId: null,
          candidateEmail: email,
          consentAt: consentedAt.get(dep) ?? now,
          policyVersion: POLICY_VERSION,
          createdAt: now,
        });
      }
    }
    me.phone = phone;
    if (patch.cvFile) me.cvFileName = patch.cvFile.name;
    save();
    return delay(candidateFor(db, email));
  },

  async deleteCandidateData() {
    const db = load();
    const email = db.session.candidateEmail;
    if (email) {
      db.applications = db.applications.filter((a) => !sameEmail(a.email, email));
      db.subscribers = db.subscribers.filter((s) => s.candidateEmail !== email);
      db.candidates = db.candidates.filter((c) => c.email !== email);
    }
    db.session.candidateEmail = null;
    save();
    return delay({ ok: true as const });
  },

  async candidateLogout() {
    const db = load();
    db.session.candidateEmail = null;
    save();
    return delay({ ok: true as const });
  },

  async hrMe() {
    const db = load();
    const me = db.hrUsers.find((u) => u.id === db.session.hr);
    return delay(me ? toHrMe(me) : null);
  },

  async hrSignIn(email, password) {
    const db = load();
    const user = db.hrUsers.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.password !== password) return fail(401, 'Email hoặc mật khẩu chưa đúng.');
    db.session.hr = user.id;
    user.lastLoginAt = new Date().toISOString();
    save();
    return delay(toHrMe(user));
  },

  async hrLogout() {
    const db = load();
    db.session.hr = null;
    save();
    return delay({ ok: true as const });
  },

  async hrDashboard() {
    const db = load();
    requireHr(db);
    const now = new Date();
    const today = todayInVietnam(now);
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
    const index = new Map(days.map((d, i) => [d, i]));
    const perDay = days.map((day) => ({ day, count: 0 }));
    const perJob = new Map<string, number[]>();
    for (const a of db.applications) {
      const i = index.get(todayInVietnam(new Date(a.createdAt)));
      if (i === undefined) continue;
      perDay[i].count += 1;
      const counts = perJob.get(a.jobId) ?? Array<number>(30).fill(0);
      counts[i] += 1;
      perJob.set(a.jobId, counts);
    }
    const title = (id: string) => db.jobs.find((j) => j.id === id)?.title ?? '—';
    const fresh = db.applications.filter((a) => a.status === 'new');
    const waitSince = `${addDays(today, -3)}T00:00:00.000+07:00`;
    const due = dueJobIds(db, now);
    return delay({
      newApplications: fresh.length,
      waitingOver3Days: fresh.filter((a) => new Date(a.createdAt) < new Date(waitSince)).length,
      perDay,
      perJobPerDay: [...perJob.entries()].map(([jobId, counts]) => ({ jobId, jobTitle: title(jobId), counts })),
      interviews: db.applications
        .filter((a) => a.status === 'interview')
        .sort((a, b) => (a.interviewAt ?? '9999').localeCompare(b.interviewAt ?? '9999'))
        .slice(0, 8)
        .map((a) => ({
          id: a.id,
          fullName: a.fullName,
          jobTitle: title(a.jobId),
          interviewAt: a.interviewAt,
          noteLine: firstLine(a.note),
        })),
      endingJobs: db.jobs
        .map((j) => ({ j, status: statusOf(j, now) }))
        .filter(({ j, status }) => status === 'expiring' || (status === 'expired' && j.deadline >= addDays(today, -14)))
        .sort((a, b) => a.j.deadline.localeCompare(b.j.deadline))
        .map(({ j, status }) => ({ id: j.id, title: j.title, deadline: j.deadline, status })),
      dueForDeletion: db.applications.filter((a) => due.includes(a.jobId)).length,
    });
  },

  async hrJobs() {
    const db = load();
    requireHr(db);
    const now = new Date();
    const order = { expiring: 0, open: 1, draft: 2, expired: 3, closed: 4 } as const;
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
        };
      })
      .sort((a, b) => order[a.status] - order[b.status]);
    const due = dueJobIds(db, now);
    return delay({
      jobs,
      newApplications: db.applications.filter((a) => a.status === 'new').length,
      dueForDeletion: db.applications.filter((a) => due.includes(a.jobId)).length,
    });
  },

  async hrJobTemplate() {
    const db = load();
    requireHr(db);
    const template = db.template ?? DEFAULT_JOB_TEMPLATE;
    const known = new Set(template.benefits.map((b) => b.label));
    return delay({
      template,
      departments: [...new Set([...DEPARTMENT_SUGGESTIONS, ...db.jobs.map((j) => j.department)])],
      extraBenefits: [...new Set(db.jobs.flatMap((j) => j.benefits))].filter((b) => !known.has(b)).slice(0, 8),
    });
  },

  async hrSaveJobTemplate(input) {
    const db = load();
    requireHr(db);
    const parsed = jobTemplateSchema.safeParse(input);
    if (!parsed.success) return fail(422, 'Chưa lưu được, kiểm tra các ô được đánh dấu.', fieldErrors(parsed.error));
    db.template = parsed.data;
    save();
    return mockApi.hrJobTemplate();
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
    // A published job is validated like a publish, so an edit cannot dodge BR-01.
    const goesLive = input.intent === 'publish' || existing?.state === 'published';
    const problem = goesLive ? validateDeadline(input.deadline) : null;
    if (problem) errors.deadline = DEADLINE_MESSAGE[problem];
    if (!parsed.success || Object.keys(errors).length)
      return fail(422, 'Chưa lưu được, kiểm tra các ô được đánh dấu.', errors);
    const { intent, ...data } = parsed.data;
    const today = todayInVietnam();
    const base: Omit<MockJob, 'id' | 'createdAt'> = {
      ...data,
      // A published link never changes (BR-04/BR-05).
      slug: existing?.publishedOn ? existing.slug : slugify(data.title, db, id),
      deadline: data.deadline || existing?.deadline || addDays(today, 30),
      state: intent === 'publish' ? 'published' : (existing?.state ?? 'draft'),
      publishedOn: intent === 'publish' ? (existing?.publishedOn ?? today) : (existing?.publishedOn ?? null),
      closedOn: existing?.closedOn ?? null,
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
    const today = todayInVietnam();
    if (action === 'publish') {
      if (job.state !== 'draft') return fail(422, 'Tin này đã được đăng.');
      if (validateDeadline(job.deadline)) return fail(422, 'Hạn nộp chưa hợp lệ. Mở tin để sửa hạn nộp rồi đăng.');
      job.state = 'published';
      job.publishedOn ??= today;
    } else {
      if (job.state !== 'published') return fail(422, 'Chỉ đóng được tin đang đăng.');
      job.closedOn = statusOf(job) === 'expired' ? job.deadline : today;
      job.state = 'closed';
    }
    save();
    return delay({ ok: true as const });
  },

  async hrSetDeadline(id, deadline) {
    const db = load();
    requireHr(db);
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return fail(404, 'Không tìm thấy tin.');
    if (job.state === 'draft') return fail(422, 'Bản nháp: mở tin để chọn hạn nộp rồi đăng.');
    const problem = validateDeadline(deadline);
    if (problem) return fail(422, DEADLINE_MESSAGE[problem], { deadline: DEADLINE_MESSAGE[problem] });
    Object.assign(job, { deadline, state: 'published', closedOn: null });
    save();
    return delay({ ok: true as const });
  },

  async hrDeleteJob(id) {
    const db = load();
    requireHr(db);
    const job = db.jobs.find((j) => j.id === id);
    if (!job) return fail(404, 'Không tìm thấy tin.');
    if (job.state !== 'draft') return fail(422, 'Chỉ xóa được bản nháp.');
    db.jobs = db.jobs.filter((j) => j.id !== id);
    save();
    return delay({ ok: true as const });
  },

  hrCvUrl() {
    return null;
  },

  async hrApplications(jobId, q = '') {
    const db = load();
    requireHr(db);
    const digits = q.replace(/\D/g, '');
    const all = db.applications
      .filter((a) => !jobId || a.jobId === jobId)
      .filter((a) => matchesQuery(`${a.fullName} ${a.phone}`, q) || (digits.length >= 3 && a.phone.includes(digits)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => appRow(db, a));
    const counts = { all: all.length, new: 0, seen: 0, interview: 0, rejected: 0 };
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
    const me = requireHr(db);
    const a = db.applications.find((x) => x.id === id);
    if (!a) return fail(404, 'Không tìm thấy hồ sơ.');
    if (patch.interviewAt && (patch.status ?? a.status) !== 'interview') {
      return fail(422, 'Chỉ hồ sơ "Hẹn phỏng vấn" mới có giờ phỏng vấn.', {
        interviewAt: 'Chọn "Hẹn phỏng vấn" trước.',
      });
    }
    if (patch.status) {
      a.status = patch.status;
      if (patch.status !== 'interview') a.interviewAt = null;
    }
    if (patch.interviewAt !== undefined) a.interviewAt = patch.interviewAt;
    const note = patch.note === undefined ? undefined : patch.note?.trim() || null;
    if (note !== undefined && note !== a.note) {
      a.note = note;
      a.noteUpdatedAt = new Date().toISOString();
      a.noteUpdatedBy = me.name || me.email;
    }
    save();
    return delay(appDetail(db, a));
  },

  async hrDeleteApplication(id) {
    const db = load();
    requireHr(db);
    if (!db.applications.some((a) => a.id === id)) return fail(404, 'Không tìm thấy hồ sơ.');
    db.applications = db.applications.filter((a) => a.id !== id);
    save();
    return delay({ ok: true as const });
  },

  async hrDeleteDueApplications() {
    const db = load();
    requireHr(db);
    const due = dueJobIds(db);
    const before = db.applications.length;
    db.applications = db.applications.filter((a) => !due.includes(a.jobId));
    save();
    return delay({ deleted: before - db.applications.length });
  },

  async hrUsers() {
    const db = load();
    const me = requireHr(db);
    return delay(db.hrUsers.map((u) => toUserDto(u, me)));
  },

  async hrCreateUser({ email, name }) {
    const db = load();
    const me = requireHr(db);
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return fail(422, 'Email chưa đúng.', { email: 'Email chưa đúng.' });
    if (db.hrUsers.some((u) => u.email === clean)) {
      return fail(422, 'Email này đã có tài khoản.', { email: 'Email này đã có tài khoản.' });
    }
    const user = { id: uid('u'), email: clean, name: name.trim() || null, password: tempPassword(), lastLoginAt: null };
    db.hrUsers.push(user);
    save();
    return delay({ user: toUserDto(user, me), password: user.password });
  },

  async hrResetPassword(id) {
    const db = load();
    const me = requireHr(db);
    const user = db.hrUsers.find((u) => u.id === id);
    if (!user) return fail(404, 'Không tìm thấy tài khoản.');
    if (user.id === me.id) return fail(422, 'Đổi mật khẩu của bạn ở mục "Đổi mật khẩu".');
    user.password = tempPassword();
    save();
    return delay({ user: toUserDto(user, me), password: user.password });
  },

  async hrDeleteUser(id) {
    const db = load();
    const me = requireHr(db);
    if (id === me.id) return fail(422, 'Không xoá được tài khoản bạn đang dùng.');
    if (db.hrUsers.length <= 1) return fail(422, 'Phải còn ít nhất một tài khoản HR.');
    db.hrUsers = db.hrUsers.filter((u) => u.id !== id);
    save();
    return delay({ ok: true as const });
  },

  async hrChangePassword(current, next) {
    const db = load();
    const me = requireHr(db);
    if (me.password !== current) {
      return fail(422, 'Mật khẩu hiện tại chưa đúng.', { current: 'Mật khẩu hiện tại chưa đúng.' });
    }
    if (next.length < 12)
      return fail(422, 'Mật khẩu cần ít nhất 12 ký tự.', { next: 'Mật khẩu cần ít nhất 12 ký tự.' });
    me.password = next;
    save();
    return delay(toHrMe(me));
  },
};

/** Demo mode only: the per-browser HR password, shown on the HR sign-in page. */
export function demoHrPassword(): string {
  return load().hrUsers[0]?.password ?? '';
}

/** Test helper: start from a fresh seed. */
export function resetMockDb(now?: Date) {
  memory = buildSeed(now);
  save();
}
