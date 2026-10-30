import {
  fieldErrors,
  reviewAddSchema,
  reviewCreateSchema,
  reviewExtendSchema,
  reviewReplySchema,
  type HrMe,
  type ReviewBatchDto,
  type ReviewBatchRowDto,
  type ReviewDecision,
  type ReviewEventKind,
} from '@careers/shared';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  applications,
  cvScores,
  jobs,
  reviewBatches,
  reviewEvents,
  reviewItems,
  type ReviewBatch,
} from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { conflictError, hrActor, logEvent, replyWindow, reviewState, viTime, waitingIn } from './review-model.js';

/** HR's side of "Sếp duyệt ứng viên" (spec-boss-review.md). */

const parse = <T extends z.ZodType>(schema: T, raw: unknown): z.output<T> => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw invalid('Dữ liệu không hợp lệ.', fieldErrors(parsed.error));
  return parsed.data;
};

async function findBatch(db: Db, id: string): Promise<ReviewBatch> {
  const batch = isUuid(id) ? await db.query.reviewBatches.findFirst({ where: eq(reviewBatches.id, id) }) : undefined;
  if (!batch) throw notFound('Không tìm thấy đợt duyệt.');
  return batch;
}

const notRevoked = (batch: ReviewBatch) => {
  if (batch.revokedAt) throw new HttpError(409, 'Đợt này đã bị khoá.', {}, 'review_revoked');
};

function countDecisions(decisions: (ReviewDecision | null)[]) {
  const n = (d: ReviewDecision) => decisions.filter((x) => x === d).length;
  return { total: decisions.length, approved: n('approve'), rejected: n('reject'), asked: n('ask') };
}

function toRow(batch: ReviewBatch, decisions: (ReviewDecision | null)[], now: Date): ReviewBatchRowDto {
  return {
    id: batch.id,
    title: batch.title,
    reviewerName: batch.reviewerName,
    createdAt: batch.createdAt.toISOString(),
    respondBy: batch.respondBy.toISOString(),
    state: reviewState(batch, now),
    openedAt: batch.openedAt?.toISOString() ?? null,
    doneAt: batch.doneAt?.toISOString() ?? null,
    ...countDecisions(decisions),
  };
}

export async function listReviews(db: Db, now: Date): Promise<ReviewBatchRowDto[]> {
  const batches = await db.select().from(reviewBatches).orderBy(desc(reviewBatches.createdAt));
  if (batches.length === 0) return [];
  const items = await db
    .select({ batchId: reviewItems.batchId, decision: reviewItems.decision })
    .from(reviewItems)
    .where(
      inArray(
        reviewItems.batchId,
        batches.map((b) => b.id),
      ),
    );
  return batches.map((b) =>
    toRow(
      b,
      items.filter((i) => i.batchId === b.id).map((i) => i.decision),
      now,
    ),
  );
}

async function itemsOf(db: Db, batchId: string) {
  return db
    .select({
      item: reviewItems,
      fullName: applications.fullName,
      status: applications.status,
      appliedAt: applications.createdAt,
      jobTitle: jobs.title,
      matchPercent: cvScores.percent,
    })
    .from(reviewItems)
    .innerJoin(applications, eq(applications.id, reviewItems.applicationId))
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .leftJoin(cvScores, eq(cvScores.applicationId, applications.id))
    .where(eq(reviewItems.batchId, batchId))
    .orderBy(reviewItems.position);
}

async function eventsOf(db: Db, batchId: string): Promise<ReviewBatchDto['events']> {
  const rows = await db
    .select({ event: reviewEvents, fullName: applications.fullName })
    .from(reviewEvents)
    .leftJoin(applications, eq(applications.id, reviewEvents.applicationId))
    .where(eq(reviewEvents.batchId, batchId))
    .orderBy(desc(reviewEvents.at))
    .limit(200);
  return rows.map(({ event: e, fullName }) => ({
    kind: e.kind as ReviewEventKind,
    actor: e.actor,
    applicationName: fullName ?? null,
    decision: e.decision,
    detail: e.detail,
    at: e.at.toISOString(),
  }));
}

