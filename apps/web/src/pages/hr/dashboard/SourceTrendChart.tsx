import type { DashboardDto } from '@careers/shared';
import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { useSources } from '../../../api/queries';
import { bucketsOf, sumBuckets, unitOf } from './reportBuckets';
import { peakLabels, sourceLegend, sourceSeries, type SourceLegendItem, type SourceSeries } from './sourceSeries';

/** Few points: their names would sit on top of each other, and the list under the chart has them. */
const MIN_FOR_PEAK_NAMES = 20;
/** Room above the highest point for its name. */
const HEADROOM = 0.84;

function SeriesPath({ line, max }: { line: SourceSeries; max: number }) {
  const last = line.counts.length - 1;
  const points = line.counts.map((count, i) => `${(i / last) * 100},${100 - (count / max) * 100 * HEADROOM}`).join(' ');
  return (
    <polyline
      points={points}
      fill="none"
      stroke={line.color}
      style={{ strokeWidth: 2 }}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

const xOf = (day: number, last: number) => `${(day / last) * 100}%`;
const yOf = (count: number, max: number) => `${100 - (count / max) * 100 * HEADROOM}%`;

function Tooltip({ series, day, labels: days }: { series: SourceSeries[]; day: number; labels: string[] }) {
  const last = days.length - 1;
  const isRightHalf = day > last / 2;
  return (
    <div
      style={{ left: xOf(day, last) }}
      className={`pointer-events-none absolute top-0 z-10 w-max min-w-[150px] rounded-control border border-line bg-white px-3 py-2 text-xs shadow-lg ${isRightHalf ? '-translate-x-[calc(100%+10px)]' : 'translate-x-[10px]'}`}
    >
      <div className="mb-1 font-semibold text-navy">{days[day]}</div>
      {series.map((line) => (
        <div key={line.name} className="flex items-center justify-between gap-4 py-px text-slate">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: line.color }} />
            {line.name}
          </span>
          <span className="font-semibold tabular-nums text-navy">{line.counts[day] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

/** The crosshair, a marker on every line and the numbers of that day. */
function DayMarks({ series, day, days, max }: { series: SourceSeries[]; day: number; days: string[]; max: number }) {
  const last = days.length - 1;
  return (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 w-px bg-silver" style={{ left: xOf(day, last) }} />
      {series.map((line) => (
        <span
          key={line.name}
          aria-hidden="true"
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
          style={{ left: xOf(day, last), top: yOf(line.counts[day] ?? 0, max), background: line.color }}
        />
      ))}
      <Tooltip series={series} day={day} labels={days} />
    </>
  );
}

function Plot({ series, days }: { series: SourceSeries[]; days: string[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const last = days.length - 1;
  const max = Math.max(1, ...series.flatMap((s) => s.counts));
  const ticks = max > 1 ? [max, Math.ceil(max / 2), 0] : [1, 0];
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setPicked(Math.max(0, Math.min(last, Math.round(((e.clientX - box.left) / box.width) * last))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (step === 0) return;
    e.preventDefault();
    setPicked(Math.max(0, Math.min(last, (picked ?? last + (step > 0 ? -1 : 1)) + step)));
  };
  const summary = series.map((s) => `${s.name}: ${s.total} hồ sơ`).join(', ');
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2">
      <div aria-hidden="true" className="relative h-[190px] text-xs tabular-nums text-muted">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: yOf(t, max) }}>
            {t}
          </span>
        ))}
      </div>
      <div
        role="img"
        tabIndex={0}
        aria-label={`Hồ sơ theo thời gian. ${summary}. Dùng phím trái, phải để xem từng mốc.`}
        onPointerMove={onPointer}
        onPointerLeave={() => setPicked(null)}
        onKeyDown={onKey}
        onBlur={() => setPicked(null)}
        className="field-focus relative h-[190px] touch-pan-y rounded-[4px]"
      >
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden="true"
            className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-silver' : 'bg-line-soft'}`}
            style={{ top: yOf(t, max) }}
          />
        ))}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
        >
          {series.map((line) => (
            <SeriesPath key={line.name} line={line} max={max} />
          ))}
        </svg>
        {picked === null &&
          series.length <= 4 &&
          days.length > MIN_FOR_PEAK_NAMES &&
          peakLabels(series).map((label) => (
            <span
              key={label.name}
              aria-hidden="true"
              className="absolute -translate-y-[calc(100%+6px)] whitespace-nowrap text-xs font-medium text-body max-sm:hidden"
              style={{
                top: yOf(label.count, max),
                ...(label.day > last / 2
                  ? { right: `${100 - (label.day / last) * 100}%` }
                  : { left: xOf(label.day, last) }),
              }}
            >
              {label.name} {label.count}
            </span>
          ))}
        {picked !== null && <DayMarks series={series} day={picked} days={days} max={max} />}
      </div>
      <div aria-hidden="true" className="col-start-2 mt-2 flex justify-between text-xs text-muted">
        <span>{days[0]}</span>
        {days.length > 2 && <span>{days[Math.floor(last / 2)]}</span>}
        <span>{days[last]}</span>
      </div>
    </div>
  );
}

/** The same numbers in words: every source and its total, each opening its applications. */
function Legend({ items }: { items: readonly SourceLegendItem[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
      {items.map((item) => (
        <li key={item.source}>
          <Link
            to={`/hr/ho-so?nguon=${item.source}`}
            className={`inline-flex min-h-8 items-center gap-2 text-sm no-underline hover:text-navy hover:underline ${item.total > 0 ? 'text-body' : 'text-muted'}`}
          >
            <span aria-hidden="true" className="h-[3px] w-4 rounded-full" style={{ background: item.color }} />
            {item.name}
            <span className={`tabular-nums ${item.total > 0 ? 'font-semibold text-navy' : ''}`}>{item.total}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** How the period's applications arrived, one line per source. A single day has no line to draw, only its totals. */
export function SourceTrendChart({ data }: { data: DashboardDto }) {
  const sources = useSources().data ?? [];
  const days = data.perDay.map((d) => d.day);
  const buckets = bucketsOf(days);
  const series = sourceSeries(data.bySourcePerDay, sources).map((line) => ({
    ...line,
    counts: sumBuckets(line.counts, buckets),
  }));
  return (
    <div className="flex flex-col gap-3">
      {series.length === 0 && <p className="m-0 text-sm text-slate">Chưa có hồ sơ nào trong khoảng thời gian này.</p>}
      {series.length > 0 && buckets.length > 1 && <Plot series={series} days={buckets.map((b) => b.label)} />}
      <Legend items={sourceLegend(data.bySourcePerDay, sources, series)} />
      {unitOf(days.length) !== 'ngày' && (
        <p className="m-0 text-xs text-muted">Mỗi điểm là một {unitOf(days.length)}.</p>
      )}
    </div>
  );
}
