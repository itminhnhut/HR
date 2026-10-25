import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { MatchItem } from './types.js';

const TODAY = '2026-10-25';

/** Scores one requirement line against a CV text. */
function judge(cvText: string, requirement: string, today = TODAY): MatchItem {
  return scoreCv({ cvText, requirements: [requirement], today }).items[0];
}

/** A CV with a header block, so short bodies stay above the "no readable text" threshold. */
function cv(...lines: string[]): string {
  return ['Nguyễn Văn An', 'Email: an.nguyen@example.com - Điện thoại: 0912 345 678', ...lines].join('\n');
}

describe('skill and tool requirement', () => {
  it('should be met when the tool appears, ignoring case and tones', () => {
    const item = judge(cv('KỸ NĂNG', '- Sử dụng thành thạo MS EXCEL (Pivot, Vlookup)'), 'Thành thạo Excel');
    expect(item.verdict).toBe('met');
    expect(item.evidence).toContain('MS EXCEL');
  });

  it('should accept a synonym (Google Sheets for "bảng tính")', () => {
    expect(judge(cv('KỸ NĂNG', 'Google Sheets, Google Docs'), 'Sử dụng bảng tính').verdict).toBe('met');
  });

  it('should require every item on a multi-item line and name the missing one', () => {
    const item = judge(cv('KỸ NĂNG', 'Excel nâng cao'), 'Thành thạo Excel, Word');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('Word');
  });

  it('should accept Word plus Excel for "tin học văn phòng"', () => {
    expect(judge(cv('KỸ NĂNG', 'Word, Excel, PowerPoint'), 'Thành thạo tin học văn phòng').verdict).toBe('met');
  });

  it('should accept any CRM tool for "CRM"', () => {
    expect(judge(cv('KỸ NĂNG', 'Quản lý khách hàng trên HubSpot'), 'Biết sử dụng CRM').verdict).toBe('met');
  });

  it('should not accept a different specific CRM', () => {
    expect(judge(cv('KỸ NĂNG', 'HubSpot'), 'Sử dụng Salesforce').verdict).toBe('unmet');
  });

  it('should accept react.js for ReactJS and either of an "hoặc" pair', () => {
    expect(judge(cv('SKILLS', 'React.js, Node.js'), 'ReactJS').verdict).toBe('met');
    expect(judge(cv('SKILLS', 'Vue.js'), 'ReactJS hoặc VueJS').verdict).toBe('met');
  });

  it('should not take React Native as React', () => {
    expect(judge(cv('SKILLS', 'React Native, Firebase'), 'ReactJS').verdict).toBe('unmet');
  });

  it('should not match a word inside another word', () => {
    expect(judge(cv('KỸ NĂNG', 'Excellent communication, keyword research'), 'Excel').verdict).toBe('unmet');
  });

  it('should be unmet with evidence when the CV negates the skill', () => {
    const item = judge(cv('KỸ NĂNG', 'Chưa biết Photoshop, đang tự học Canva'), 'Biết Photoshop');
    expect(item.verdict).toBe('unmet');
    expect(item.evidence).toContain('Chưa biết Photoshop');
  });

  it('should not let a negation reach past a comma', () => {
    expect(judge(cv('KỸ NĂNG', 'Chưa biết Photoshop, thành thạo Excel'), 'Excel').verdict).toBe('met');
  });

  it('should not count a skill listed only as a wish to learn', () => {
    expect(judge(cv('MỤC TIÊU', 'Mong muốn học thêm Figma và Photoshop'), 'Sử dụng Figma').verdict).toBe('unmet');
  });

  it('should not count a skill listed only under hobbies', () => {
    expect(judge(cv('SỞ THÍCH', 'Chỉnh ảnh Photoshop, du lịch'), 'Photoshop').verdict).toBe('unmet');
  });

  it('should be unknown when the skill is only in the career objective', () => {
    expect(
      judge(cv('MỤC TIÊU NGHỀ NGHIỆP', 'Trở thành chuyên gia SEO trong 3 năm tới'), 'Có kiến thức SEO').verdict,
    ).toBe('unknown');
  });

  it('should not count a keyword that is part of a company name', () => {
    expect(
      judge(cv('KINH NGHIỆM', 'Lễ tân - Công ty TNHH Excel Việt Nam, 2020 - 2022'), 'Thành thạo Excel').verdict,
    ).toBe('unmet');
  });

  it('should be unknown, not unmet, when an asset such as a motorbike is not mentioned', () => {
    expect(judge(cv('KỸ NĂNG', 'Giao tiếp tốt'), 'Có xe máy').verdict).toBe('unknown');
  });

  it('should be met when the CV mentions owning a laptop', () => {
    expect(judge(cv('THÔNG TIN KHÁC', 'Có laptop cá nhân, xe máy riêng'), 'Có laptop').verdict).toBe('met');
  });
});

describe('driving licence requirement', () => {
  it('should be met by the same class', () => {
    expect(judge(cv('CHỨNG CHỈ', 'Bằng lái xe hạng B2'), 'Có bằng lái xe B2').verdict).toBe('met');
  });

  it('should be met by a higher class (C covers B2)', () => {
    expect(judge(cv('CHỨNG CHỈ', 'GPLX hạng C'), 'Có bằng lái B2').verdict).toBe('met');
  });

  it('should be unmet by a lower class', () => {
    const item = judge(cv('CHỨNG CHỈ', 'Bằng lái xe B1'), 'Bằng lái B2 trở lên');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('B1');
  });

  it('should be unmet when a car licence is required and none is mentioned', () => {
    expect(judge(cv('KỸ NĂNG', 'Giao tiếp tốt'), 'Có bằng lái xe B2').verdict).toBe('unmet');
  });

  it('should not read an old English certificate "Bằng C tiếng Anh" as a licence', () => {
    expect(judge(cv('CHỨNG CHỈ', 'Bằng C tiếng Anh'), 'Có bằng lái C').verdict).toBe('unmet');
  });
});
