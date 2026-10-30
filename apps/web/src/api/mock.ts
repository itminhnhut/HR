import {
  contactLogSchema,
  hrProfileSchema,
  addChoiceSchema,
  DEFAULT_MESSAGE_TEMPLATES,
  TEMPLATE_KEYS,
  messageTemplateSchema,
  DEFAULT_JOB_TEMPLATE,
  acceptsApplications,
  addDays,
  applicationFieldsSchema,
  CV_MAX_BYTES,
  candidateStage,
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
import { DEMO_CANDIDATE_EMAIL, DEMO_HR, randomPassword, type MockDb, type MockHrUser, type MockJob } from './mock-seed';
import { delay, fail, load, requireHr, save, uid } from './mock-store';
import { newsMockApi } from './mock-news';
import type { Api } from './types';

const REPEAT_MS = 10 * 60_000; // same as the BE: an exact repeat this soon is a double click

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
    preferred: toLines(job.preferred),
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

const toHrMe = (u: MockHrUser): HrMe => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  contactEmail: u.contactEmail,
});
const toUserDto = (u: MockHrUser, me: MockHrUser): HrUserDto => ({
  id: u.id,
  email: u.email,
  name: u.name,
  lastLoginAt: u.lastLoginAt,
  isMe: u.id === me.id,
  phone: u.phone,
  contactEmail: u.contactEmail,
});

/** Like the BE's generatePassword: three groups of five letters and digits. */
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
    matchPercent: null,
    noteLine: firstLine(a.note),
    interviewAt: a.interviewAt,
    review: null,
  };
}