export async function getReview(db: Db, id: string, now: Date): Promise<ReviewBatchDto> {
  const batch = await findBatch(db, id);
  const [rows, events] = await Promise.all([itemsOf(db, batch.id), eventsOf(db, batch.id)]);
  return {
    ...toRow(
      batch,
      rows.map((r) => r.item.decision),
      now,
    ),
    token: batch.token,
    senderName: batch.senderName,
    message: batch.message,
    expiresAt: batch.expiresAt.toISOString(),
    createdBy: batch.createdBy,
    items: rows.map(({ item, ...app }) => ({
      id: item.id,
      applicationId: item.applicationId,
      fullName: app.fullName,
      jobTitle: app.jobTitle,
      appliedAt: app.appliedAt.toISOString(),
      matchPercent: app.matchPercent,
      status: app.status,
      hrPick: item.hrPick,
      hrComment: item.hrComment,
      decision: item.decision,
      reviewerComment: item.reviewerComment,
      decidedAt: item.decidedAt?.toISOString() ?? null,
      hrReply: item.hrReply,
    })),
    events,
  };
}

type ItemInput = z.output<typeof reviewAddSchema>['items'][number];

/** Every application exists and none is waiting in another open batch. */
async function checkApplications(db: Db, items: ItemInput[], batchId?: string) {
  const ids = items.map((i) => i.applicationId);
  const found = await db
    .select({ id: applications.id, fullName: applications.fullName, status: applications.status })
    .from(applications)
    .where(inArray(applications.id, ids));
  if (found.length !== ids.length) throw invalid('Có hồ sơ không còn tồn tại. Tải lại danh sách rồi chọn lại.');
  // Already invited or already told "chưa phù hợp": nothing left for the reviewer to decide.
  const settled = found.filter((a) => a.status === 'interview' || a.status === 'rejected');
  if (settled.length > 0) {
    const names = settled.map((a) => a.fullName).join(', ');
    throw invalid(`Đã hẹn phỏng vấn hoặc đã báo chưa phù hợp, không cần sếp duyệt: ${names}.`);
  }
  const conflicts = await waitingIn(db, ids, batchId);
  if (conflicts.length > 0) throw conflictError(conflicts);
}

export async function createReview(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<ReviewBatchDto> {
  const input = parse(reviewCreateSchema, raw);
  const window = replyWindow(input.respondBy, now);
  await checkApplications(db, input.items);
  const actor = hrActor(hr);
  const id = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(reviewBatches)
      .values({
        token: randomBytes(32).toString('base64url'),
        title: input.title,
        senderName: input.senderName,
        reviewerName: input.reviewerName,
        message: input.message,
        ...window,
        createdBy: hr.name || hr.email,
        // The app's clock, not the database's: "CV changed after it was sent" compares with it.
        createdAt: now,
      })
      .returning({ id: reviewBatches.id });
    await tx
      .insert(reviewItems)
      .values(input.items.map((item, position) => ({ batchId: batch.id, position, ...item, createdAt: now })));
    await logEvent(tx, { batchId: batch.id, kind: 'sent', actor, at: now, detail: `${input.items.length} ứng viên` });
    return batch.id;
  });
  return getReview(db, id, now);
}

