import { foldVietnamese } from '@careers/shared';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../../ui/icons';
import { shortJobTitle } from '../applicants/ApplicantList';
import { LINE_COLORS } from './sourceSeries';
import { useDismiss } from './useDismiss';

export interface PickedJob {
  jobId: string;
  title: string;
  color: string;
}

type JobOption = { jobId: string; jobTitle: string };

/** As many as there are colours that stay apart for colour-blind readers: no made-up seventh. */
export const MAX_PICKED_JOBS = LINE_COLORS.length;

/** A job keeps its colour while picked, so dropping another one repaints nothing. */
export function togglePick(picks: readonly PickedJob[], job: JobOption): PickedJob[] {
  if (picks.some((p) => p.jobId === job.jobId)) return picks.filter((p) => p.jobId !== job.jobId);
  const color = LINE_COLORS.find((c) => !picks.some((p) => p.color === c));
  return color ? [...picks, { jobId: job.jobId, title: shortJobTitle(job.jobTitle), color }] : [...picks];
}

/** shadcn's ComboboxChip: muted, small, the cross quiet until pointed at. A dot says which colour on the chart. */
function Chip({ pick, onRemove }: { pick: PickedJob; onRemove: () => void }) {
  return (
    <span className="inline-flex h-[22px] w-fit min-w-0 items-center gap-1 rounded-sm bg-tint pl-1.5 text-xs font-medium text-navy">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: pick.color }} />
      <span className="max-w-[180px] truncate" title={pick.title}>
        {pick.title}
      </span>
      <button
        type="button"
        aria-label={`Bỏ ${pick.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex size-[22px] shrink-0 items-center justify-center border-0 bg-transparent text-navy opacity-50 hover:opacity-100"
      >
        <Icon name="x" size={12} />
      </button>
    </span>
  );
}

/** shadcn's ComboboxItem: the tick at the end of the row. */
function Option({
  id,
  job,
  pick,
  isLocked,
  isHighlighted,
  onHover,
  onToggle,
}: {
  id: string;
  job: JobOption;
  pick: PickedJob | undefined;
  isLocked: boolean;
  isHighlighted: boolean;
  onHover: () => void;
  onToggle: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={!!pick}
      aria-disabled={isLocked || undefined}
      title={job.jobTitle}
      onMouseEnter={onHover}
      // Keeps the focus in the input, so the list stays open for the next pick.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => !isLocked && onToggle()}
      className={`relative flex w-full select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm text-navy ${isLocked ? 'opacity-50' : 'cursor-default'} ${isHighlighted && !isLocked ? 'bg-tint' : ''}`}
    >
      {pick && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: pick.color }} />}
      <span className="min-w-0 truncate">{shortJobTitle(job.jobTitle)}</span>
      {pick && (
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-navy">
          <Icon name="check" size={14} />
        </span>
      )}
    </li>
  );
}

/**
 * Which jobs the chart compares: shadcn's multiple Combobox (chips in the field, typing filters, a list as wide as the
 * field). Arrows move, Enter picks, Backspace on an empty field drops the last chip. None picked: all jobs as one column.
 */
export function JobMultiSelect({
  jobs,
  picks,
  onChange,
}: {
  jobs: readonly JobOption[];
  picks: readonly PickedJob[];
  onChange: (picks: PickedJob[]) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState(0);
  const box = useDismiss(isOpen, () => setIsOpen(false));
  const isFull = picks.length >= MAX_PICKED_JOBS;
  const found = jobs.filter((job) => foldVietnamese(job.jobTitle).includes(foldVietnamese(search.trim())));
  const at = Math.min(highlight, Math.max(found.length - 1, 0));
  const isLocked = (job: JobOption) => isFull && !picks.some((p) => p.jobId === job.jobId);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      setIsOpen(true);
      setHighlight(found.length > 0 ? (at + step + found.length) % found.length : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const job = found[at];
      if (isOpen && job && !isLocked(job)) onChange(togglePick(picks, job));
    } else if (e.key === 'Backspace' && search === '' && picks.length > 0) {
      onChange(picks.slice(0, -1));
    }
  };

  return (
    <div ref={box} className="relative w-[min(440px,100%)] min-w-[280px] max-sm:w-full max-sm:min-w-0">
      {/* Pressing anywhere in the field means the input, as in shadcn's chips field. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={() => {
          input.current?.focus();
          setIsOpen(true);
        }}
        className="flex min-h-11 flex-wrap items-center gap-1 rounded-control border border-field bg-white px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/25"
      >
        {picks.map((pick) => (
          <Chip key={pick.jobId} pick={pick} onRemove={() => onChange(picks.filter((p) => p !== pick))} />
        ))}
        <input
          ref={input}
          role="combobox"
          aria-label="Chọn tin để so sánh"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${id}-list`}
          aria-activedescendant={isOpen && found[at] ? `${id}-${at}` : undefined}
          value={search}
          placeholder={picks.length > 0 ? 'Thêm tin' : 'Tất cả tin'}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlight(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          className="min-h-6 min-w-16 flex-1 border-0 bg-transparent px-1 text-sm text-navy outline-none placeholder:text-slate"
        />
      </div>
      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-full animate-fade rounded-control border border-line bg-white p-1 shadow-md">
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label="Các tin"
            aria-multiselectable="true"
            className="m-0 max-h-72 list-none overflow-y-auto overscroll-contain p-0"
          >
            {found.map((job, i) => (
              <Option
                key={job.jobId}
                id={`${id}-${i}`}
                job={job}
                pick={picks.find((p) => p.jobId === job.jobId)}
                isLocked={isLocked(job)}
                isHighlighted={i === at}
                onHover={() => setHighlight(i)}
                onToggle={() => onChange(togglePick(picks, job))}
              />
            ))}
          </ul>
          {found.length === 0 && <p className="m-0 py-2 text-center text-sm text-muted">Không tìm thấy tin nào.</p>}
          {isFull && <p className="m-0 px-2 py-1.5 text-xs text-muted">Chọn tối đa {MAX_PICKED_JOBS} tin</p>}
        </div>
      )}
    </div>
  );
}
