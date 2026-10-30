import { describe, expect, it } from 'vitest';
import { reviewCreateSchema, reviewDecisionSchema, REVIEW_MAX_ITEMS } from './reviews.js';
import { applicationUpdateSchema } from './validation.js';

const ID = '11111111-1111-4111-8111-111111111111';
const valid = {
  title: 'Duyệt ứng viên · Kinh doanh B2B',
  senderName: 'Ngọc Anh (Phòng Nhân sự)',
  reviewerName: 'anh Minh',
  respondBy: '2026-11-02T10:00:00+07:00',
  items: [{ applicationId: ID, hrPick: 'yes', hrComment: '  Nói chuyện tốt  ' }],
};

describe('reviewCreateSchema', () => {
  it('should accept a batch HR filled in and tidy its text', () => {
    // Act
    const parsed = reviewCreateSchema.parse({ ...valid, message: '  ' });

    // Assert
    expect(parsed.items[0]?.hrComment).toBe('Nói chuyện tốt');
    expect(parsed.message).toBeNull();
  });

  it('should treat an application without a pick as "cân nhắc"', () => {
    const parsed = reviewCreateSchema.parse({ ...valid, items: [{ applicationId: ID }] });
    expect(parsed.items[0]?.hrPick).toBe('maybe');
  });

  it('should ask for the title, sender, reviewer and reply-by time', () => {
    const result = reviewCreateSchema.safeParse({ items: valid.items });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['title', 'senderName', 'reviewerName', 'respondBy']));
  });

  it('should refuse an empty batch, a batch over the limit and the same application twice', () => {
    expect(reviewCreateSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    const many = Array.from({ length: REVIEW_MAX_ITEMS + 1 }, (_, i) => ({
      applicationId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
    }));
    expect(reviewCreateSchema.safeParse({ ...valid, items: many }).success).toBe(false);
    expect(
      reviewCreateSchema.safeParse({ ...valid, items: [{ applicationId: ID }, { applicationId: ID }] }).success,
    ).toBe(false);
  });
});

describe('reviewDecisionSchema', () => {
  it('should let the reviewer approve without a comment', () => {
    expect(reviewDecisionSchema.parse({ decision: 'approve' })).toEqual({ decision: 'approve', comment: null });
  });

  it.each(['reject', 'ask'] as const)('should need a reason to %s', (decision) => {
    const result = reviewDecisionSchema.safeParse({ decision, comment: ' ' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['comment']);
  });

  it('should let the reviewer clear a decision', () => {
    expect(reviewDecisionSchema.parse({ decision: null }).decision).toBeNull();
  });
});

describe('applicationUpdateSchema reviewBypassReason', () => {
  it('should need a real reason to invite before the reviewer approved', () => {
    expect(applicationUpdateSchema.safeParse({ status: 'interview', reviewBypassReason: 'gấp' }).success).toBe(false);
    expect(
      applicationUpdateSchema.parse({ status: 'interview', reviewBypassReason: ' Ứng viên chỉ rảnh hôm nay ' })
        .reviewBypassReason,
    ).toBe('Ứng viên chỉ rảnh hôm nay');
  });
});