/** "Thêm ứng viên" to a batch the reviewer may already be reading; it is no longer "xem xong". */
export async function addToReview(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<ReviewBatchDto> {
  const batch = await findBatch(db, id);
  notRevoked(batch);
  const { items } = parse(reviewAddSchema, raw);
  const existing = await db.select().from(reviewItems).where(eq(reviewItems.batchId, batch.id));
  if (items.some((i) => existing.some((e) => e.applicationId === i.applicationId))) {
    throw invalid('Có ứng viên đã nằm trong đợt này.');
  }
  await checkApplications(db, items, batch.id);
  const start = Math.max(-1, ...existing.map((e) => e.position)) + 1;
  await db.transaction(async (tx) => {
    await tx
      .insert(reviewItems)
      .values(items.map((item, i) => ({ batchId: batch.id, position: start + i, ...item, createdAt: now })));
    await tx.update(reviewBatches).set({ doneAt: null }).where(eq(reviewBatches.id, batch.id));
    for (const item of items) {
      await logEvent(tx, {
        batchId: batch.id,
        kind: 'added',
        actor: hrActor(hr),
        at: now,
        applicationId: item.applicationId,
      });
    }
  });
  return getReview(db, batch.id, now);
}

/** "Bỏ khỏi đợt": only while the reviewer has not decided on that application. */
export async function removeFromReview(db: Db, id: string, itemId: string, hr: HrMe, now: Date) {
  const batch = await findBatch(db, id);
  const item = isUuid(itemId)
    ? await db.query.reviewItems.findFirst({
        where: and(eq(reviewItems.id, itemId), eq(reviewItems.batchId, batch.id)),
      })
    : undefined;
  if (!item) throw notFound('Không tìm thấy ứng viên trong đợt.');
  if (item.decision) throw new HttpError(409, 'Sếp đã quyết định ứng viên này, không bỏ khỏi đợt được.', {}, 'decided');
  await db.delete(reviewItems).where(eq(reviewItems.id, item.id));
  await logEvent(db, {
    batchId: batch.id,
    kind: 'removed',
    actor: hrActor(hr),
    at: now,
    applicationId: item.applicationId,
  });
  return getReview(db, batch.id, now);
}

/** "Gia hạn": a new reply-by time; also reopens a link that had expired. */
export async function extendReview(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<ReviewBatchDto> {
  const batch = await findBatch(db, id);
  notRevoked(batch);
  const window = replyWindow(parse(reviewExtendSchema, raw).respondBy, now);
  await db.update(reviewBatches).set(window).where(eq(reviewBatches.id, batch.id));
  const detail = `Hạn mới ${viTime(window.respondBy)}`;
  await logEvent(db, { batchId: batch.id, kind: 'extended', actor: hrActor(hr), at: now, detail });
  return getReview(db, batch.id, now);
}

/** "Khoá link": the page stops opening at once. Applications waiting in it are free to send again. */
export async function revokeReview(db: Db, id: string, hr: HrMe, now: Date): Promise<ReviewBatchDto> {
  const batch = await findBatch(db, id);
  if (!batch.revokedAt) {
    await db.update(reviewBatches).set({ revokedAt: now }).where(eq(reviewBatches.id, batch.id));
    await logEvent(db, { batchId: batch.id, kind: 'revoked', actor: hrActor(hr), at: now });
  }
  return getReview(db, batch.id, now);
}

/** "Trả lời sếp": answers the reviewer's question; it shows under the question on the reviewer's page. */
export async function replyInReview(db: Db, id: string, itemId: string, raw: unknown, hr: HrMe, now: Date) {
  const batch = await findBatch(db, id);
  notRevoked(batch);
  const { reply } = parse(reviewReplySchema, raw);
  const item = isUuid(itemId)
    ? await db.query.reviewItems.findFirst({
        where: and(eq(reviewItems.id, itemId), eq(reviewItems.batchId, batch.id)),
      })
    : undefined;
  if (!item) throw notFound('Không tìm thấy ứng viên trong đợt.');
  if (item.decision !== 'ask') throw new HttpError(409, 'Sếp không hỏi gì về ứng viên này.', {}, 'no_question');
  await db.update(reviewItems).set({ hrReply: reply, hrRepliedAt: now }).where(eq(reviewItems.id, item.id));
  await logEvent(db, {
    batchId: batch.id,
    kind: 'replied',
    actor: hrActor(hr),
    at: now,
    applicationId: item.applicationId,
    detail: reply,
  });
  return getReview(db, batch.id, now);
}
