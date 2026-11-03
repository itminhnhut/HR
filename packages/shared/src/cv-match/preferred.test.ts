import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';

const TODAY = '2026-11-03';
const CV = [
  'Nguyễn Văn A',
  'Kinh nghiệm làm việc',
  'Công ty ABC (01/2020 - 12/2024) Kế toán tổng hợp',
  '- Hạch toán trên phần mềm MISA, lập báo cáo bằng Excel',
  'Kỹ năng',
  'Excel, Word',
].join('\n');

const score = (preferred: string[], requirements: string[] = []) =>
  scoreCv({ cvText: CV, requirements, preferred, today: TODAY });

describe('bonus lines of the job', () => {
  it('should list a bonus the CV shows, as HR wrote it, with the CV quote', () => {
    const { items } = score(['Biết sử dụng MISA']);

    expect(items[0]).toMatchObject({
      requirement: 'Biết sử dụng MISA',
      section: 'preferred',
      verdict: 'met',
      counted: false,
    });
    expect(items[0]?.evidence).toContain('MISA');
  });

  it('should leave a bonus the CV does not show open, never unmet', () => {
    const { items } = score(['Biết sử dụng SAP']);

    expect(items[0]).toMatchObject({ section: 'preferred', verdict: 'unknown', counted: false });
  });

  it('should keep the percent on the requirements alone, whether the bonus is shown or not', () => {
    const requirements = ['Biết Excel', 'Biết Photoshop'];

    expect(score([], requirements).percent).toBe(50);
    expect(score(['Biết sử dụng MISA', 'Biết sử dụng SAP'], requirements).percent).toBe(50);
  });

  it('should mark an "ưu tiên" line written among the requirements as a bonus too', () => {
    const { items } = scoreCv({ cvText: CV, requirements: ['Ưu tiên biết MISA'], today: TODAY });

    expect(items[0]).toMatchObject({ section: 'preferred', verdict: 'met', counted: false });
  });

  it('should leave bonuses open with the reason when the CV has no readable text', () => {
    const { items } = scoreCv({ cvText: '', requirements: [], preferred: ['Biết SAP'], today: TODAY });

    expect(items[0]).toMatchObject({ section: 'preferred', verdict: 'unknown' });
    expect(items[0]?.reason).toContain('Không đọc được');
  });
});
