/**
 * Contract of the CV matcher (see spec-cv-match.md). The scorer is pure: text in, verdicts out, no I/O.
 */

/** met = the CV shows it; unmet = the CV shows it is not met (or a measurable item is clearly absent);
 *  unknown = cannot be judged from a CV (soft skills, vague wording) or the CV has no usable text. */
export type MatchVerdict = 'met' | 'unmet' | 'unknown';

export interface MatchItem {
  /** The requirement line as HR wrote it. */
  requirement: string;
  verdict: MatchVerdict;
  /** Short quote from the CV supporting a "met" (or the closest thing for "unmet"), max ~160 chars. */
  evidence: string | null;
  /** Vietnamese explanation for HR, e.g. "CV ghi 1 năm, yêu cầu từ 2 năm". */
  reason: string | null;
  /**
   * Whether the line takes part in the percent. False for soft lines, bonuses, lines CVs do not normally state and a
   * line repeating another (education asked twice). Absent on results stored before version 2.
   */
  counted?: boolean;
  /**
   * The parser could not read the line, but its words are in the CV's work or study lines: left unknown with the quote
   * for HR to check, since only 64% of these were right on the blind set. Never counted in the percent.
   */
  isHint?: boolean;
  /**
   * "duties" for a "Mô tả công việc" line and "preferred" for a bonus ("Ưu tiên"), neither ever counted; absent means a
   * "Yêu cầu" line.
   */
  section?: 'duties' | 'preferred';
}

export interface CvMatchResult {
  /**
   * round(100 * met / counted lines): a counted line left unknown lowers it. null when fewer than half of the counted
   * lines could be judged ("chưa đủ dữ liệu"), or there is nothing to count.
   */
  percent: number | null;
  items: MatchItem[];
  /** Bumped whenever scoring rules change, so stored results can be recomputed. */
  version: number;
}

export interface ScoreInput {
  /** Plain text extracted from the CV (PDF text layer). May be empty for scanned CVs. */
  cvText: string;
  /** Requirement lines: the job's "Yêu cầu" lines plus e.g. "Kinh nghiệm: Từ 2 năm", "Học vấn: Đại học trở lên". */
  requirements: string[];
  /** The job's "Mô tả công việc" lines, shown after the requirements and left out of the percent. */
  duties?: string[];
  /** The job's "Ưu tiên" lines: a bonus the CV shows is listed, one it does not show costs nothing. */
  preferred?: string[];
  /** "Today" in Vietnam (YYYY-MM-DD), to resolve "nay"/"hiện tại" in date ranges. */
  today: string;
}

/**
 * One labelled test case (fixtures/*.json). `expected[i]` is the human verdict for `requirements[i]`.
 */
export interface CvMatchCase {
  id: string;
  /** What this case exercises (e.g. "overlapping date ranges", "English CV", "scanned, no text"). */
  notes: string;
  cvText: string;
  requirements: string[];
  expected: MatchVerdict[];
  today: string;
}
