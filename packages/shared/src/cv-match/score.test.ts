import { describe, expect, it } from 'vitest';
import { CV_MATCH_VERSION, scoreCv } from './index.js';
import { snippet } from './text-match.js';
import { buildCvDoc } from './normalize.js';
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

const SALES_CV = cv(
  'MỤC TIÊU NGHỀ NGHIỆP',
  'Trở thành trưởng nhóm kinh doanh.',
  'KINH NGHIỆM LÀM VIỆC',
  'Nhân viên kinh doanh – Công ty CP Thép Hòa Phát',
  '03/2021 – nay',
  '- Tư vấn, chốt đơn, quản lý khách hàng trên CRM Bitrix24',
  'HỌC VẤN',
  'Đại học Thương mại (2016 – 2020) – Chuyên ngành Marketing',
  'KỸ NĂNG',
  'Excel, Word, PowerPoint; tiếng Anh giao tiếp (TOEIC 620)',
  'SỞ THÍCH',
  'Bóng đá, Photoshop',
);

describe('scoreCv', () => {
  it('should judge every requirement in order and compute the percentage over judged items', () => {
    // Arrange
    const requirements = [
      'Kinh nghiệm: Từ 2 năm',
      'Học vấn: Cao đẳng trở lên',
      'Thành thạo Excel, Word',
      'Sử dụng CRM',
      'Biết Photoshop',
      'Chủ động, chịu áp lực tốt',
    ];
    // Act
    const res = scoreCv({ cvText: SALES_CV, requirements, today: TODAY });
    // Assert
    expect(res.items.map((i) => i.verdict)).toEqual(['met', 'met', 'met', 'met', 'unmet', 'unknown']);
    expect(res.items.map((i) => i.requirement)).toEqual(requirements);
    expect(res.percent).toBe(80);
    expect(res.version).toBe(CV_MATCH_VERSION);
  });

  it('should mark every item unknown with percent null when the CV has no readable text', () => {
    const res = scoreCv({ cvText: '  \n\f  ', requirements: ['Từ 2 năm kinh nghiệm', 'Excel'], today: TODAY });
    expect(res.percent).toBeNull();
    expect(res.items.every((i) => i.verdict === 'unknown')).toBe(true);
    expect(res.items[0].reason).toContain('Không đọc được chữ trong CV');
  });

  it('should treat a very short text (a Drive link) as unreadable', () => {
    const res = scoreCv({ cvText: 'https://drive.google.com/abc', requirements: ['Excel'], today: TODAY });
    expect(res.items[0].verdict).toBe('unknown');
  });

  it('should return percent null when only soft skills are asked', () => {
    const res = scoreCv({ cvText: SALES_CV, requirements: ['Trung thực, cẩn thận', 'Nhiệt tình'], today: TODAY });
    expect(res.percent).toBeNull();
  });

  it('should return no items for no requirements', () => {
    expect(scoreCv({ cvText: SALES_CV, requirements: [], today: TODAY })).toEqual({
      percent: null,
      items: [],
      version: CV_MATCH_VERSION,
    });
  });

  it('should make a line with an unmet part unmet even if another part is met', () => {
    const item = judge(SALES_CV, 'Tốt nghiệp Đại học, có bằng lái xe B2');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('B2');
  });

  it('should keep the measurable verdict and mention the soft part', () => {
    const item = judge(SALES_CV, 'Thành thạo Excel, chịu áp lực tốt');
    expect(item.verdict).toBe('met');
    expect(item.reason).toContain('kỹ năng mềm');
  });

  it('should score the same with or without Vietnamese tones and with NFD text', () => {
    // Arrange
    const plain = cv(
      'KINH NGHIEM LAM VIEC',
      'Ke toan vien - Cong ty An Phat',
      '01/2019 - 12/2022',
      'KY NANG',
      'Thanh thao MISA, Excel',
    );
    const nfd = plain.normalize('NFD');
    const requirements = ['Có 3 năm kinh nghiệm kế toán', 'Sử dụng phần mềm kế toán MISA', 'Thành thạo Excel'];
    // Act
    const a = scoreCv({ cvText: plain, requirements, today: TODAY });
    const b = scoreCv({ cvText: nfd, requirements, today: TODAY });
    // Assert
    expect(a.items.map((i) => i.verdict)).toEqual(['met', 'met', 'met']);
    expect(b.items.map((i) => i.verdict)).toEqual(['met', 'met', 'met']);
  });

  it('should keep evidence within 160 characters and quote the original text with tones', () => {
    const long = cv(
      'KỸ NĂNG',
      `${'Phân tích số liệu bán hàng hằng tuần cho ban giám đốc, '.repeat(6)}thành thạo Excel nâng cao.`,
    );
    const item = judge(long, 'Excel');
    expect(item.evidence?.length).toBeLessThanOrEqual(160);
    expect(item.evidence).toContain('Excel');
  });

  it('should be deterministic for the same input', () => {
    const input = { cvText: SALES_CV, requirements: ['Từ 2 năm kinh nghiệm', 'TOEIC 600'], today: TODAY };
    expect(scoreCv(input)).toEqual(scoreCv(input));
  });

  it('should use the given today for "nay"', () => {
    const text = cv('KINH NGHIỆM', 'Nhân viên kho', '01/2024 - nay');
    expect(judge(text, 'Từ 2 năm kinh nghiệm', '2025-06-01').verdict).toBe('unmet');
    expect(judge(text, 'Từ 2 năm kinh nghiệm', '2026-06-01').verdict).toBe('met');
  });
});

describe('snippet', () => {
  it('should return a short line as is, without a leading bullet', () => {
    const [line] = buildCvDoc('- Thành thạo Excel').lines;
    expect(snippet(line)).toBe('Thành thạo Excel');
  });

  it('should centre a long line on the hit and mark cut ends with an ellipsis', () => {
    const text = `${'mở đầu '.repeat(40)}Excel${' kết thúc'.repeat(40)}`;
    const [line] = buildCvDoc(text).lines;
    const start = line.folded.indexOf('excel');
    const quote = snippet(line, { start, end: start + 5 });
    expect(quote.startsWith('…')).toBe(true);
    expect(quote.endsWith('…')).toBe(true);
    expect(quote).toContain('Excel');
    expect(quote.length).toBeLessThanOrEqual(160);
  });
});
