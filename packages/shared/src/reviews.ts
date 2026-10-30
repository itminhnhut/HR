import { z } from 'zod';
import type { ApplicationStatus } from './types.js';
import type { MatchVerdict } from './cv-match/types.js';

/**
 * "Sếp duyệt ứng viên" (spec-boss-review.md): HR sends a batch of applications to a reviewer through a private
 * link; the reviewer approves, declines or asks per application, and only approved ones can be invited.
 */

export type ReviewDecision = 'approve' | 'reject' | 'ask';
/** HR's own view when sending: "Nên phỏng vấn" or "Cân nhắc". */
export type ReviewPick = 'yes' | 'maybe';
/** open = the reviewer can still decide; expired / revoked = read only. */
export type ReviewState = 'open' | 'expired' | 'revoked';
export type ReviewEventKind =
  | 'sent'
  | 'opened'
  | 'cv'
  | 'decided'
  | 'cleared'
  | 'done'
  | 'added'
  | 'removed'
  | 'extended'
  | 'revoked'
  | 'replied'
  | 'bypassed';

export const REVIEW_DECISION_LABEL: Record<ReviewDecision, string> = {
  approve: 'Duyệt phỏng vấn',
  reject: 'Không phỏng vấn',
  ask: 'Cần hỏi thêm',
};

export const REVIEW_PICK_LABEL: Record<ReviewPick, string> = { yes: 'HR đề xuất PV', maybe: 'HR cân nhắc' };

export const REVIEW_TITLE_MAX = 120;
export const REVIEW_NAME_MAX = 80;
export const REVIEW_TEXT_MAX = 1000;
export const REVIEW_MAX_ITEMS = 30;
/** The link keeps working this long after the reply-by time, then the page is read only. */
export const REVIEW_LINK_GRACE_DAYS = 5;
/** Furthest reply-by time HR can set, from now. */
export const REVIEW_MAX_DAYS = 30;
export const REVIEW_BYPASS_MIN = 5;

/** One application as the reviewer sees it: no phone, no email. */
export interface ReviewItemPublicDto {
  id: string;
  fullName: string;
  jobTitle: string;
  appliedAt: string;
  matchPercent: number | null;
  matchItems: { requirement: string; verdict: MatchVerdict; reason: string | null }[];
  hrPick: ReviewPick;
  hrComment: string | null;
  /** The candidate's own message from the form. */
  message: string | null;
  /** file = a stored PDF (opened through the review link); link = an address the candidate gave. */
  cv: 'file' | 'link' | null;
  cvLink: string | null;
  decision: ReviewDecision | null;
  reviewerComment: string | null;
  decidedAt: string | null;
  hrReply: string | null;
  hrRepliedAt: string | null;
  /** HR already set an interview: the decision can no longer change. */
  scheduled: boolean;
}

/** GET /api/review/:token */
export interface ReviewPageDto {
  title: string;
  senderName: string;
  reviewerName: string;
  message: string | null;
  respondBy: string;
  expiresAt: string;
  state: ReviewState;
  doneAt: string | null;
  items: ReviewItemPublicDto[];
}

/** A batch in HR's list. */
export interface ReviewBatchRowDto {
  id: string;
  title: string;
  reviewerName: string;
  createdAt: string;
  respondBy: string;
  state: ReviewState;
  openedAt: string | null;
  doneAt: string | null;
  total: number;
  approved: number;
  rejected: number;
  asked: number;
}

export interface ReviewItemHrDto {
  id: string;
  applicationId: string;
  fullName: string;
  jobTitle: string;
  appliedAt: string;
  matchPercent: number | null;
  status: ApplicationStatus;
  hrPick: ReviewPick;
  hrComment: string | null;
  decision: ReviewDecision | null;
  reviewerComment: string | null;
  decidedAt: string | null;
  hrReply: string | null;
}

export interface ReviewEventDto {
  kind: ReviewEventKind;
  actor: string;
  /** null when the application was deleted since. */
  applicationName: string | null;
  decision: ReviewDecision | null;
  detail: string | null;
  at: string;
}

export interface ReviewBatchDto extends ReviewBatchRowDto {
  /** Secret part of the reviewer's link: /duyet/<token>. */
  token: string;
  senderName: string;
  message: string | null;
  expiresAt: string;
  createdBy: string;
  items: ReviewItemHrDto[];
  /** Newest first. */
  events: ReviewEventDto[];
}

/** An application that is already waiting in another open batch (one open review at a time). */
export interface ReviewConflictDto {
  applicationId: string;
  fullName: string;
  batchTitle: string;
}

const text = (min: number, max: number, field: string) =>
  z
    .string()
    .trim()
    .min(min, `Nhập ${field}.`)
    .max(max, `${field[0]?.toUpperCase()}${field.slice(1)} tối đa ${max} ký tự.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const reviewItemInputSchema = z.object({
  applicationId: z.uuid('Hồ sơ không hợp lệ.'),
  hrPick: z.enum(['yes', 'maybe']).default('maybe'),
  hrComment: optionalText(REVIEW_TEXT_MAX),
});

const itemList = z
  .array(reviewItemInputSchema)
  .min(1, 'Chọn ít nhất 1 ứng viên.')
  .max(REVIEW_MAX_ITEMS, `Mỗi đợt tối đa ${REVIEW_MAX_ITEMS} ứng viên.`)
  .refine((items) => new Set(items.map((i) => i.applicationId)).size === items.length, 'Có ứng viên bị chọn trùng.');

const respondBy = z.iso.datetime({ offset: true, message: 'Chọn hạn phản hồi.' });

export const reviewCreateSchema = z.object({
  title: text(2, REVIEW_TITLE_MAX, 'tiêu đề'),
  senderName: text(2, REVIEW_NAME_MAX, 'người gửi'),
  reviewerName: text(2, REVIEW_NAME_MAX, 'người duyệt'),
  message: optionalText(REVIEW_TEXT_MAX),
  respondBy,
  items: itemList,
});
export type ReviewCreateInput = z.input<typeof reviewCreateSchema>;

export const reviewAddSchema = z.object({ items: itemList });
export const reviewExtendSchema = z.object({ respondBy });
export const reviewReplySchema = z.object({ reply: text(1, REVIEW_TEXT_MAX, 'câu trả lời') });

/** The reviewer's choice; null clears it. Declining or asking needs a reason HR can act on. */
export const reviewDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'ask']).nullable(),
    comment: optionalText(REVIEW_TEXT_MAX),
  })
  .superRefine((v, ctx) => {
    if ((v.decision === 'reject' || v.decision === 'ask') && (v.comment ?? '').length < 2) {
      const message = v.decision === 'reject' ? 'Ghi lý do không phỏng vấn.' : 'Ghi điều anh/chị cần HR hỏi thêm.';
      ctx.addIssue({ code: 'custom', path: ['comment'], message });
    }
  });
export type ReviewDecisionInput = z.input<typeof reviewDecisionSchema>;
