import { fieldErrors, reviewDecisionSchema, type ReviewItemPublicDto, type ReviewPageDto } from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applications, cvScores, jobs, reviewBatches, reviewItems, type ReviewBatch } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { logEvent, recentlyLogged, reviewState } from './review-model.js';

/**
 * The reviewer's side of "Sếp duyệt ứng viên" (spec-boss-review.md): everything goes through the secret link,
 * no sign-in. The reviewer never sees phone numbers or emails, and only the applications of this batch.
 */

/** base64url of 32 random bytes. Anything else is not a link we made: 404 without touching the database. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const MINUTE_MS = 60_000;
/** Opening the page or a CV again within this time does not add another line to HR's log. */
const LOG_GAP_MS = 10 * MINUTE_MS;

async function batchOf(db: Db, token: string): Promise<ReviewBatch> {
  const batch = TOKEN.test(token)
    ? await db.query.reviewBatches.findFirst({ where: eq(reviewBatches.token, token) })
    : undefined;
  if (!batch) throw notFound('Link không đúng hoặc đã bị xoá. Hỏi lại HR link mới.');
  return batch;
}

/** For changes: the link must still be open. */
async function openBatchOf(db: Db, token: string, now: Date): Promise<ReviewBatch> {
  const batch = await batchOf(db, token);
  const state = reviewState(batch, now);
  if (state === 'revoked') throw new HttpError(409, 'HR đã khoá link này.', {}, 'review_revoked');
  if (state === 'expired')
    throw new HttpError(409, 'Link đã hết hạn. Nhắn HR gia hạn nếu anh/chị cần thêm thời gian.', {}, 'review_expired');
  return batch;
}

