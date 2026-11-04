import {
  applicationUpdateSchema,
  bonusCount,
  contactLogSchema,
  fieldErrors,
  isInvited,
  matchesQuery,
  statusChangeProblem,
  type ApplicationDetailDto,
  type ApplicationRowDto,
  type ApplicationsResponse,
  type ApplicationSource,
  type ApplicationStatus,
  type CvGender,
  type HrMe,
  type MatchItem,
  type SubscriberDto,
} from '@careers/shared';
import { and, desc, eq, getTableColumns, inArray, ne } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { Db } from '../db/index.js';
import { applications, contactLog, cvChanges, cvScores, jobs, subscribers, type Application } from '../db/schema.js';
import { scoreApplication, storedScore } from './cv-score.js';
import { hrActor, latestReview, latestReviews, logEvent, reviewMark } from './review-model.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { expiredApplicationsWhere } from './hr-jobs.js';
import { activityOf, actorOf, logActivity, logNoteEdit } from './activity.js';
import { dropLastStatus, isReportedStep, logStatus, rewindSteps } from './status-log.js';

const STATUSES: ApplicationStatus[] = ['new', 'seen', 'interview', 'passed', 'hired', 'rejected'];

type ApplicationWithJob = Application & {
  jobTitle: string;
  matchPercent: number | null;
  matchItems: MatchItem[] | null;
  cvGender: CvGender | null;
  cvBirth: string | null;
};

