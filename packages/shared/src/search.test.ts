import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUS_LABEL, candidateStage, foldVietnamese, matchesQuery } from './format.js';

describe('search', () => {
  it('folds tones and đ', () => {
    expect(foldVietnamese('Đà Nẵng')).toBe('da nang');
  });
  it('matches without tones, every word required', () => {
    expect(matchesQuery('Nhân viên Kinh doanh B2B', 'kinh doanh')).toBe(true);
    expect(matchesQuery('Nhân viên Kinh doanh B2B', 'kinh react')).toBe(false);
    expect(matchesQuery('anything', '   ')).toBe(true);
  });
});

describe('candidateStage', () => {
  it('never shows rejection wording', () => {
    expect(candidateStage('rejected', false)).toBe('closed');
  });
  it('closes unprocessed applications when the job closes', () => {
    expect(candidateStage('new', true)).toBe('closed');
    expect(candidateStage('interview', true)).toBe('interview');
  });
  it('TC-XL-05: shows "HR đã xem" while HR is still agreeing a time, promising no interview yet', () => {
    expect(candidateStage('scheduling', false)).toBe('seen');
    expect(candidateStage('scheduling', true)).toBe('closed');
  });
});

describe('the status label', () => {
  it('TC-XL-08: names the new status "Chờ xếp lịch"', () => {
    expect(APPLICATION_STATUS_LABEL.scheduling).toBe('Chờ xếp lịch');
  });
});
