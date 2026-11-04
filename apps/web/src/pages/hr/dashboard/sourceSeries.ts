import { sourceName, type ApplicationSource, type DashboardDto, type SourceDto } from '@careers/shared';

/**
 * The fixed order of the line colours: colour-blind separation ΔE 13.5 on neighbours (dataviz validate_palette, light).
 * One colour stays with one source, by its place in the source list, so a new source repaints nothing.
 */
export const LINE_COLORS = ['#2563eb', '#ea580c', '#0d9488', '#a16207', '#0ea5e9', '#db2777'];
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

/** A source's own colour by its place in the list; a taken one passes to the next free, the list's order deciding. */
function colorsOf(
  rows: readonly { source: ApplicationSource }[],
  placeOf: (source: ApplicationSource) => number,
): Map<ApplicationSource, string> {
  const colors = new Map<ApplicationSource, string>();
  for (const { source } of [...rows].sort((a, b) => placeOf(a.source) - placeOf(b.source))) {
    const start = placeOf(source) % LINE_COLORS.length;
    const free = LINE_COLORS.map((_, i) => LINE_COLORS[(start + i) % LINE_COLORS.length]).find(
      (color) => color && ![...colors.values()].includes(color),
    );
    colors.set(source, free ?? OTHER_COLOR);
  }
  return colors;
}

/**
 * One line per source that received something, biggest first, as long as there are colours for them. Only what does not
 * fit, or a source no longer on the list, folds into "Nguồn khác": never a made-up colour.
 */
export function sourceSeries(
  rows: DashboardDto['bySourcePerDay'],
  sources: readonly Pick<SourceDto, 'key' | 'name'>[],
): SourceSeries[] {
  const placeOf = (source: ApplicationSource) => sources.findIndex((s) => s.key === source);
  const known = rows.filter((r) => placeOf(r.source) >= 0).sort((a, b) => sum(b.counts) - sum(a.counts));
  const lines = known.slice(0, LINE_COLORS.length);
  const rest = rows.filter((r) => !lines.includes(r));
  const colors = colorsOf(lines, placeOf);
  const series: SourceSeries[] = lines.map(({ source, counts }) => ({
    source,
    name: sourceName(sources, source),
    color: colors.get(source) ?? OTHER_COLOR,
    counts,
    total: sum(counts),
  }));
  if (rest.length > 0) {
    const counts = (rest[0]?.counts ?? []).map((_, day) => sum(rest.map((r) => r.counts[day] ?? 0)));
    series.push({ source: null, name: 'Nguồn khác', color: OTHER_COLOR, counts, total: sum(counts) });
  }
  return series.sort((a, b) => b.total - a.total);
}

export interface SourceLegendItem {
  source: ApplicationSource;
  name: string;
  /** Its line's colour; grey when it has no line of its own. */
  color: string;
  total: number;
}

/** Every source on the list with its total, those with nothing too, so none seems forgotten. Biggest first. */
export function sourceLegend(
  rows: DashboardDto['bySourcePerDay'],
  sources: readonly Pick<SourceDto, 'key' | 'name'>[],
  series: readonly SourceSeries[],
): SourceLegendItem[] {
  const totalOf = (key: ApplicationSource) => sum(rows.find((r) => r.source === key)?.counts ?? []);
  return sources
    .map(({ key, name }) => ({
      source: key,
      name,
      color: series.find((line) => line.source === key)?.color ?? OTHER_COLOR,
      total: totalOf(key),
    }))
    .sort((a, b) => b.total - a.total);
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
