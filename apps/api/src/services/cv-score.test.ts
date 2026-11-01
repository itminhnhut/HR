import { describe, expect, it } from 'vitest';
import { requirementLines } from './cv-score.js';

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
