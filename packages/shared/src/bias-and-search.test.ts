import { describe, expect, it } from 'vitest';
import { candidateStage, findBiasTerm, foldVietnamese, matchesQuery } from './format.js';
import { effectiveStatus, extendTarget } from './job-status.js';

describe('findBiasTerm', () => {
  it('flags gender, age and looks', () => {
    expect(findBiasTerm('Ưu tiên nữ, dưới 30 tuổi')).toBe('ưu tiên nữ');
    expect(findBiasTerm('Ngoại hình ưa nhìn')).toBe('ngoại hình');
    expect(findBiasTerm('Chưa lập gia đình')).toBe('chưa lập gia đình');
  });
  it('does not flag look-alike words', () => {
    expect(findBiasTerm('Làm việc tại Việt Nam')).toBeNull();
    expect(findBiasTerm('Nói thêm nữa về công việc')).toBeNull();
    expect(findBiasTerm('Từ 1 năm kinh nghiệm')).toBeNull();
  });
});

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
});

describe('BR-18/BR-19', () => {
  const now = new Date('2026-10-23T03:00:00Z');
  it('paused job past its deadline is expired', () => {
    expect(effectiveStatus({ state: 'paused', deadline: '2026-10-01' }, now)).toBe('expired');
    expect(effectiveStatus({ state: 'paused', deadline: '2026-11-20' }, now)).toBe('paused');
  });
  it('extension is capped at 60 days after publishing', () => {
    expect(extendTarget('2026-10-26', '2026-10-01', now)).toBe('2026-11-09');
    expect(extendTarget('2026-11-25', '2026-10-01', now)).toBe('2026-11-30');
    expect(extendTarget('2026-11-30', '2026-10-01', now)).toBeNull();
  });
});
