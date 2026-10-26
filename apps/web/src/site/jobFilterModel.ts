import { matchesQuery, type JobCardDto } from '@careers/shared';

/** What a visitor narrowed the open jobs down to. Empty string = no filter. */
export interface JobFilterValues {
  q: string;
  department: string;
  place: string;
}

/** Address query keys: /?q=ke+toan&phong-ban=Kinh+doanh&noi-lam=... */
export const FILTER_PARAMS: Record<keyof JobFilterValues, string> = {
  q: 'q',
  department: 'phong-ban',
  place: 'noi-lam',
};

type FilterableJob = Pick<JobCardDto, 'title' | 'department' | 'place'>;

export function readFilters(params: URLSearchParams): JobFilterValues {
  return {
    q: params.get(FILTER_PARAMS.q) ?? '',
    department: params.get(FILTER_PARAMS.department) ?? '',
    place: params.get(FILTER_PARAMS.place) ?? '',
  };
}

/** A new query with the patch applied; blank values remove their key, other keys are kept. */
export function writeFilters(params: URLSearchParams, patch: Partial<JobFilterValues>): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    const name = FILTER_PARAMS[key as keyof JobFilterValues];
    if (value?.trim()) next.set(name, value);
    else next.delete(name);
  }
  return next;
}

export function hasActiveFilters(filters: JobFilterValues): boolean {
  return Boolean(filters.q.trim() || filters.department || filters.place);
}

/** Search matches the title or department, ignoring Vietnamese accents; the selects match exactly. */
export function filterJobs<T extends FilterableJob>(jobs: readonly T[], filters: JobFilterValues): T[] {
  return jobs.filter(
    (job) =>
      (!filters.department || job.department === filters.department) &&
      (!filters.place || job.place === filters.place) &&
      matchesQuery(`${job.title} ${job.department}`, filters.q),
  );
}

/**
 * Select options from the values present in the jobs, unique and in Vietnamese order.
 * The current value is kept even when no job has it (old link), so the visitor can see and clear it.
 */
export function filterOptions(values: readonly string[], current = ''): string[] {
  const unique = new Set(values.filter((v) => v.trim()));
  if (current) unique.add(current);
  return [...unique].sort((a, b) => a.localeCompare(b, 'vi'));
}

/** Phones show at most this many jobs before "Xem thêm"; a list of ten or fewer is shown whole. */
export const PHONE_LIST_MAX = 10;

export function shownOnPhone<T>(jobs: readonly T[], showAll: boolean): T[] {
  return showAll ? [...jobs] : jobs.slice(0, PHONE_LIST_MAX);
}