async function itemRows(db: Db, batchId: string) {
  return db
    .select({
      item: reviewItems,
      fullName: applications.fullName,
      status: applications.status,
      appliedAt: applications.createdAt,
      message: applications.message,
      cvPathname: applications.cvPathname,
      cvLink: applications.cvLink,
      jobTitle: jobs.title,
      matchPercent: cvScores.percent,
      matchItems: cvScores.items,
    })
    .from(reviewItems)
    .innerJoin(applications, eq(applications.id, reviewItems.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .leftJoin(cvScores, eq(cvScores.applicationId, applications.id))
    .where(eq(reviewItems.batchId, batchId))
    .orderBy(reviewItems.position);
}

function toItem(row: Awaited<ReturnType<typeof itemRows>>[number]): ReviewItemPublicDto {
  const { item } = row;
  return {
    id: item.id,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    appliedAt: row.appliedAt.toISOString(),
    matchPercent: row.matchPercent,
    matchItems: (row.matchItems ?? []).map(({ requirement, verdict, reason }) => ({ requirement, verdict, reason })),
    hrPick: item.hrPick,
    hrComment: item.hrComment,
    message: row.message,
    cv: row.cvPathname ? 'file' : row.cvLink ? 'link' : null,
    cvLink: row.cvPathname ? null : row.cvLink,
    decision: item.decision,
    reviewerComment: item.reviewerComment,
    decidedAt: item.decidedAt?.toISOString() ?? null,
    hrReply: item.hrReply,
    hrRepliedAt: item.hrRepliedAt?.toISOString() ?? null,
    scheduled: row.status === 'interview',
  };
}

async function page(db: Db, batch: ReviewBatch, now: Date): Promise<ReviewPageDto> {
  return {
    title: batch.title,
    senderName: batch.senderName,
    reviewerName: batch.reviewerName,
    message: batch.message,
    respondBy: batch.respondBy.toISOString(),
    expiresAt: batch.expiresAt.toISOString(),
    state: reviewState(batch, now),
    doneAt: batch.doneAt?.toISOString() ?? null,
    items: (await itemRows(db, batch.id)).map(toItem),
  };
}

/** Opening the link: HR sees "Sếp đã mở lúc …" and a log line (not one per reload). */
export async function openReviewPage(db: Db, token: string, now: Date): Promise<ReviewPageDto> {
  const batch = await batchOf(db, token);
  if (reviewState(batch, now) === 'open') {
    if (!batch.openedAt) await db.update(reviewBatches).set({ openedAt: now }).where(eq(reviewBatches.id, batch.id));
    const since = new Date(now.getTime() - LOG_GAP_MS);
    if (!(await recentlyLogged(db, batch.id, 'opened', null, since))) {
      await logEvent(db, { batchId: batch.id, kind: 'opened', actor: batch.reviewerName, at: now });
    }
  }
  return page(db, { ...batch, openedAt: batch.openedAt ?? now }, now);
}

async function itemOf(db: Db, batch: ReviewBatch, itemId: string) {
  const item = isUuid(itemId)
    ? await db.query.reviewItems.findFirst({
        where: and(eq(reviewItems.id, itemId), eq(reviewItems.batchId, batch.id)),
      })
    : undefined;
  if (!item) throw notFound('Không tìm thấy ứng viên trong đợt này.');
  return item;
}

/** Duyệt PV / Không / Hỏi HR, or null to clear. Saved at once; can change until HR sets the interview. */
export async function decideInReview(
  db: Db,
  token: string,
  itemId: string,
  raw: unknown,
  now: Date,
): Promise<ReviewPageDto> {
  const batch = await openBatchOf(db, token, now);
  const item = await itemOf(db, batch, itemId);
  const parsed = reviewDecisionSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Dữ liệu không hợp lệ.', fieldErrors(parsed.error));
  const { decision, comment } = parsed.data;
  const app = await db.query.applications.findFirst({ where: eq(applications.id, item.applicationId) });
  if (app?.status === 'interview') {
    throw new HttpError(
      409,
      'HR đã hẹn phỏng vấn ứng viên này, không đổi được nữa. Nhắn HR nếu cần huỷ lịch.',
      {},
      'scheduled',
    );
  }
  if (decision === item.decision && (decision ? comment : null) === item.reviewerComment) return page(db, batch, now);
  await db
    .update(reviewItems)
    .set({ decision, reviewerComment: decision ? comment : null, decidedAt: decision ? now : null })
    .where(eq(reviewItems.id, item.id));
  await logEvent(db, {
    batchId: batch.id,
    kind: decision ? 'decided' : 'cleared',
    actor: batch.reviewerName,
    at: now,
    applicationId: item.applicationId,
    decision,
    detail: decision ? comment : null,
  });
  return page(db, batch, now);
}

/** "Báo HR: đã xem xong": every application has a decision. */
export async function finishReview(db: Db, token: string, now: Date): Promise<ReviewPageDto> {
  const batch = await openBatchOf(db, token, now);
  const items = await db
    .select({ decision: reviewItems.decision })
    .from(reviewItems)
    .where(eq(reviewItems.batchId, batch.id));
  const left = items.filter((i) => !i.decision).length;
  if (left > 0) throw new HttpError(409, `Còn ${left} ứng viên chưa quyết.`, {}, 'not_done');
  if (!batch.doneAt) {
    await db.update(reviewBatches).set({ doneAt: now }).where(eq(reviewBatches.id, batch.id));
    await logEvent(db, { batchId: batch.id, kind: 'done', actor: batch.reviewerName, at: now });
  }
  return page(db, { ...batch, doneAt: batch.doneAt ?? now }, now);
}

/** The CV file of one application of the batch, while the link is open. */
export async function reviewCvOf(
  db: Db,
  token: string,
  itemId: string,
  now: Date,
): Promise<{ pathname: string; fullName: string; reviewerName: string }> {
  const batch = await openBatchOf(db, token, now);
  const item = await itemOf(db, batch, itemId);
  const app = await db.query.applications.findFirst({ where: eq(applications.id, item.applicationId) });
  if (!app?.cvPathname) throw notFound('Hồ sơ này không có file CV.');
  if (!(await recentlyLogged(db, batch.id, 'cv', app.id, new Date(now.getTime() - LOG_GAP_MS)))) {
    await logEvent(db, { batchId: batch.id, kind: 'cv', actor: batch.reviewerName, at: now, applicationId: app.id });
  }
  return { pathname: app.cvPathname, fullName: app.fullName, reviewerName: batch.reviewerName };
}
