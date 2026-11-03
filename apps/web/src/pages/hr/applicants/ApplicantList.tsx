import { formatTimestamp, WEBSITE_SOURCE, type ApplicationRowDto, type ApplicationStatus } from '@careers/shared';
import { useEffect, useRef } from 'react';
import { Sk } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { ReviewMark } from '../reviews/PickForReview';
import { percentTone } from './CvMatch';
import { StatusMark } from './StatusMark';
import { STATUS_STYLE } from './statusStyle';
import { interviewLabel } from './InterviewField';

const chip = 'shrink-0 rounded-full border px-1.5 text-[11px] font-medium leading-4';

function StatusPill({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 ${chip} ${STATUS_STYLE[status].soft}`}>
      <StatusMark look={STATUS_STYLE[status]} size={12} />
    </span>
  );
}

/** The third line of a row: only what is worth noticing, on one line. */
function RowTags({ row, showStatus }: { row: ApplicationRowDto; showStatus: boolean }) {
  const isAddedByHr = row.source !== WEBSITE_SOURCE;
  const hasInterview = row.status === 'interview' && !!row.interviewAt;
  const hasAny = showStatus || !row.hasCv || isAddedByHr || !!row.review || row.cvUpdatedByCandidate || hasInterview;
  if (!hasAny) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
      {showStatus && <StatusPill status={row.status} />}
      {!row.hasCv && <span className={`${chip} border-error/30 bg-error-soft text-error`}>Không CV</span>}
      {isAddedByHr && <span className={`${chip} border-line bg-white text-slate`}>HR thêm</span>}
      {row.review && <ReviewMark review={row.review} />}
      {row.cvUpdatedByCandidate && (
        <span title="Ứng viên vừa cập nhật CV" className={`${chip} ${STATUS_STYLE.new.soft}`}>
          CV mới
        </span>
      )}
      {hasInterview && row.interviewAt && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-navy">
          <Icon name="calendar" size={12} />
          {interviewLabel(row.interviewAt)}
        </span>
      )}
    </span>
  );
}

/** While picking for "Gửi sếp duyệt" a row is a checkbox; see canSendForReview for who cannot be picked. */
export interface RowPick {
  on: boolean;
  /** Already waiting for a reviewer, already invited, or already declined. */
  blocked: boolean;
  toggle: () => void;
}

function rowTone(isCurrent: boolean, pick: RowPick | undefined): string {
  if (pick?.on) return 'border-ok bg-ok-soft';
  if (!pick && isCurrent) return 'border-navy bg-remind';
  return 'border-transparent bg-white hover:bg-hover';
}

function RowText({ row, showStatus }: { row: ApplicationRowDto; showStatus: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold leading-5">{row.fullName}</span>
        {row.matchPercent != null && (
          <span
            title="Phù hợp với yêu cầu (chấm CV tự động)"
            className={`shrink-0 rounded-full px-2 text-[11px] font-semibold leading-[18px] ${percentTone(row.matchPercent)}`}
          >
            {row.matchPercent}%
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-baseline justify-between gap-2 text-xs leading-4 text-slate">
        <span className="min-w-0 truncate">{row.jobTitle}</span>
        <span className="shrink-0 text-muted">{formatTimestamp(row.createdAt)}</span>
      </span>
      <RowTags row={row} showStatus={showStatus} />
      {row.noteLine && (
        <span title={row.noteLine} className="line-clamp-2 text-xs italic leading-4 text-muted">
          “{row.noteLine}”
        </span>
      )}
    </span>
  );
}

/** Rows have the same height; only a note, on its own lines, makes one taller. */
function ApplicantRow({
  row,
  isCurrent,
  showStatus,
  onOpen,
  pick,
}: {
  row: ApplicationRowDto;
  isCurrent: boolean;
  showStatus: boolean;
  onOpen: () => void;
  pick?: RowPick;
}) {
  return (
    <li className="border-b border-line-soft last:border-b-0">
      <button
        type="button"
        onClick={pick ? pick.toggle : onOpen}
        disabled={pick?.blocked}
        role={pick ? 'checkbox' : undefined}
        aria-checked={pick ? pick.on : undefined}
        aria-current={!pick && isCurrent ? 'true' : undefined}
        className={`flex min-h-[76px] w-full items-center gap-3 border-0 border-l-[3px] py-2 pl-3 pr-3.5 text-left text-navy transition-colors focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${rowTone(isCurrent, pick)}`}
      >
        {pick && (
          <span
            aria-hidden="true"
            className={`flex size-[22px] shrink-0 items-center justify-center rounded-[5px] border-2 ${pick.on ? 'border-ok bg-ok text-white' : 'border-silver bg-white'}`}
          >
            {pick.on && <Icon name="check" size={14} stroke={2.4} />}
          </span>
        )}
        <RowText row={row} showStatus={showStatus} />
      </button>
    </li>
  );
}

/** Keeps the open row in view when it changes from the detail; touches only the list's own scroll position. */
function useKeepInView(selectedId: string | null, rowCount: number) {
  const list = useRef<HTMLUListElement>(null);
  const hasRows = rowCount > 0;
  useEffect(() => {
    const box = list.current;
    const item = box?.querySelector('[aria-current="true"]');
    if (!box || !item) return;
    const inner = box.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    if (rect.top < inner.top) box.scrollTop -= inner.top - rect.top;
    else if (rect.bottom > inner.bottom) box.scrollTop += rect.bottom - inner.bottom;
  }, [selectedId, hasRows]);
  return list;
}

export function ApplicantList({
  rows,
  selectedId,
  tab,
  emptyMessage,
  onOpen,
  pickFor,
}: {
  rows: ApplicationRowDto[];
  selectedId: string | null;
  tab: ApplicationStatus | 'all';
  emptyMessage: string;
  onOpen: (id: string) => void;
  pickFor: (row: ApplicationRowDto) => RowPick | undefined;
}) {
  const list = useKeepInView(selectedId, rows.length);
  return (
    <ul ref={list} aria-label="Danh sách hồ sơ" className="relative m-0 min-h-0 flex-1 list-none p-0 lg:pane-scroll">
      {rows.map((row) => (
        <ApplicantRow
          key={row.id}
          row={row}
          isCurrent={row.id === selectedId}
          // A row that no longer belongs in this tab stays until HR moves on, and says why it looks out of place.
          showStatus={tab === 'all' || row.status !== tab}
          onOpen={() => onOpen(row.id)}
          pick={pickFor(row)}
        />
      ))}
      {rows.length === 0 && <li className="px-5 py-10 text-center text-[15px] text-slate">{emptyMessage}</li>}
    </ul>
  );
}

export function ListSkeleton() {
  return (
    <div aria-hidden="true" className="flex min-h-0 flex-1 items-stretch gap-3">
      <div className="min-w-0 flex-1 overflow-hidden rounded-card border border-line bg-white lg:w-[340px] lg:flex-none xl:w-[400px] 2xl:w-[440px]">
        {['62%', '48%', '70%', '54%', '66%', '44%'].map((w) => (
          <div key={w} className="flex h-[76px] flex-col justify-center gap-[7px] border-b border-line-soft px-4">
            <Sk w="55%" h={14} />
            <Sk w={w} h={11} />
          </div>
        ))}
      </div>
      <div className="hidden min-w-0 flex-1 flex-col gap-[18px] rounded-card border border-line bg-white p-5 lg:flex">
        <Sk w={220} h={22} />
        <div className="flex gap-2.5">
          <Sk w={110} h={44} />
          <Sk w={120} h={44} />
          <Sk w={110} h={44} />
        </div>
        <Sk w="100%" h={80} />
        <Sk w="85%" h={13} />
      </div>
    </div>
  );
}
