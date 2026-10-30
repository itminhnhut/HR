import {
  REVIEW_LINK_GRACE_DAYS,
  REVIEW_MAX_DAYS,
  type ReviewConflictDto,
  type ReviewDecision,
  type ReviewEventKind,
  type ReviewState,
} from '@careers/shared';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { ApplicationReviewDto, ApplicationRowDto } from '@careers/shared';
import type { Db } from '../db/index.js';
import { applications, reviewBatches, reviewEvents, reviewItems, type ReviewBatch } from '../db/schema.js';
import { HttpError, invalid } from '../lib/http-error.js';

/** Shared rules of "Sếp duyệt ứng viên" (spec-boss-review.md), used by HR's side and the reviewer's link. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function reviewState(batch: Pick<ReviewBatch, 'revokedAt' | 'expiresAt'>, now: Date): ReviewState {
  if (batch.revokedAt) return 'revoked';
  return now > batch.expiresAt ? 'expired' : 'open';
}

/** The reply-by time HR picked, checked against now; returns it with the link's expiry. */
export function replyWindow(respondBy: string, now: Date): { respondBy: Date; expiresAt: Date } {
  const at = new Date(respondBy);
  if (at <= now)
    throw invalid('Hạn phản hồi phải sau thời điểm hiện tại.', { respondBy: 'Chọn một thời điểm sắp tới.' });
  if (at.getTime() - now.getTime() > REVIEW_MAX_DAYS * DAY_MS) {
    throw invalid(`Hạn phản hồi tối đa ${REVIEW_MAX_DAYS} ngày.`, { respondBy: `Tối đa ${REVIEW_MAX_DAYS} ngày.` });
  }
  return { respondBy: at, expiresAt: new Date(at.getTime() + REVIEW_LINK_GRACE_DAYS * DAY_MS) };
}

export interface EventInput {
  batchId: string;
  kind: ReviewEventKind;
  actor: string;
  at: Date;
  applicationId?: string | null;
  decision?: ReviewDecision | null;
  detail?: string | null;
}

export async function logEvent(db: Pick<Db, 'insert'>, e: EventInput): Promise<void> {
  await db.insert(reviewEvents).values({
    batchId: e.batchId,
    kind: e.kind,
    actor: e.actor,
    at: e.at,
    applicationId: e.applicationId ?? null,
    decision: e.decision ?? null,
    detail: e.detail ?? null,
  });
}

/** True when the same event was logged for this application after `since` (no flood of "xem CV"). */
export async function recentlyLogged(
  db: Db,
  batchId: string,
  kind: ReviewEventKind,
  applicationId: string | null,
  since: Date,
): Promise<boolean> {
  const [last] = await db
    .select({ at: reviewEvents.at })
    .from(reviewEvents)
    .where(
      and(
        eq(reviewEvents.batchId, batchId),
        eq(reviewEvents.kind, kind),
        applicationId ? eq(reviewEvents.applicationId, applicationId) : isNull(reviewEvents.applicationId),
      ),
    )
    .orderBy(desc(reviewEvents.at))
    .limit(1);
  return !!last && last.at > since;
}

/** "17:00, 31/10/2026" in Vietnam time, for the log. */
export const viTime = (at: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(at);

export const hrActor = (hr: { name: string | null; email: string }) => `HR: ${hr.name || hr.email}`;

/**
 * Applications still waiting for a reviewer (no decision yet, or "Hỏi HR") in a batch HR has not revoked.
 * One open review at a time, so two HRs never send the same person twice.
 */
export async function waitingIn(
  db: Db,
  applicationIds: string[],
  exceptBatchId?: string,
): Promise<ReviewConflictDto[]> {
  if (applicationIds.length === 0) return [];
  const rows = await db
    .select({
      applicationId: reviewItems.applicationId,
      fullName: applications.fullName,
      batchTitle: reviewBatches.title,
      batchId: reviewBatches.id,
    })
    .from(reviewItems)
    .innerJoin(reviewBatches, eq(reviewBatches.id, reviewItems.batchId))
    .innerJoin(applications, eq(applications.id, reviewItems.applicationId))
    .where(
      and(
        inArray(reviewItems.applicationId, applicationIds),
        isNull(reviewBatches.revokedAt),
        or(isNull(reviewItems.decision), eq(reviewItems.decision, 'ask')),
      ),
    );
  return rows
    .filter((r) => r.batchId !== exceptBatchId)
    .map(({ applicationId, fullName, batchTitle }) => ({ applicationId, fullName, batchTitle }));
}

export function conflictError(conflicts: ReviewConflictDto[]): HttpError {
  const names = conflicts.map((c) => `${c.fullName} (đợt "${c.batchTitle}")`).join(', ');
  return new HttpError(
    409,
    `Đang chờ sếp duyệt ở đợt khác: ${names}. Bỏ chọn, hoặc khoá đợt cũ trước.`,
    {},
    'in_review',
  );
}

const reviewColumns = {
  applicationId: reviewItems.applicationId,
  batchId: reviewBatches.id,
  title: reviewBatches.title,
  reviewerName: reviewBatches.reviewerName,
  decision: reviewItems.decision,
  reviewerComment: reviewItems.reviewerComment,
  decidedAt: reviewItems.decidedAt,
  cvChangedAt: applications.cvChangedAt,
};

/** Latest reviews of these applications (batches HR has not revoked), by application id. */
export async function latestReviews(db: Db, applicationIds: string[]): Promise<Map<string, ApplicationReviewDto>> {
  const out = new Map<string, ApplicationReviewDto>();
  if (applicationIds.length === 0) return out;
  const rows = await db
    .select(reviewColumns)
    .from(reviewItems)
    .innerJoin(reviewBatches, eq(reviewBatches.id, reviewItems.batchId))
    .innerJoin(applications, eq(applications.id, reviewItems.applicationId))
    .where(and(inArray(reviewItems.applicationId, applicationIds), isNull(reviewBatches.revokedAt)))
    .orderBy(desc(reviewBatches.createdAt));
  for (const { applicationId, decidedAt, cvChangedAt, ...review } of rows) {
    if (out.has(applicationId)) continue;
    // The reviewer decided on the CV that was there then (spec-cv-intake.md).
    const cvChangedAfterDecision = !!decidedAt && !!cvChangedAt && cvChangedAt > decidedAt;
    out.set(applicationId, { ...review, cvChangedAfterDecision });
  }
  return out;
}

export const reviewMark = (review: ApplicationReviewDto | null): ApplicationRowDto['review'] =>
  review ? (review.decision ?? 'waiting') : null;

/** The latest review of an application in a batch HR has not revoked, or null when it was never sent. */
export async function latestReview(db: Db, applicationId: string): Promise<ApplicationReviewDto | null> {
  return (await latestReviews(db, [applicationId])).get(applicationId) ?? null;
}
