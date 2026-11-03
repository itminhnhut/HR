/**
 * Step 1: does the parser understand each real requirement line of the 4 open jobs? A misread line makes every CV
 * wrong on that line, so a misreading stays here as a plain failing case. Lines come from the saved job JSON, in the
 * shape production scores them.
 */
import { describe, expect, it } from 'vitest';
import { loadJob, scoredLines } from './job-lines.js';
import { isFolded, readLine } from './line-reading.js';
import { LINE_TRUTH } from './line-truth.js';

const SLUGS = Object.keys(LINE_TRUTH);

describe('real job fixtures', () => {
  it.each(SLUGS)('should feed %s the lines the truth table was written for, in order', (slug) => {
    // Arrange
    const truth = LINE_TRUTH[slug] ?? [];

    // Act
    const lines = scoredLines(loadJob(slug));

    // Assert
    expect(lines).toEqual(truth.map((t) => t.line));
  });

  it('should keep every term of the truth tables in folded form', () => {
    // Arrange
    const terms = Object.values(LINE_TRUTH).flatMap((table) =>
      table.flatMap((t) => [...(t.majors ?? []), ...(t.skills ?? []), ...(t.bonusSkills ?? [])]),
    );

    // Act
    const notFolded = terms.filter((term) => !isFolded(term));

    // Assert
    expect(notFolded).toEqual([]);
  });
});

for (const slug of SLUGS) {
  describe(`how ${slug} is understood`, () => {
    for (const truth of LINE_TRUTH[slug] ?? []) {
      it(`should read "${truth.line}" as ${truth.classes.join(' + ')}${truth.bonus === 'none' ? '' : ` (bonus: ${truth.bonus})`}`, () => {
        // Act
        const { findings } = readLine(truth);

        // Assert
        expect(findings.map((f) => `[${f.severity}] ${f.aspect}: ${f.detail}`)).toEqual([]);
      });
    }
  });
}
