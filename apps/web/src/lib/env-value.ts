/**
 * A setting from the environment, or '' when unset. A "[...]" value is a placeholder copied from an example
 * file, never real data, so it counts as unset instead of showing "[Tên công ty]" on the live site.
 * No `import.meta.env` here: vite.config.ts uses it too.
 */
export function envValue(value: string | undefined): string {
  const v = value?.trim() ?? '';
  return /^\[.*\]$/.test(v) ? '' : v;
}

export const DEFAULT_COMPANY = 'TOP FLOW';
