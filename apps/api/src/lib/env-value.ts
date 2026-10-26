/**
 * A setting from the environment, or '' when unset. A "[...]" value is a placeholder copied from .env.example,
 * never real data, so it counts as unset instead of showing "[Tên công ty]" in page titles and emails.
 * The web app has the same rule (apps/web/src/lib/env-value.ts).
 */
export function envValue(value: string | undefined): string {
  const v = value?.trim() ?? '';
  return /^\[.*\]$/.test(v) ? '' : v;
}

const DEFAULT_COMPANY = 'TOP FLOW';

/** The company name in page titles, share previews and emails. */
export const companyName = (env: Record<string, string | undefined>): string =>
  envValue(env.COMPANY_NAME) || DEFAULT_COMPANY;
