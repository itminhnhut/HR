import {
  daysLeft,
  formatDate,
  formatSalary,
  hasSalary,
  STATUS_LABEL,
  type EffectiveStatus,
  type HrJobRowDto,
} from '@careers/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { JobAction } from '../../api';
import { useDeleteJob, useHrJobs, useJobAction } from '../../api/queries';
import { copyText, useFlash, usePageMeta } from '../../lib/hooks';
import { jobUrl } from '../../lib/site';
import { ButtonLink } from '../../ui/Button';
import { EmptyState, ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon, type IconName } from '../../ui/icons';
import { apiMessage, errorMessage, FilterTabs, MenuItem, PageHeading, PopupMenu, type TabItem } from './parts';

type TabKey = 'all' | 'live' | 'paused' | 'ended' | 'draft';

const TAB_GROUPS: Record<TabKey, EffectiveStatus[] | null> = {
  all: null,
  live: ['open', 'expiring'],
  paused: ['paused'],
  ended: ['expired', 'filled'],
  draft: ['draft'],
};

const TAB_LABELS: [TabKey, string][] = [
  ['all', 'Tất cả'],
  ['live', 'Đang tuyển'],
  ['paused', 'Tạm dừng'],
  ['ended', 'Đã kết thúc'],
  ['draft', 'Bản nháp'],
];

/** Dot + label colours per status, from the mockup (tokens only). */
const STATUS_TONE: Record<EffectiveStatus, { text: string; dot: string }> = {
  open: { text: 'text-ok', dot: 'bg-ok border-ok' },
  expiring: { text: 'text-accent', dot: 'bg-focus border-accent' },
  paused: { text: 'text-body', dot: 'bg-transparent border-body' },
  expired: { text: 'text-muted', dot: 'bg-silver-soft border-muted' },
  filled: { text: 'text-accent', dot: 'bg-accent border-accent' },
  draft: { text: 'text-accent', dot: 'bg-transparent border-accent' },
};

const inTab = (row: HrJobRowDto, tab: TabKey) => TAB_GROUPS[tab]?.includes(row.status) ?? true;
const isEnded = (s: EffectiveStatus) => s === 'expired' || s === 'filled';
const isLive = (s: EffectiveStatus) => s === 'open' || s === 'expiring';
const shortDate = (iso: string) => formatDate(iso).slice(0, 5);
/** A draft has no real deadline until it is published (mockup shows "—"). */
const deadlineText = (row: HrJobRowDto) => (row.status === 'draft' ? '—' : formatDate(row.deadline));

interface FilledNote {
  id: string;
  title: string;
  total: number;
}

interface RowHandlers {
  busy: boolean;
  run: (action: JobAction) => void;
  onFilled: () => void;
  onDelete: () => void;
}

// ── Small pieces ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EffectiveStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span className={`inline-flex items-center gap-[7px] whitespace-nowrap text-xs font-medium ${tone.text}`}>
      <span aria-hidden="true" className={`size-[7px] rounded-full border ${tone.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function SalaryCell({ row }: { row: HrJobRowDto }) {
  if (hasSalary(row)) return <span>{formatSalary(row)}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-accent">
      <Icon name="alert" size={14} stroke={1.7} />
      Chưa ghi lương
    </span>
  );
}

function ApplicationsCell({ row }: { row: HrJobRowDto }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold">{row.totalApplications}</span>
      {row.newApplications > 0 && (
        <Link
          to={`/hr/ho-so?tin=${row.id}`}
          className="ml-1.5 text-xs font-medium text-accent no-underline hover:underline"
        >
          {row.newApplications} mới
        </Link>
      )}
    </span>
  );
}

const actClass =
  'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-control border-0 bg-transparent px-3 text-sm no-underline transition-colors hover:bg-tint disabled:opacity-60 lg:min-h-10';

function ActButton({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: IconName;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${actClass} font-medium text-accent`}>
      <Icon name={icon} size={16} stroke={1.5} />
      {children}
    </button>
  );
}

function ActLink({
  icon,
  to,
  children,
  strong = false,
}: {
  icon: IconName;
  to: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <Link to={to} className={`${actClass} ${strong ? 'font-medium text-link' : 'text-body hover:text-navy'}`}>
      <Icon name={icon} size={16} stroke={1.5} />
      {children}
    </Link>
  );
}

