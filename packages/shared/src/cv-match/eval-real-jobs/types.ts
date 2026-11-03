/**
 * Shapes of the real-job evaluation. Every CV in this directory is synthetic: fictional people, written for this test.
 *
 * Labelling protocol, fixed before the scorer was ever run on these CVs. A label is what a careful recruiter
 * concludes from the CV and the ad line, never what the bot says:
 *
 * - met: the CV shows it.
 * - unmet: the CV shows it is not met, or a measurable item is absent from a CV that does list such things
 *   (same convention as ../fixtures, e.g. c23: Figma absent → unmet).
 * - unknown: cannot be judged from a CV: soft skills, a bonus the CV does not show (a bonus is never held against
 *   a candidate), education when the CV has no education information at all (../fixtures c30).
 * - ambiguous: careful recruiters could go either way. Excluded from accuracy, reported separately.
 *
 * Rules used for recurring cases:
 * R1 "Kinh nghiệm: 1 năm" (form field, names no trade): 12+ months in the same or a neighbouring professional
 *    occupation → met; under 12 months of work in total → unmet; 12+ months only in an occupation that has nothing
 *    to do with the ad → ambiguous (met if read literally, unmet if read in the context of the ad).
 * R2 Keyword stuffing: a domain claim found only in a list or summary, contradicted or unsupported by the work
 *    history and education → unmet. A generic office tool or a language claim that nothing contradicts → ambiguous.
 * R3 A line with several mandatory parts is met only when every part is shown. A core part missing → unmet.
 * R4 Not graduated yet → unmet on education lines.
 * R5 "Reads English" lines: a CV written entirely in English shows it. "Speaks well" lines need a stated level or
 *    score; an English-written CV with no statement → unknown.
 * R6 Bonus part of a line ("là lợi thế", "là ưu tiên") does not decide a mandatory part sharing that line.
 */

export type Label = 'met' | 'unmet' | 'unknown' | 'ambiguous';

/** Recruiter's decision for the whole CV. */
export type Tier = 'interview' | 'maybe' | 'no';

export type CvKind = 'strong' | 'partial' | 'non-fit' | 'near-miss' | 'wrong-domain' | 'stuffing';

export type CvForm = 'vi' | 'en' | 'no-diacritics' | 'messy-pdf';

export interface LabelledCv<K extends string = string> {
  id: string;
  kind: CvKind;
  form: CvForm;
  tier: Tier;
  /** Set when recruiters could disagree on the tier: left out of tier separation, reported on its own. */
  tierDebatable?: string;
  labels: Record<K, Label>;
  /** Reasons for non-obvious labels, required by convention for every "ambiguous". */
  why?: Partial<Record<K, string>>;
  /** Plain text as PDF extraction would give it. */
  text: string;
}

export type LineClass = 'experience' | 'education' | 'language' | 'skill' | 'soft';

/** What a requirement line actually asks, written by reading the ad. */
export interface LineTruth {
  key: string;
  line: string;
  classes: readonly LineClass[];
  /** none: mandatory. whole: the whole line is a bonus. part: mandatory part plus a bonus part. */
  bonus: 'none' | 'whole' | 'part';
  minMonths?: number;
  /** Work descriptions (folded) that must, and must not, count as the field the line names. */
  fieldCounts?: readonly string[];
  fieldDoesNotCount?: readonly string[];
  /** 1 THPT, 2 Trung cấp, 3 Cao đẳng, 4 Đại học. */
  minEducationLevel?: number;
  /** Folded majors the line names. */
  majors?: readonly string[];
  relatedMajorsAccepted?: boolean;
  /** 1 cơ bản, 2 đọc hiểu, 3 giao tiếp, 4 thành thạo. */
  minEnglishLevel?: number;
  /** Folded skills or knowledge items the line demands. */
  skills?: readonly string[];
  /** Folded skills only wanted as a bonus; they must not decide the line. */
  bonusSkills?: readonly string[];
}

export interface JobEval<K extends string = string> {
  slug: string;
  short: string;
  /** One key per scored requirement line, in the order production feeds them. */
  keys: readonly K[];
  cvs: readonly LabelledCv<K>[];
}