const withJobTitle = (db: Db) =>
  db
    .select({
      ...getTableColumns(applications),
      jobTitle: jobs.title,
      matchPercent: cvScores.percent,
      matchItems: cvScores.items,
      cvGender: cvScores.gender,
      cvBirth: cvScores.birth,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .leftJoin(cvScores, eq(cvScores.applicationId, applications.id));

const firstLine = (text: string | null) =>
  text
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim() ?? null;

function toRow(a: ApplicationWithJob, review: ApplicationRowDto['review']): ApplicationRowDto {
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitle: a.jobTitle,
    fullName: a.fullName,
    phone: a.phone,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    hasCv: !!(a.cvPathname || a.cvLink),
    matchPercent: a.matchPercent,
    matchBonus: bonusCount(a.matchItems ?? []),
    cvGender: a.cvGender,
    cvBirth: a.cvBirth,
    noteLine: firstLine(a.note),
    interviewAt: a.interviewAt?.toISOString() ?? null,
    review,
    source: a.source,
    cvUpdatedByCandidate: a.cvChangedBy === 'candidate' && !a.cvChangeSeen,
  };
}

async function cvHistoryOf(db: Db, applicationId: string): Promise<ApplicationDetailDto['cvHistory']> {
  const rows = await db
    .select()
    .from(cvChanges)
    .where(eq(cvChanges.applicationId, applicationId))
    .orderBy(desc(cvChanges.at));
  return rows.map((r) => ({
    by: r.changedBy === 'candidate' ? 'Ứng viên' : r.changedBy,
    at: r.at.toISOString(),
    previous: r.previous,
  }));
}

async function toDetail(db: Db, a: ApplicationWithJob): Promise<ApplicationDetailDto> {
  const others = await withJobTitle(db)
    .where(and(eq(applications.phone, a.phone), ne(applications.id, a.id)))
    .orderBy(desc(applications.createdAt));
  const contacts = await db
    .select()
    .from(contactLog)
    .where(eq(contactLog.applicationId, a.id))
    .orderBy(desc(contactLog.createdAt));
  const reviewInfo = await latestReview(db, a.id);
  return {
    ...toRow(a, reviewMark(reviewInfo)),
    reviewInfo,
    rejectReason: a.rejectReason,
    rejectNote: a.rejectNote,
    referrer: a.referrer,
    addedBy: a.addedBy,
    consentBy: a.consentBy,
    activity: await activityOf(db, a.id),
    cvHistory: await cvHistoryOf(db, a.id),
    interviewMode: a.interviewMode,
    meetingUrl: a.meetingUrl,
    cvScore: await storedScore(db, a.id),
    contacts: contacts.map((c) => ({
      templateKey: c.templateKey,
      channel: c.channel,
      hrName: c.hrName,
      createdAt: c.createdAt.toISOString(),
    })),
    email: a.email,
    message: a.message,
    cvFileName: a.cvFileName,
    cvLink: a.cvLink,
    note: a.note,
    noteUpdatedAt: a.noteUpdatedAt?.toISOString() ?? null,
    noteUpdatedBy: a.noteUpdatedBy,
    otherApplications: others.map((o) => ({
      id: o.id,
      jobTitle: o.jobTitle,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

const emptyCounts = (): ApplicationsResponse['counts'] =>
  ({ all: 0, ...Object.fromEntries(STATUSES.map((s) => [s, 0])) }) as ApplicationsResponse['counts'];

async function expiredIds(db: Db, now: Date): Promise<ReadonlySet<string>> {
  const where = expiredApplicationsWhere(await db.select().from(jobs), now);
  if (!where) return new Set();
  const rows = await db.select({ id: applications.id }).from(applications).where(where);
  return new Set(rows.map((row) => row.id));
}

/** `q`: name or phone, any order, without tones ("huy 0797" finds Phạm Quốc Huy, 0797 586 611). */
export async function listApplications(
  db: Db,
  jobId: string | undefined,
  q = '',
  source?: ApplicationSource,
  now = new Date(),
): Promise<ApplicationsResponse> {
  if (jobId !== undefined && !isUuid(jobId)) return { applications: [], counts: emptyCounts(), jobs: [] };
  const [rows, jobsWithApplications] = await Promise.all([
    withJobTitle(db)
      .where(jobId ? eq(applications.jobId, jobId) : undefined)
      .orderBy(desc(applications.createdAt)),
    db
      .selectDistinct({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .innerJoin(applications, eq(applications.jobId, jobs.id))
      .orderBy(jobs.title),
  ]);
  // "+84 933 111 999" from a caller ID finds 0933111999.
  const digits = q.replace(/\D/g, '').replace(/^84(?=\d{9}$)/, '0');
  const found = rows.filter(
    (row) =>
      (!source || row.source === source) &&
      (matchesQuery(`${row.fullName} ${row.phone}`, q) || (digits.length >= 3 && row.phone.includes(digits))),
  );
  const counts = emptyCounts();
  counts.all = found.length;
  for (const row of found) counts[row.status] += 1;
  const reviews = await latestReviews(
    db,
    found.map((row) => row.id),
  );
  const expired = await expiredIds(db, now);
  return {
    applications: found.map((row) => ({
      ...toRow(row, reviewMark(reviews.get(row.id) ?? null)),
      isExpired: expired.has(row.id),
    })),
    counts,
    jobs: jobsWithApplications,
  };
}

async function findApplication(db: Db, id: string): Promise<ApplicationWithJob> {
  const [row] = isUuid(id) ? await withJobTitle(db).where(eq(applications.id, id)) : [];
  if (!row) throw notFound('Không tìm thấy hồ sơ.');
  return row;
}

/** Opening an application marks it "seen" (the candidate sees "HR đã xem"). */
export async function openApplication(db: Db, id: string, hr: HrMe): Promise<ApplicationDetailDto> {
  const row = await findApplication(db, id);
  // An HR has now seen the candidate's new CV too.
  if (row.status !== 'new' && row.cvChangeSeen) return toDetail(db, row);
  const patch = { status: row.status === 'new' ? ('seen' as const) : row.status, cvChangeSeen: true };
  await db.update(applications).set(patch).where(eq(applications.id, id));
  if (patch.status !== row.status) {
    await logActivity(db, {
      applicationId: id,
      kind: 'status',
      actor: actorOf(hr),
      from: row.status,
      to: patch.status,
    });
  }
  return toDetail(db, { ...row, ...patch });
}

/**
 * Leaving "Hẹn phỏng vấn" drops the interview details, so a later invitation never reuses an old time or Meet link.
 * The exception is rejecting after the interview took place: its date stays for the thank-you letter.
 */
function interviewDetailsOnStatusChange(row: Application, status: Application['status'] | undefined, now: Date) {
  if (!status || status === row.status) return {};
  if (status === 'interview') return { interviewAt: null };
  const wasInterviewed = !!row.interviewAt && row.interviewAt <= now;
  const keepsDate = status === 'passed' || status === 'hired' || (status === 'rejected' && wasInterviewed);
  return { interviewAt: keepsDate ? row.interviewAt : null, interviewMode: null, meetingUrl: null };
}

/** Statuses that come with an interview date: the time, or the date kept for the letter and the record. */
const DATED_STATUSES: readonly ApplicationStatus[] = ['interview', 'passed', 'hired', 'rejected'];

type ApplicationUpdate = ReturnType<typeof applicationUpdateSchema.parse>;

/** What a status change needs. An undo restores what was there, so it is free of these. */
function checkStatusChange(row: Application, input: ApplicationUpdate, now: Date): void {
  const { status, rejectReason, rejectNote, isUndo } = input;
  if (!status || status === row.status || isUndo) return;
  const problem = statusChangeProblem(
    { status: row.status, interviewAt: row.interviewAt?.toISOString() ?? null },
    status,
    now,
  );
  if (problem) throw invalid(problem, { status: problem });
  if (status !== 'rejected') return;
  if (!rejectReason) throw invalid('Chọn lý do chưa phù hợp.', { rejectReason: 'Chọn một lý do.' });
  if (rejectReason === 'other' && !rejectNote) {
    throw invalid('Ghi rõ lý do.', { rejectNote: 'Ghi rõ lý do khi chọn "Khác".' });
  }
}

/** The reason belongs to "Chưa phù hợp" only: leaving it clears the reason. */
function rejectFields(row: Application, input: ApplicationUpdate) {
  const target = input.status ?? row.status;
  if (target !== 'rejected') return { rejectReason: null, rejectNote: null };
  if (input.rejectReason === undefined && input.rejectNote === undefined) return {};
  return {
    ...(input.rejectReason !== undefined ? { rejectReason: input.rejectReason } : {}),
    ...(input.rejectNote !== undefined ? { rejectNote: input.rejectNote || null } : {}),
  };
}

/** What this change did, for "Nhật ký hồ sơ". */
async function logChanges(
  db: Db,
  before: Application,
  after: Application,
  input: ApplicationUpdate,
  hr: HrMe,
  now: Date,
): Promise<void> {
  const base = { applicationId: before.id, actor: actorOf(hr), at: now };
  if (after.status !== before.status) {
    const detail = input.isUndo ? 'undo' : (after.rejectReason ?? null);
    await logActivity(db, { ...base, kind: 'status', from: before.status, to: after.status, detail });
  }
  const timeBefore = before.interviewAt?.toISOString() ?? null;
  const timeAfter = after.interviewAt?.toISOString() ?? null;
  if (input.interviewAt !== undefined && !input.isUndo && timeBefore !== timeAfter) {
    await logActivity(db, { ...base, kind: 'interview', from: timeBefore, to: timeAfter });
  }
  if (after.note !== before.note) await logNoteEdit(db, before.id, base.actor, now);
}

export async function updateApplication(
  db: Db,
  id: string,
  raw: unknown,
  now: Date,
  hr: HrMe,
): Promise<ApplicationDetailDto> {
  const row = await findApplication(db, id);
  const parsed = applicationUpdateSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Dữ liệu không hợp lệ.', fieldErrors(parsed.error));
  const { status, note, interviewAt, interviewMode, meetingUrl, reviewBypassReason, isUndo } = parsed.data;
  checkStatusChange(row, parsed.data, now);
  // Back from a result is a correction: the invitation was already decided.
  if (status === 'interview' && !isInvited(row.status) && !isUndo) {
    await checkReview(db, row, reviewBypassReason, hr, now);
  }
  // An interview time only belongs to "Hẹn phỏng vấn" and to what comes after it.
  if (interviewAt && !DATED_STATUSES.includes(status ?? row.status)) {
    throw invalid('Chỉ hồ sơ "Hẹn phỏng vấn" mới có giờ phỏng vấn.', { interviewAt: 'Chọn "Hẹn phỏng vấn" trước.' });
  }
  // Interview details only belong to "Hẹn phỏng vấn"; for any other status they are cleared below.
  const interviewing = (status ?? row.status) === 'interview';
  const noteChanged = note !== undefined && (note?.trim() || null) !== row.note;
  const patch = {
    ...(status ? { status } : {}),
    ...rejectFields(row, parsed.data),
    ...interviewDetailsOnStatusChange(row, status, now),
    ...(interviewAt !== undefined ? { interviewAt: interviewAt ? new Date(interviewAt) : null } : {}),
    ...(interviewing && interviewMode !== undefined ? { interviewMode } : {}),
    ...(interviewing && meetingUrl !== undefined ? { meetingUrl } : {}),
    ...(noteChanged ? { note: note?.trim() || null, noteUpdatedAt: now, noteUpdatedBy: hr.name || hr.email } : {}),
  };
  if (Object.keys(patch).length === 0) return toDetail(db, row);
  const [updated] = await db.update(applications).set(patch).where(eq(applications.id, id)).returning();
  await logChanges(db, row, updated, parsed.data, hr, now);
  if (status && status !== row.status) {
    if (!isUndo) await rewindSteps(db, id, status);
    if (!isUndo && isReportedStep(status)) await logStatus(db, row, status, parsed.data.rejectReason ?? null);
    if (isUndo && isReportedStep(row.status)) await dropLastStatus(db, id);
  }
  return toDetail(db, {
    ...updated,
    jobTitle: row.jobTitle,
    matchPercent: row.matchPercent,
    matchItems: row.matchItems,
    cvGender: row.cvGender,
    cvBirth: row.cvBirth,
  });
}

/**
 * Sent to a reviewer and not approved yet: no interview, unless HR writes why ("Vẫn hẹn"); the reason goes into
 * the batch's log, so the reviewer's decision is never skipped silently (spec-boss-review.md).
 */
async function checkReview(db: Db, row: ApplicationWithJob, bypassReason: string | undefined, hr: HrMe, now: Date) {
  const review = await latestReview(db, row.id);
  if (!review || review.decision === 'approve') return;
  if (!bypassReason) {
    const why =
      review.decision === 'reject'
        ? `${review.reviewerName} không duyệt phỏng vấn`
        : `đang chờ ${review.reviewerName} duyệt`;
    throw new HttpError(
      409,
      `Ứng viên ${why} (đợt "${review.title}"). Ghi lý do nếu vẫn muốn hẹn.`,
      {},
      'needs_review',
    );
  }
  await logEvent(db, {
    batchId: review.batchId,
    kind: 'bypassed',
    actor: hrActor(hr),
    at: now,
    applicationId: row.id,
    detail: bypassReason,
  });
}

/** Records that HR prepared a message for this person (the site cannot see whether it was really sent). */
export async function logContact(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<ApplicationDetailDto> {
  const row = await findApplication(db, id);
  const parsed = contactLogSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Dữ liệu không hợp lệ.', fieldErrors(parsed.error));
  await db
    .insert(contactLog)
    .values({ applicationId: row.id, ...parsed.data, hrName: hr.name || hr.email, createdAt: now });
  return toDetail(db, row);
}

/** "Chấm CV": scores (or re-uses the stored score of) the application's CV against its job. */
export async function scoreCvOf(deps: Deps, id: string): Promise<ApplicationDetailDto> {
  const row = await findApplication(deps.db, id);
  const job = await deps.db.query.jobs.findFirst({ where: eq(jobs.id, row.jobId) });
  if (!job) throw notFound('Không tìm thấy tin.');
  await scoreApplication(deps, row, job);
  return toDetail(deps.db, await findApplication(deps.db, id));
}

export async function cvOf(db: Db, id: string): Promise<{ pathname: string; fullName: string }> {
  const row = await findApplication(db, id);
  if (!row.cvPathname) throw notFound('Hồ sơ không có file CV.');
  return { pathname: row.cvPathname, fullName: row.fullName };
}

/** Files first: if storage fails nothing is deleted, and a retry finds everything again. */
async function deleteWithFiles({ db, cvStore }: Deps, rows: Pick<Application, 'id' | 'cvPathname'>[]) {
  await cvStore.delete(rows.map((r) => r.cvPathname).filter((p): p is string => !!p));
  if (rows.length > 0)
    await db.delete(applications).where(
      inArray(
        applications.id,
        rows.map((r) => r.id),
      ),
    );
}

/** "Xoá hồ sơ": the candidate asked, or HR does not need it any more. CV file included. */
export async function deleteApplication(deps: Deps, id: string): Promise<{ ok: true }> {
  const row = await findApplication(deps.db, id);
  await deleteWithFiles(deps, [row]);
  return { ok: true };
}

export async function listSubscribers(db: Db): Promise<SubscriberDto[]> {
  const rows = await db
    .select({
      id: subscribers.id,
      phone: subscribers.phone,
      department: subscribers.department,
      fromJobTitle: jobs.title,
      createdAt: subscribers.createdAt,
    })
    .from(subscribers)
    .leftJoin(jobs, eq(jobs.id, subscribers.fromJobId))
    .orderBy(desc(subscribers.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** Idempotent: deleting a number that is already gone still answers ok. */
export async function deleteSubscriber(db: Db, id: string): Promise<{ ok: true }> {
  if (isUuid(id)) await db.delete(subscribers).where(eq(subscribers.id, id));
  return { ok: true };
}
