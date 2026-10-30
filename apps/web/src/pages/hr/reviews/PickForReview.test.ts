import { describe, expect, it } from 'vitest';
import { canSendForReview } from './PickForReview';

describe('who can be sent to the reviewer', () => {
  it('should allow new and seen applications that are not waiting for a reviewer', () => {
    expect(canSendForReview({ status: 'new', review: null })).toBe(true);
    expect(canSendForReview({ status: 'seen', review: 'reject' })).toBe(true);
  });

  it('should not allow applications already waiting, invited or declined', () => {
    expect(canSendForReview({ status: 'seen', review: 'waiting' })).toBe(false);
    expect(canSendForReview({ status: 'seen', review: 'ask' })).toBe(false);
    expect(canSendForReview({ status: 'interview', review: null })).toBe(false);
    expect(canSendForReview({ status: 'rejected', review: null })).toBe(false);
  });
});
