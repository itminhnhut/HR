/**
 * Step 3: does the percent shown to HR order CVs the way a recruiter would? Tiers exclude CVs marked debatable.
 * "Should not" above "should interview" is a hard rule. "Should not" above "maybe" has a ceiling: a maybe CV can fairly
 * be weak on paper. Synthetic CVs, tuned on: these numbers are not a real-world accuracy figure.
 */
import { describe, expect, it } from 'vitest';
import { ALL_JOBS } from './all-jobs.js';
import { pairStats, scoreJob, tierPercents } from './metrics.js';

/** "Green" in apps/web/src/pages/hr/applicants/CvMatch.tsx, percentTone. */
const GREEN_FROM = 80;
/** Red below this in the same function. */
const RED_BELOW = 50;
/** At what the scorer reaches over all the "maybe" / "should not" pairs of the 4 ads. */
const CEILING_MAYBE_INVERSIONS = 8;

for (const evaluation of ALL_JOBS) {
  describe(`tier separation on ${evaluation.slug}`, () => {
    const scored = scoreJob(evaluation);
    const interview = tierPercents(scored, 'interview');
    const maybe = tierPercents(scored, 'maybe');
    const no = tierPercents(scored, 'no');

    it('should cover all three tiers', () => {
      // Assert
      expect(interview.length).toBeGreaterThan(0);
      expect(maybe.length).toBeGreaterThan(0);
      expect(no.length).toBeGreaterThan(0);
    });

    it('should never rank a "should not" CV above a "should interview" CV', () => {
      // Act
      const stats = pairStats(interview, no);

      // Assert
      expect(stats.worst, `${stats.inverted}/${stats.pairs} pairs inverted`).toEqual([]);
    });

    it('should put no "should not" CV in the green band', () => {
      // Act
      const green = no.filter((v) => v.percent >= GREEN_FROM);

      // Assert
      expect(green).toEqual([]);
    });

    it('should put no "should interview" CV in the red band', () => {
      // Act
      const red = interview.filter((v) => v.percent < RED_BELOW);

      // Assert
      expect(red).toEqual([]);
    });

    it('should score keyword-stuffed CVs below every "should interview" CV', () => {
      // Arrange
      const stuffed = scored.cvs.filter((c) => c.cv.kind === 'stuffing');
      const lowestInterview = Math.min(...interview.map((v) => v.percent));

      // Act
      const beating = stuffed
        .filter((c) => (c.percent ?? 0) >= lowestInterview)
        .map((c) => `${c.cv.id}: ${c.percent}%`);

      // Assert
      expect(stuffed.length).toBeGreaterThan(0);
      expect(beating, `lowest "should interview" is ${lowestInterview}%`).toEqual([]);
    });

    it('should keep keyword-stuffed CVs out of the green band', () => {
      // Act
      const green = scored.cvs
        .filter((c) => c.cv.kind === 'stuffing' && (c.percent ?? 0) >= GREEN_FROM)
        .map((c) => `${c.cv.id}: ${c.percent}%`);

      // Assert
      expect(green).toEqual([]);
    });
  });
}

describe('tier separation over all the ads', () => {
  it('should keep "should not" CVs above "maybe" CVs under the ceiling', () => {
    // Arrange
    const scored = ALL_JOBS.map(scoreJob);

    // Act
    const inverted = scored.reduce((sum, job) => {
      const stats = pairStats(tierPercents(job, 'maybe'), tierPercents(job, 'no'));
      return sum + stats.inverted;
    }, 0);

    // Assert
    expect(inverted).toBeLessThanOrEqual(CEILING_MAYBE_INVERSIONS);
  });
});