function JobActions({ row, busy, run, onFilled, onDelete }: { row: HrJobRowDto } & RowHandlers) {
  const navigate = useNavigate();
  const [copied, flashCopied] = useFlash();
  const [confirmFill, setConfirmFill] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { status } = row;
  const canEdit = status === 'draft' || isLive(status) || status === 'paused';
  const canMore = isLive(status) || status === 'paused';

  return (
    <div className="flex flex-wrap items-center gap-1 xl:flex-nowrap xl:justify-end">
      {status === 'draft' && (
        <ActLink icon="send" to={`/hr/tin/${row.id}`}>
          Đăng
        </ActLink>
      )}
      {status === 'draft' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            // Deleting cannot be undone, so it takes a second tap.
            if (!confirmDelete) return setConfirmDelete(true);
            setConfirmDelete(false);
            onDelete();
          }}
          className={`${actClass} ${confirmDelete ? 'font-medium text-error' : 'text-body hover:text-navy'}`}
        >
          <Icon name="trash" size={16} stroke={1.5} />
          {confirmDelete ? 'Bấm lần nữa để xóa' : 'Xóa'}
        </button>
      )}
      {row.extendTo && (
        <ActButton icon="calendar" onClick={() => run('extend')} disabled={busy}>
          Gia hạn
        </ActButton>
      )}
      {isEnded(status) && (
        <button
          type="button"
          onClick={() => navigate(`/hr/tin/moi?tu=${row.id}`)}
          className={`${actClass} font-medium text-link`}
        >
          <Icon name="copy" size={16} stroke={1.5} />
          Đăng lại
        </button>
      )}
      {status === 'paused' && (
        <ActButton icon="play" onClick={() => run('resume')} disabled={busy}>
          Mở lại
        </ActButton>
      )}
      {row.totalApplications > 0 && (
        <ActLink icon="inbox" to={`/hr/ho-so?tin=${row.id}`}>
          Hồ sơ
        </ActLink>
      )}
      {canEdit && (
        <Link
          to={`/hr/tin/${row.id}`}
          aria-label={`Sửa tin ${row.title}`}
          className="inline-flex size-11 items-center justify-center rounded-control text-body transition-colors hover:bg-tint hover:text-navy lg:size-10"
        >
          <Icon name="pencil" size={17} stroke={1.5} />
        </Link>
      )}
      {canMore && (
        <PopupMenu label={`Thao tác khác cho ${row.title}`}>
          {(close) => (
            <>
              {isLive(status) && (
                <MenuItem onClick={() => copyText(jobUrl(row.slug)).then((ok) => ok && flashCopied())}>
                  <Icon name={copied ? 'check' : 'link'} size={16} stroke={1.5} className="text-slate" />
                  {copied ? 'Đã chép' : 'Sao chép link'}
                </MenuItem>
              )}
              {isLive(status) && (
                <MenuItem
                  onClick={() => {
                    close();
                    run('pause');
                  }}
                >
                  <Icon name="pause" size={16} stroke={1.5} className="text-slate" />
                  Tạm dừng nhận hồ sơ
                </MenuItem>
              )}
              <MenuItem
                divided
                onClick={() => {
                  // Closing is final for candidates, so it takes a second tap.
                  if (!confirmFill) return setConfirmFill(true);
                  setConfirmFill(false);
                  close();
                  onFilled();
                }}
              >
                <Icon name="checkSquare" size={16} stroke={1.5} className={confirmFill ? 'text-error' : 'text-slate'} />
                {confirmFill ? (
                  <span className="font-medium text-error">Bấm lần nữa để đóng tin</span>
                ) : (
                  'Đã tuyển đủ, đóng tin'
                )}
              </MenuItem>
            </>
          )}
        </PopupMenu>
      )}
    </div>
  );
}

function TitleCell({ row }: { row: HrJobRowDto }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={`text-[15px] font-semibold ${isEnded(row.status) ? 'text-slate' : 'text-navy'}`}>
        {row.title}
      </span>
      <span className="text-xs text-muted">{row.department}</span>
    </div>
  );
}

// ── Table (tablet / desktop) and cards (phone) ──────────────────────────

const th = 'border-b border-line-soft px-4 py-3.5 font-medium';
const td = 'border-b border-line-soft px-4 py-4 align-middle';

