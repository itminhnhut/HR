/**
 * Internal shapes: a requirement line is parsed into one or more measurable atoms, each judged on its own.
 */
import type { FieldSpec } from './fields.js';
import type { MatchVerdict } from './types.js';

/** THPT < Trung cấp < Cao đẳng < Đại học < Thạc sĩ < Tiến sĩ. */
export type EduLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type LanguageName = 'english' | 'japanese' | 'chinese' | 'korean' | 'french' | 'german';
export type LanguageTest = 'toeic' | 'ielts' | 'toefl' | 'jlpt' | 'hsk' | 'topik';

export interface ExperienceAtom {
  kind: 'experience';
  minMonths: number;
  /** null = any work; 'related' = "vị trí tương đương" (cannot be checked); otherwise a named field. */
  field: FieldSpec | 'related' | null;
}

export interface EducationAtom {
  kind: 'education';
  minLevel: EduLevel | null;
  /** Folded major phrases ("ke toan", "tai chinh"); empty when none. */
  majors: string[];
  /** The same majors as HR wrote them, for reasons. */
  majorLabels: string[];
  majorRelatedOnly: boolean;
}

export interface LanguageAtom {
  kind: 'language';
  language: LanguageName;
  test: LanguageTest | null;
  minScore: number | null;
  /** 1 cơ bản, 2 đọc hiểu, 3 giao tiếp, 4 thành thạo; null = just "tiếng Anh". */
  minLevel: number | null;
}

export interface KeywordAtom {
  kind: 'keywords';
  groupIds: string[];
  mode: 'all' | 'any';
}

export interface LicenseAtom {
  kind: 'license';
  /** Folded class ("b2", "c", "a1"); null = any licence of the given vehicle. */
  licenseClass: string | null;
  vehicle: 'car' | 'motorbike' | 'any';
}

/** "Có thể đi làm ngay": judged from an availability / notice-period statement in the CV. */
export interface AvailabilityAtom {
  kind: 'availability';
}

/** A tool or certificate missing from the dictionary, searched word for word ("KiotViet", "chứng chỉ xe nâng"). */
export interface LiteralAtom {
  kind: 'literal';
  /** Folded search term. */
  term: string;
  /** The same words as HR wrote them. */
  label: string;
}

export type Atom =
  ExperienceAtom | EducationAtom | LanguageAtom | KeywordAtom | LicenseAtom | AvailabilityAtom | LiteralAtom;

export interface ParsedRequirement {
  atoms: Atom[];
  /** Set when the line is trivially satisfied ("Kinh nghiệm: Không yêu cầu"). */
  trivialReason: string | null;
  /** Set when nothing measurable was found (soft skill, preference, vague wording). */
  unknownReason: string | null;
  /** "Ưu tiên …" / "… là lợi thế": shown as met when the CV has it, otherwise unknown (never unmet). */
  preference: boolean;
  /** Soft part next to measurable atoms ("…, chịu áp lực tốt"), mentioned in the reason. */
  softNote: string | null;
}

export interface AtomResult {
  verdict: MatchVerdict;
  evidence: string | null;
  reason: string;
}

export function result(verdict: MatchVerdict, reason: string, evidence: string | null = null): AtomResult {
  return { verdict, reason, evidence };
}
