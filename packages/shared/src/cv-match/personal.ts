/**
 * What a CV itself says of the candidate's gender and birth date. Never guessed from a name, and nowhere near the score.
 * HR reads them next to the rest of the profile; they are no filter and no reason to turn anyone down.
 */
import { cleanLine, buildCvDoc, foldClean } from './normalize.js';

export type CvGender = 'male' | 'female';

export interface PersonalFacts {
  gender: CvGender | null;
  /** "2002-12-14", or "2002" when the CV gives only the year. */
  birth: string | null;
}

const GENDER_LABEL = /\b(?:gioi tinh|gender|sex)\b\s*[:\-–]?\s*/;
const GENDER_VALUE = /^(nam|nu|male|female)\b(?!\s*\/)/;
const BIRTH_LABEL =
  /\b(?:ngay thang nam sinh|ngay sinh|nam sinh|sinh ngay|sinh nam|date of birth|birth ?date|dob|d\.o\.b\.?|born)\b\s*[:\-–]?\s*/;
const FULL_DATE = /(?<!\d)(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*((?:19|20)\d{2})(?!\d)/;
const ONLY_YEAR = /^((?:19|20)\d{2})(?!\d)/;
const LONE_DATE = /^\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*(?:19|20)\d{2}$/;

/** A date on a line of its own counts as the birth date only at an age somebody applies for a job. */
const MIN_AGE = 16;
const MAX_AGE = 65;

const pad = (n: string) => n.padStart(2, '0');

function dateIn(text: string): string | null {
  const full = FULL_DATE.exec(text);
  if (full) {
    const [, day = '', month = '', year = ''] = full;
    const isReal = Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31;
    return isReal ? `${year}-${pad(month)}-${pad(day)}` : null;
  }
  return ONLY_YEAR.exec(text.trim())?.[1] ?? null;
}

/** What follows the label, on its line or, when the design split them, on the next one. */
function afterLabel(lines: readonly string[], label: RegExp): string[] {
  return lines.flatMap((line, i) => {
    const found = label.exec(line);
    if (!found) return [];
    const rest = line.slice(found.index + found[0].length).trim();
    return rest ? [rest] : [lines[i + 1] ?? ''];
  });
}

function genderIn(lines: readonly string[]): CvGender | null {
  for (const value of afterLabel(lines, GENDER_LABEL)) {
    const word = GENDER_VALUE.exec(value)?.[1];
    if (word === 'nam' || word === 'male') return 'male';
    if (word === 'nu' || word === 'female') return 'female';
  }
  return null;
}

/** Whole years on `today` ("YYYY-MM-DD"); by the year alone when the CV gives no day. */
export function ageOf(birth: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return birth.length > 4 && today.slice(5) < birth.slice(5) ? years - 1 : years;
}

function birthIn(lines: readonly string[], today: string): string | null {
  for (const value of afterLabel(lines, BIRTH_LABEL)) {
    const birth = dateIn(value);
    if (birth) return birth;
  }
  for (const line of lines) {
    const birth = LONE_DATE.test(line) ? dateIn(line) : null;
    if (birth && ageOf(birth, today) >= MIN_AGE && ageOf(birth, today) <= MAX_AGE) return birth;
  }
  return null;
}

export function readPersonalFacts(cvText: string, today: string): PersonalFacts {
  const lines = buildCvDoc(cvText).lines.map((line) => foldClean(cleanLine(line.text)));
  return { gender: genderIn(lines), birth: birthIn(lines, today) };
}
