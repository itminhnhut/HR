import { readFileSync } from 'node:fs';

/** One synthetic CV (fictional person) and what parseCvContact should read from its extracted text. */
export interface ExpectedCv {
  id: string;
  layout: string;
  notes: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
}

export type ContactField = 'fullName' | 'phone' | 'email';

export const CONTACT_FIELDS: ContactField[] = ['fullName', 'phone', 'email'];

/** Reads `<dir>/expected.json` and gives access to `<dir>/fixtures/<id>.txt`; `dir` must end with a slash. */
export function loadCorpus(dir: URL) {
  const cases = JSON.parse(readFileSync(new URL('expected.json', dir), 'utf8')) as ExpectedCv[];
  const fixtureUrl = (id: string) => new URL(`fixtures/${id}.txt`, dir);
  const fixture = (id: string) => readFileSync(fixtureUrl(id), 'utf8');
  /** One row per CV and field, for it.each tests named by id, layout and field. */
  const rows = cases.flatMap((cv) => CONTACT_FIELDS.map((field) => ({ ...cv, field, want: cv[field] })));
  return { cases, rows, fixture, fixtureUrl };
}
