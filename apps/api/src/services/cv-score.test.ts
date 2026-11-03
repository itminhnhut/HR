import { describe, expect, it } from 'vitest';
import { requirementLines, scoreKey } from './cv-score.js';

describe('scoreKey', () => {
  const job = { requirements: 'Biết Excel', experience: null, education: null, preferred: '' };

  it('should change when the job description changes, so the result is scored again', () => {
    const before = scoreKey({ ...job, responsibilities: 'Lập báo cáo' });
    const after = scoreKey({ ...job, responsibilities: 'Lập báo cáo tháng' });

    expect(after).not.toBe(before);
  });

  it('should change when the bonus lines change, so the result is scored again', () => {
    const before = scoreKey({ ...job, responsibilities: '', preferred: 'Biết SAP' });
    const after = scoreKey({ ...job, responsibilities: '', preferred: 'Biết MISA' });

    expect(after).not.toBe(before);
  });

  it('should stay the requirement lines alone for a job without a description', () => {
    expect(scoreKey({ ...job, responsibilities: '' })).toBe('Biết Excel');
  });
});

describe('requirementLines', () => {
  it('should read a job without bullets exactly as before, so stored scores stay valid', () => {
    // Arrange: the key stored before headings existed was every non-empty line, markers stripped.
    const job = { requirements: 'Biết Excel\n\nGiao tiếp tốt\nCó laptop', experience: 'Từ 1 năm', education: null };

    // Act
    const key = requirementLines(job).join('\n');

    // Assert
    expect(key).toBe('Kinh nghiệm: Từ 1 năm\nBiết Excel\nGiao tiếp tốt\nCó laptop');
  });

  it('should leave group headings out of the requirements', () => {
    const job = { requirements: 'Kỹ năng\n- Biết Excel\nTố chất\n- Cẩn thận', experience: null, education: null };

    expect(requirementLines(job)).toEqual(['Biết Excel', 'Cẩn thận']);
  });
});
