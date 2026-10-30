import { z } from 'zod';
import { foldVietnamese } from './format.js';

/**
 * HR's list of application sources (spec-custom-sources.md). Each source has a key that never changes (applications
 * store it, so renaming keeps the statistics in one piece) and a name HR can change.
 */

/** system = "Website", the candidate's own form; builtin = shipped with the site; custom = added by HR. */
export type SourceKind = 'system' | 'builtin' | 'custom';

export interface SourceDto {
  key: string;
  name: string;
  kind: SourceKind;
  /** Not offered for new applications; existing ones keep it. */
  hidden: boolean;
  /** Applications with this source. */
  applications: number;
}

export const WEBSITE_SOURCE = 'website';
export const REFERRAL_SOURCE = 'referral';
export const OTHER_SOURCE = 'other';
export const SOURCE_NAME_MAX = 60;
export const SOURCE_KEY_MAX = 80;
export const SOURCES_MAX = 50;

export const sourceNameSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Tên nguồn cần ít nhất 2 ký tự.')
      .max(SOURCE_NAME_MAX, `Tên nguồn tối đa ${SOURCE_NAME_MAX} ký tự.`),
  );

export const sourceCreateSchema = z.object({ name: sourceNameSchema });
export const sourceUpdateSchema = z
  .object({ name: sourceNameSchema.optional(), hidden: z.boolean().optional() })
  .refine((v) => v.name !== undefined || v.hidden !== undefined, 'Không có gì để đổi.');

/** "LinkedIn", "linkedin" and "LÍNKEDIN" are the same source: compared without case, tones or extra spaces. */
export const sourceNameKey = (name: string) =>
  foldVietnamese(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const sameSourceName = (a: string, b: string) => sourceNameKey(a) === sourceNameKey(b);

/** A key for a new source: its name without tones, "-" between words; taken keys get "-2", "-3"… */
export function sourceKeyFor(name: string, taken: ReadonlySet<string>): string {
  const base =
    sourceNameKey(name)
      .replace(/ /g, '-')
      .slice(0, SOURCE_KEY_MAX - 4) || 'nguon';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Name of a source key, or the key itself when the list does not know it (yet). */
export const sourceName = (sources: readonly Pick<SourceDto, 'key' | 'name'>[], key: string) =>
  sources.find((s) => s.key === key)?.name ?? key;