function JobsTable({ rows, handlers }: { rows: HrJobRowDto[]; handlers: (row: HrJobRowDto) => RowHandlers }) {
  return (
    <div className="hidden overflow-x-auto xl:block">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className={`${th} pl-[22px]`}>
              Vị trí
            </th>
            <th scope="col" className={th}>
              Lương
            </th>
            <th scope="col" className={th}>
              Hồ sơ
            </th>
            <th scope="col" className={th}>
              Trạng thái
            </th>
            <th scope="col" className={th}>
              Hạn nộp
            </th>
            <th scope="col" className={`${th} pr-[22px] text-right`}>
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-hover">
              <td className={`${td} pl-[22px]`}>
                <TitleCell row={row} />
              </td>
              <td className={td}>
                <SalaryCell row={row} />
              </td>
              <td className={td}>
                <ApplicationsCell row={row} />
              </td>
              <td className={td}>
                <StatusBadge status={row.status} />
              </td>
              <td className={`${td} whitespace-nowrap text-body`}>{deadlineText(row)}</td>
              <td className={`${td} py-3 pr-[22px]`}>
                <JobActions row={row} {...handlers(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobCards({ rows, handlers }: { rows: HrJobRowDto[]; handlers: (row: HrJobRowDto) => RowHandlers }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 p-0 md:grid-cols-2 xl:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-3 border-b border-line-soft px-4 pb-2 pt-4 sm:px-5 md:odd:border-r"
        >
          <div className="flex items-start justify-between gap-3">
            <TitleCell row={row} />
            <StatusBadge status={row.status} />
          </div>
          <dl className="m-0 grid grid-cols-3 gap-3 text-sm">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted">Lương</dt>
              <dd className="m-0">
                <SalaryCell row={row} />
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted">Hồ sơ</dt>
              <dd className="m-0">
                <ApplicationsCell row={row} />
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted">Hạn nộp</dt>
              <dd className="m-0 text-body">{deadlineText(row)}</dd>
            </div>
          </dl>
          <div className="-mx-3">
            <JobActions row={row} {...handlers(row)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function JobsSkeleton() {
  const widths = ['62%', '48%', '70%', '54%', '66%', '44%'];
  return (
    <div aria-hidden="true">
      <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_1.6fr] gap-5 border-b border-line-soft px-5 py-4 xl:grid">
        <Sk w={70} h={11} />
        <Sk w={60} h={11} />
        <Sk w={50} h={11} />
        <Sk w={56} h={11} />
        <span />
      </div>
      {widths.map((w) => (
        <div
          key={w}
          className="flex flex-col gap-3 border-b border-line-soft p-5 xl:grid xl:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_1.6fr] xl:items-center xl:gap-5"
        >
          <span className="flex flex-col gap-2">
            <Sk w={w} h={16} />
            <Sk w={120} h={12} />
          </span>
          <Sk w={90} h={22} round />
          <Sk w={40} h={16} className="max-xl:hidden" />
          <Sk w={80} h={14} className="max-xl:hidden" />
          <span className="flex gap-2 xl:justify-end">
            <Sk w={84} h={36} />
            <Sk w={36} h={36} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Banners ─────────────────────────────────────────────────────────────

function ExpiringBanner({ row, busy, onExtend }: { row: HrJobRowDto; busy: boolean; onExtend: () => void }) {
  const left = Math.max(daysLeft(row.deadline), 0);
  const when = left === 0 ? 'hết hạn hôm nay' : `hết hạn trong ${left} ngày nữa`;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-card border border-silver bg-tint px-5 py-4 text-sm text-navy"
    >
      <span className="flex shrink-0 rounded-full border border-silver bg-white p-2">
        <Icon name="clock" size={18} stroke={1.5} />
      </span>
      <span className="min-w-0 flex-[1_1_260px] leading-relaxed">
        <strong className="font-semibold">{row.title}</strong> {when} ({formatDate(row.deadline)}). Gia hạn nếu vẫn cần
        tuyển, hoặc để tin tự đóng.
      </span>
      {row.extendTo && (
        <button
          type="button"
          onClick={onExtend}
          disabled={busy}
          className="min-h-11 rounded-control border border-silver-soft bg-white px-4 text-sm font-medium text-navy transition-colors hover:bg-mist disabled:opacity-60 lg:min-h-10"
        >
          Gia hạn đến {shortDate(row.extendTo)}
        </button>
      )}
    </div>
  );
}

function FilledBanner({ note, onDismiss }: { note: FilledNote; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-card border border-ring bg-tint px-5 py-4 text-sm leading-relaxed text-accent"
    >
      <span className="min-w-0 flex-[1_1_300px]">
        Đã đóng tin <strong className="font-semibold">{note.title}</strong>. Tin có {note.total} hồ sơ, nhớ gửi lời cảm
        ơn cho những người chưa được chọn.
      </span>
      <ButtonLink to={`/hr/ho-so?tin=${note.id}`} size="sm" className="font-medium hover:text-white">
        Xem hồ sơ
      </ButtonLink>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-10 border-0 bg-transparent px-3 text-sm text-slate hover:text-navy"
      >
        Để sau
      </button>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export function HrJobsPage() {
  usePageMeta('Tin tuyển dụng');
  const jobs = useHrJobs();
  const action = useJobAction();
  const remove = useDeleteJob();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [filled, setFilled] = useState<FilledNote | null>(null);
  const showSkeleton = useDelayedFlag(jobs.isPending);

  const flash = (location.state as { notice?: string } | null)?.notice;
  const rows = useMemo(() => jobs.data?.jobs ?? [], [jobs.data]);
  const visible = useMemo(() => rows.filter((r) => inTab(r, tab)), [rows, tab]);
  const expiring = rows.filter((r) => r.status === 'expiring');
  const tabs: TabItem<TabKey>[] = TAB_LABELS.map(([key, label]) => ({
    key,
    label,
    count: rows.filter((r) => inTab(r, key)).length,
  }));

  const run = (row: HrJobRowDto, kind: JobAction, onDone?: () => void) => {
    setActionError(null);
    action.mutate({ id: row.id, action: kind }, { onSuccess: onDone, onError: (e) => setActionError(errorMessage(e)) });
  };

  const handlers = (row: HrJobRowDto): RowHandlers => ({
    busy: (action.isPending && action.variables?.id === row.id) || (remove.isPending && remove.variables === row.id),
    run: (kind) => run(row, kind),
    onFilled: () => run(row, 'fill', () => setFilled({ id: row.id, title: row.title, total: row.totalApplications })),
    onDelete: () => {
      setActionError(null);
      remove.mutate(row.id, { onError: (e) => setActionError(errorMessage(e)) });
    },
  });

  return (
    <>
      <PageHeading
        title="Tin tuyển dụng"
        titleHiddenOnPhone
        subtitle={'Tin tự chuyển sang "Hết hạn" sau 23:59 ngày hạn nộp.'}
        action={
          <ButtonLink to="/hr/tin/moi" icon="plus" className="text-sm font-medium hover:text-white max-sm:w-full">
            Đăng tin mới
          </ButtonLink>
        }
      />

      {flash && (
        <Notice
          tone="ok"
          icon="check"
          action={
            <button
              type="button"
              onClick={() => navigate('.', { replace: true, state: null })}
              className="min-h-10 border-0 bg-transparent px-2 text-sm text-ok underline"
            >
              Đóng
            </button>
          }
        >
          <span role="status">{flash}</span>
        </Notice>
      )}
      {actionError && (
        <Notice tone="error" icon="alert">
          <span role="alert">{actionError}</span>
        </Notice>
      )}
      {filled && <FilledBanner note={filled} onDismiss={() => setFilled(null)} />}
      {expiring.map((row) => (
        <ExpiringBanner key={row.id} row={row} busy={handlers(row).busy} onExtend={() => run(row, 'extend')} />
      ))}

      <div className="rounded-card border border-line bg-white">
        <FilterTabs
          items={tabs}
          value={tab}
          onChange={setTab}
          label="Lọc theo trạng thái"
          className="border-b border-line px-4 sm:px-[22px]"
        />
        {jobs.isPending && (
          <>
            <LoadingStatus />
            {showSkeleton && <JobsSkeleton />}
          </>
        )}
        {jobs.isError && <ErrorState onRetry={() => jobs.refetch()} message={apiMessage(jobs.error)} />}
        {jobs.data && visible.length === 0 && (
          <EmptyState icon="briefcase" title={rows.length === 0 ? 'Chưa có tin nào' : 'Không có tin ở mục này'}>
            {rows.length === 0 ? 'Bấm "Đăng tin mới" để tạo tin đầu tiên.' : 'Chọn mục khác để xem các tin còn lại.'}
          </EmptyState>
        )}
        {visible.length > 0 && (
          <>
            <JobsTable rows={visible} handlers={handlers} />
            <JobCards rows={visible} handlers={handlers} />
          </>
        )}
      </div>
    </>
  );
}

export default HrJobsPage;
