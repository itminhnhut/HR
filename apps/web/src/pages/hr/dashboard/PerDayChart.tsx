import type { DashboardDto } from '@careers/shared';
import { useState } from 'react';
import { JobMultiSelect, type PickedJob } from './JobMultiSelect';
import { Panel } from './Panel';
import { bucketsOf, sumBuckets, unitOf, type ReportBucket } from './reportBuckets';

const ALL_JOBS_COLOR = '#2563eb';

interface Column {
  key: string;
  name: string;
  color: string;
  counts: number[];
}

const sum = (counts: readonly number[]) => counts.reduce((a, b) => a + b, 0);

/** The columns of one day, or week. An empty one draws nothing: the base line already says so. */
function BarGroup({ columns, at, max }: { columns: readonly Column[]; at: number; max: number }) {
  return (
    <span className="flex h-full w-full items-end justify-center gap-px">
      {columns.map((column) => {
        const count = column.counts[at] ?? 0;
        return (
          <span
            key={column.key}
            data-bar={column.key}
            className="min-w-0 max-w-5 flex-1 rounded-t-[3px]"
            style={{ height: count ? `${Math.max(6, (count / max) * 100)}%` : 0, background: column.color }}
          />
        );
      })}
    </span>
  );
}

/** What is under the mouse: the jobs with something that day first, the others only counted. */
function BarTooltip({
  columns,
  at,
  label,
  place,
}: {
  columns: readonly Column[];
  at: number;
  label: string;
  /** 0 to 1 along the chart. */
  place: number;
}) {
  const withSome = columns.filter((column) => (column.counts[at] ?? 0) > 0);
  return (
    <div
      role="tooltip"
      style={{ left: `${place * 100}%` }}
      className={`pointer-events-none absolute top-0 z-10 w-max max-w-[300px] rounded-control border border-line bg-white px-3 py-2 text-xs shadow-lg ${place > 0.5 ? '-translate-x-[calc(100%+8px)]' : 'translate-x-2'}`}
    >
      <div className="mb-1 flex items-center justify-between gap-6 font-semibold text-navy">
        <span>{label}</span>
        <span className="tabular-nums">{sum(columns.map((c) => c.counts[at] ?? 0))} hồ sơ</span>
      </div>
      {columns.length > 1 && withSome.length === 0 && <div className="text-muted">Không có hồ sơ</div>}
      {columns.length > 1 &&
        withSome.map((column) => (
          <div key={column.key} className="flex items-center justify-between gap-4 py-px text-slate">
            <span className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: column.color }} />
              <span className="truncate">{column.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-navy">{column.counts[at]}</span>
          </div>
        ))}
    </div>
  );
}

/** Which colour is which job, with its total: one tidy card each, in even columns. */
function Legend({ columns }: { columns: readonly Column[] }) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {columns.map((column) => (
        <li
          key={column.key}
          className="flex min-w-0 items-center gap-2.5 rounded-control border border-line-soft bg-mist px-3 py-2 text-[13px] text-body"
        >
          <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full" style={{ background: column.color }} />
          <span className="min-w-0 flex-1 truncate" title={column.name}>
            {column.name}
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-navy">{sum(column.counts)}</span>
        </li>
      ))}
    </ul>
  );
}

function BarRow({
  columns,
  buckets,
  named,
  onPick,
  picked,
}: {
  columns: readonly Column[];
  buckets: readonly ReportBucket[];
  named: (i: number) => string;
  onPick: (i: number | null) => void;
  picked: number | null;
}) {
  const max = Math.max(1, ...columns.flatMap((column) => column.counts));
  const words = (i: number) =>
    columns.length > 1
      ? columns.map((c) => `${c.name}: ${c.counts[i] ?? 0}`).join(', ')
      : `${columns[0]?.counts[i] ?? 0} hồ sơ`;
  return (
    <div
      role="group"
      aria-label="Hồ sơ theo thời gian, dùng phím mũi tên để xem từng mốc"
      className="relative flex h-[180px] items-end border-b border-silver"
      onMouseLeave={() => onPick(null)}
      onKeyDown={(e) => {
        // One Tab stop for the whole chart; arrows move between the groups.
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = Math.min(buckets.length - 1, Math.max(0, (picked ?? buckets.length - 1) + step));
        onPick(next);
        (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
      }}
    >
      {buckets.map((bucket, i) => (
        // The whole height answers the mouse, far wider than the thin columns in it.
        <button
          key={bucket.label}
          type="button"
          aria-label={`${named(i)}: ${words(i)}`}
          tabIndex={(picked ?? buckets.length - 1) === i ? 0 : -1}
          onMouseEnter={() => onPick(i)}
          onFocus={() => onPick(i)}
          onBlur={() => onPick(null)}
          onClick={() => onPick(i)}
          className={`flex h-full min-w-0 flex-1 items-end rounded-t-[4px] border-0 p-0 px-px transition-colors ${picked === i ? 'bg-tint' : 'bg-transparent'}`}
        >
          <BarGroup columns={columns} at={i} max={max} />
        </button>
      ))}
      {picked !== null && (
        <BarTooltip columns={columns} at={picked} label={named(picked)} place={(picked + 0.5) / buckets.length} />
      )}
    </div>
  );
}

/** Applications by day, or by week, month or year for a long period. Picked jobs stand side by side, one colour each. */
export function PerDayChart({ data }: { data: DashboardDto }) {
  const [picks, setPicks] = useState<PickedJob[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const days = data.perDay.map((d) => d.day);
  const unit = unitOf(days.length);
  const buckets = bucketsOf(days);
  const columns: Column[] =
    picks.length > 0
      ? picks.map(({ jobId, title, color }) => ({
          key: jobId,
          name: title,
          color,
          counts: sumBuckets(data.perJobPerDay.find((j) => j.jobId === jobId)?.counts ?? [], buckets),
        }))
      : [
          {
            key: 'all',
            name: 'Tất cả tin',
            color: ALL_JOBS_COLOR,
            counts: sumBuckets(
              data.perDay.map((d) => d.count),
              buckets,
            ),
          },
        ];
  // A new period can be shorter than the place picked on the old one.
  const picked = hovered !== null && hovered < buckets.length ? hovered : null;
  const named = (i: number) => `${unit === 'ngày' ? 'Ngày ' : ''}${buckets[i]?.label ?? ''}`;
  return (
    <Panel
      title={`Hồ sơ nhận theo ${unit}`}
      icon="bars"
      tone="blue"
      action={<JobMultiSelect jobs={data.perJobPerDay} picks={picks} onChange={setPicks} />}
    >
      <BarRow columns={columns} buckets={buckets} named={named} onPick={setHovered} picked={picked} />
      <div className="-mt-2 flex justify-between text-xs text-muted">
        <span>{buckets[0]?.label}</span>
        {buckets.length > 2 && <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>}
        {buckets.length > 1 && <span>{buckets[buckets.length - 1]?.label}</span>}
      </div>
      <Legend columns={columns} />
    </Panel>
  );
}
