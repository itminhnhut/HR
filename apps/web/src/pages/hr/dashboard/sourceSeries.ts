import { sourceName, type ApplicationSource, type DashboardDto, type SourceDto } from '@careers/shared';

/**
 * The fixed order of the line colours: colour-blind separation ΔE 13.5 on neighbours (dataviz validate_palette, light).
 * One colour stays with one source, by its place in the source list, so a new source repaints nothing.
 */
const LINE_COLORS = ['#2563eb', '#ea580c', '#0d9488', '#a16207', '#0ea5e9', '#db2777'];
const OTHER_COLOR = '#64748b';

export interface SourceSeries {
  /** Null for "Khác", the sources past the colours there are. */
  source: ApplicationSource | null;
  name: string;
  color: string;
  counts: number[];
  total: number;
}

const sum = (counts: readonly number[]) => counts.reduce((n, c) => n + c, 0);

/** One line per source that received something, biggest first; the rest fold into "Khác", never a made-up colour. */
export function sourceSeries(
  rows: DashboardDto['bySourcePerDay'],
  sources: readonly Pick<SourceDto, 'key' | 'name'>[],
): SourceSeries[] {
  const placeOf = (source: ApplicationSource) => sources.findIndex((s) => s.key === source);
  const hasColor = (source: ApplicationSource) => placeOf(source) >= 0 && placeOf(source) < LINE_COLORS.length;
  const lines = rows.filter((r) => hasColor(r.source));
  const rest = rows.filter((r) => !hasColor(r.source));
  const series: SourceSeries[] = lines.map(({ source, counts }) => ({
    source,
    name: sourceName(sources, source),
    color: LINE_COLORS[placeOf(source)] ?? OTHER_COLOR,
    counts,
    total: sum(counts),
  }));
  if (rest.length > 0) {
    const counts = (rest[0]?.counts ?? []).map((_, day) => sum(rest.map((r) => r.counts[day] ?? 0)));
    series.push({ source: null, name: 'Khác', color: OTHER_COLOR, counts, total: sum(counts) });
  }
  return series.sort((a, b) => b.total - a.total);
}

/** Where each line's name goes: its busiest day, unless another name already stands there. */
export function peakLabels(
  series: readonly SourceSeries[],
  minGap = 4,
): { name: string; day: number; count: number }[] {
  const placed: { name: string; day: number; count: number }[] = [];
  for (const line of series) {
    const count = Math.max(...line.counts);
    const day = line.counts.indexOf(count);
    if (count > 0 && !placed.some((p) => Math.abs(p.day - day) < minGap)) placed.push({ name: line.name, day, count });
  }
  return placed;
}
