import { readFileSync } from 'node:fs';

export type ContactField = 'fullName' | 'phone' | 'email';
export const CONTACT_FIELDS: readonly ContactField[] = ['fullName', 'phone', 'email'];

/** One fictional CV and what a human reads off it. Values were fixed before the parser ever ran on the set. */
export interface BotCase {
  id: string;
  layout: string;
  focus: string;
  /** pdf: real file through POST parse-cv. text: extraction artefact fed straight to parseCvContact. */
  path: 'pdf' | 'text';
  notes: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  /** Judgement calls declared with the label, e.g. an old 11-digit number as printed. */
  alsoAccept?: Partial<Record<ContactField, string[]>>;
  /** Present and false when the page has no text layer at all. */
  readable?: false;
}

export const HERE = new URL('./', import.meta.url);

export const loadCases = (): BotCase[] => JSON.parse(readFileSync(new URL('expected.json', HERE), 'utf8')) as BotCase[];

export const pdfBytes = (id: string) => readFileSync(new URL(`pdfs/${id}.pdf`, HERE));
export const fixtureText = (id: string) => readFileSync(new URL(`fixtures/${id}.txt`, HERE), 'utf8');
export const badFile = (name: string) => readFileSync(new URL(`bad/${name}`, HERE));