function appDetail(db: MockDb, a: MockDb['applications'][number]): ApplicationDetailDto {
  return {
    ...appRow(db, a),
    reviewInfo: null,
    email: a.email,
    message: a.message,
    cvFileName: a.cvFileName,
    cvLink: a.cvLink,
    note: a.note,
    interviewMode: a.interviewMode,
    meetingUrl: a.meetingUrl,
    cvScore: null,
    contacts: [...a.contacts].sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
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
    if (parsed.data.website) return delay({ ok: true as const, firstName: '', phone: '' });

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
    // Same as the BE: a re-send is a new application (never overwrites), except an exact repeat (double click).
    const repeat = db.applications.some(
      (a) =>
        a.jobId === job.id &&
        a.phone === d.phone &&
        a.fullName === d.fullName &&
        (a.email ?? null) === ((db.session.candidateEmail ?? d.email) || null) &&
        now.getTime() - new Date(a.createdAt).getTime() < REPEAT_MS,
    );
    if (!repeat) {
      db.applications.push({
        id: uid('a'),
        jobId: job.id,
        status: 'new',
        note: null,
        noteUpdatedAt: null,
        noteUpdatedBy: null,
        interviewAt: null,
        interviewMode: null,
        meetingUrl: null,
        contacts: [],
        createdAt: now.toISOString(),
        fullName: d.fullName,
        phone: d.phone,
        email: db.session.candidateEmail ?? d.email,
        message: d.message,
        cvFileName: input.cvFile?.name ?? savedCv,
        cvLink: d.cvLink,
        consentAt: now.toISOString(),
        policyVersion: POLICY_VERSION,
      });
      save();
    }
    return delay({
      ok: true as const,
      firstName: d.fullName.split(/\s+/).pop() ?? d.fullName,
      phone: d.phone,
    });
  },

  async lookupApplications(phone, _captchaToken) {
    const db = load();
    const normalized = normalizeVietnamPhone(phone);
    if (!normalized) {
      return fail(422, 'Số điện thoại chưa đúng.', {
        phone: 'Số điện thoại chưa đúng, cần 10 số, ví dụ 0912 345 678.',
      });
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
        return fail(422, 'Số điện thoại chưa đúng.', {
          phone: 'Số điện thoại chưa đúng, cần 10 số, ví dụ 0912 345 678.',
        });
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
      departments: [...new Set([...template.departments, ...db.jobs.map((j) => j.department)])],
      experiences: [
        ...new Set([...template.experiences, ...db.jobs.flatMap((j) => (j.experience ? [j.experience] : []))]),
      ],
      educations: [...new Set([...template.educations, ...db.jobs.flatMap((j) => (j.education ? [j.education] : []))])],
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

  async hrAddTemplateChoice(list, value) {
    const db = load();
    requireHr(db);
    const parsed = addChoiceSchema.safeParse({ list, value });
    if (!parsed.success) return fail(422, 'Chưa thêm được.', fieldErrors(parsed.error));
    const current = db.template ?? DEFAULT_JOB_TEMPLATE;
    if (!current[list].includes(parsed.data.value)) {
      db.template = { ...current, [list]: [...current[list], parsed.data.value] };
      save();
    }
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
    const digits = q.replace(/\D/g, '').replace(/^84(?=\d{9}$)/, '0');
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
      if (patch.status !== 'interview') Object.assign(a, { interviewAt: null, interviewMode: null, meetingUrl: null });
    }
    if (patch.interviewAt !== undefined) a.interviewAt = patch.interviewAt;
    if (patch.interviewMode !== undefined) a.interviewMode = patch.interviewMode;
    if (patch.meetingUrl !== undefined) {
      const url = patch.meetingUrl?.trim() || null;
      if (url && !/^https?:\/\//i.test(url)) {
        return fail(422, 'Link phải bắt đầu bằng http:// hoặc https://', { meetingUrl: 'Link chưa đúng.' });
      }
      a.meetingUrl = url;
    }
    const note = patch.note === undefined ? undefined : patch.note?.trim() || null;
    if (note !== undefined && note !== a.note) {
      a.note = note;
      a.noteUpdatedAt = new Date().toISOString();
      a.noteUpdatedBy = me.name || me.email;
    }
    save();
    return delay(appDetail(db, a));
  },

  async hrScorePending() {
    requireHr(load());
    // The demo keeps no CV files, so there is nothing to score.
    return delay({ scored: 0, remaining: 0 });
  },

  async hrScoreCv(id) {
    const db = load();
    requireHr(db);
    const a = db.applications.find((x) => x.id === id);
    if (!a) return fail(404, 'Không tìm thấy hồ sơ.');
    // The demo keeps no CV files, so there is nothing to read.
    return delay({
      ...appDetail(db, a),
      cvScore: {
        percent: null,
        items: [],
        scoredAt: new Date().toISOString(),
        note: 'Bản demo không lưu file CV nên không chấm được.',
      },
    });
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
    const user = {
      id: uid('u'),
      email: clean,
      name: name.trim() || null,
      password: randomPassword(),
      lastLoginAt: null,
      phone: null,
      contactEmail: null,
    };
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
    user.password = randomPassword();
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

  async hrUpdateProfile(patch) {
    const db = load();
    const me = requireHr(db);
    const parsed = hrProfileSchema.safeParse(patch);
    if (!parsed.success) return fail(422, 'Kiểm tra lại thông tin.', fieldErrors(parsed.error));
    me.name = parsed.data.name || null;
    me.phone = parsed.data.phone || null;
    me.contactEmail = parsed.data.contactEmail.toLowerCase() || null;
    save();
    return delay(toHrMe(me));
  },

  async hrMessageTemplates() {
    const db = load();
    requireHr(db);
    return delay(messageTemplatesOf(db));
  },

  async hrSaveMessageTemplate(key, input) {
    const db = load();
    requireHr(db);
    if (!TEMPLATE_KEYS.includes(key)) return fail(404, 'Không có mẫu thư này.');
    const parsed = messageTemplateSchema.safeParse(input);
    if (!parsed.success) return fail(422, 'Chưa lưu được, kiểm tra các ô được đánh dấu.', fieldErrors(parsed.error));
    db.messageTemplates = [...db.messageTemplates.filter((t) => t.key !== key), { key, ...parsed.data }];
    save();
    return delay(messageTemplatesOf(db));
  },

  async hrResetMessageTemplate(key) {
    const db = load();
    requireHr(db);
    db.messageTemplates = db.messageTemplates.filter((t) => t.key !== key);
    save();
    return delay(messageTemplatesOf(db));
  },

  async hrLogContact(id, input) {
    const db = load();
    const me = requireHr(db);
    const a = db.applications.find((x) => x.id === id);
    if (!a) return fail(404, 'Không tìm thấy hồ sơ.');
    if (!contactLogSchema.safeParse(input).success) return fail(422, 'Dữ liệu không hợp lệ.');
    a.contacts.push({ ...input, hrName: me.name || me.email, createdAt: new Date().toISOString() });
    save();
    return delay(appDetail(db, a));
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

  ...newsMockApi,

  // "Sếp duyệt ứng viên" needs the real BE (a private link to share): the demo only says so.
  hrReviews: async () => delay([]),
  hrReview: () => fail(501, NO_REVIEWS_IN_DEMO),
  hrCreateReview: () => fail(501, NO_REVIEWS_IN_DEMO),
  hrReviewAction: () => fail(501, NO_REVIEWS_IN_DEMO),
  reviewPage: () => fail(404, NO_REVIEWS_IN_DEMO),
  reviewDecide: () => fail(501, NO_REVIEWS_IN_DEMO),
  reviewDone: () => fail(501, NO_REVIEWS_IN_DEMO),
  reviewCvUrl: () => null,
};

const NO_REVIEWS_IN_DEMO = 'Bản demo chưa có phần sếp duyệt ứng viên.';

function messageTemplatesOf(db: MockDb) {
  const saved = new Map(db.messageTemplates.map((t) => [t.key, t]));
  return {
    templates: TEMPLATE_KEYS.map((key) => saved.get(key) ?? DEFAULT_MESSAGE_TEMPLATES[key]),
    customized: TEMPLATE_KEYS.filter((key) => saved.has(key)),
  };
}

/** Demo mode only: the per-browser password of the demo HR account; '' once that account is deleted. */
export function demoHrPassword(): string {
  return load().hrUsers.find((u) => u.email === DEMO_HR.email)?.password ?? '';
}

export { resetMockDb } from './mock-store';
