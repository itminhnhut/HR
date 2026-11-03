/** Shape of the skill / tool / certificate dictionary (see keywords.ts). */
export type GroupKind = 'tool' | 'skill' | 'cert' | 'asset' | 'trade';

export interface KeywordGroup {
  id: string;
  label: string;
  kind: GroupKind;
  /** Terms recognised in both requirement and CV. */
  terms: string[];
  /** Extra terms recognised only in requirements (too ambiguous inside a CV, e.g. "ts"). */
  reqOnly?: string[];
  /** Any one of these groups satisfies this one (and is dropped from a requirement naming both). */
  covers?: string[];
  /** All of these groups together satisfy this one. */
  allOf?: string[];
  /** Groups only listed as examples next to this one in a requirement ("Office (Word, Excel, PowerPoint)"). */
  examples?: string[];
  /** Case-sensitive short forms accepted only in a skills list ("JS", "PS"). */
  abbrev?: string[];
  /** The abbreviation is only trusted when the same line also matches this (folded). */
  abbrevNeeds?: RegExp;
  /** Occupation the term belongs to, for checking a claim against the work history (see `kind: 'trade'`). */
  family?: string;
}
