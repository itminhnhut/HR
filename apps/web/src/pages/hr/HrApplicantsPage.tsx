import {
  formatPhone,
  formatTimestamp,
  lastName,
  zaloLink,
  type ApplicationDetailDto,
  type ApplicationRowDto,
  type ApplicationStatus,
} from '@careers/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { isDemo } from '../../api';
import { useApplication, useApplications, useUpdateApplication } from '../../api/queries';
import { copyText, useMediaQuery, usePageMeta } from '../../lib/hooks';
import { SITE, telLink } from '../../lib/site';
import { CloseButton, Dialog, SheetHandle } from '../../ui/Dialog';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon, type IconName } from '../../ui/icons';
import { apiMessage, Avatar, errorMessage, FilterTabs, PageHeading, type TabItem } from './parts';

type TabKey = ApplicationStatus | 'all';

const TABS: [TabKey, string][] = [
  ['all', 'Tất cả'],
  ['new', 'Mới'],
  ['seen', 'Đã xem'],
  ['interview', 'Hẹn phỏng vấn'],
  ['passed', 'Đạt'],
  ['rejected', 'Chưa phù hợp'],
];

const isTab = (v: string | null): v is TabKey => TABS.some(([k]) => k === v);
const shortDate = (iso: string) => formatTimestamp(iso).slice(0, 5);

// ── List ────────────────────────────────────────────────────────────────

function StatusText({ status }: { status: ApplicationStatus }) {
  switch (status) {
    case 'new':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          Mới
        </span>
      );
    case 'seen':
      return <span className="text-xs text-muted">Đã xem</span>;
    case 'interview':
      return <span className="text-xs font-medium text-navy">Hẹn phỏng vấn</span>;
    case 'passed':
      return <span className="text-xs font-medium text-ok">Đạt</span>;
    case 'rejected':
      return <span className="text-xs text-muted">Chưa phù hợp</span>;
  }
}

function ApplicantRow({ row, current, onPick }: { row: ApplicationRowDto; current: boolean; onPick: () => void }) {
  return (
    <li className="border-b border-line-soft last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        aria-current={current ? 'true' : undefined}
        className={`flex w-full items-center gap-3.5 border-0 border-l-2 px-4 py-3.5 text-left text-navy transition-colors hover:bg-hover sm:px-5 sm:py-4 ${
          current ? 'border-navy bg-mist' : 'border-transparent bg-white'
        }`}
      >
        <Avatar name={row.fullName} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{row.fullName}</span>
          <span className="truncate text-xs text-slate sm:text-[13px]">{row.jobTitle}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <StatusText status={row.status} />
          <span className="text-xs text-muted">{shortDate(row.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="rounded-card border border-line bg-white">
        {['62%', '48%', '70%', '54%', '66%', '44%'].map((w) => (
          <div key={w} className="flex items-center gap-3 border-b border-line-soft px-[18px] py-4 last:border-b-0">
            <Sk w={40} h={40} round className="shrink-0" />
            <span className="flex flex-1 flex-col gap-[7px]">
              <Sk w="55%" h={14} />
              <Sk w={w} h={11} />
            </span>
            <Sk w={44} h={11} />
          </div>
        ))}
      </div>
      <div className="hidden flex-col gap-[18px] rounded-card border border-line bg-white p-7 lg:flex">
        <div className="flex items-center gap-4">
          <Sk w={56} h={56} round />
          <span className="flex flex-col gap-2">
            <Sk w={220} h={22} />
            <Sk w={160} h={13} />
          </span>
        </div>
        <div className="flex gap-2.5">
          <Sk w={110} h={46} />
          <Sk w={120} h={46} />
          <Sk w={110} h={46} />
        </div>
        <Sk w="100%" h={13} />
        <Sk w="85%" h={13} />
        <Sk w="100%" h={80} />
      </div>
    </div>
  );
}

// ── Detail ──────────────────────────────────────────────────────────────

const bigAction =
  'flex flex-col items-center justify-center gap-1.5 rounded-control px-1.5 py-3 text-[13px] font-medium no-underline max-lg:rounded-card max-lg:py-3.5';

function BigActions({ app }: { app: ApplicationDetailDto }) {
  const cvLink = app.cvLink && /^https?:\/\//i.test(app.cvLink) ? app.cvLink : null;
  return (
    <div className="grid grid-cols-3 gap-2">
      <a href={telLink(app.phone)} className={`${bigAction} btn-glow bg-accent text-white hover:text-white`}>
        <Icon name="phone" size={18} stroke={1.5} />
        Gọi
      </a>
      <a
        href={zaloLink(app.phone)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${bigAction} border border-silver text-navy hover:bg-mist`}
      >
        <Icon name="chat" size={18} stroke={1.5} />
        Nhắn Zalo
      </a>
      {cvLink ? (
        <a
          href={cvLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`${bigAction} border border-silver text-navy hover:bg-mist`}
        >
          <Icon name="file" size={18} stroke={1.5} />
          Xem CV
        </a>
      ) : (
        <span aria-disabled="true" className={`${bigAction} border border-dashed border-silver text-center text-muted`}>
          <Icon name="file" size={18} stroke={1.5} />
          {app.cvFileName ? 'Xem CV' : 'Chưa có CV'}
        </span>
      )}
    </div>
  );
}

function CvFileNote({ app }: { app: ApplicationDetailDto }) {
  if (!app.cvFileName || app.cvLink) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-control bg-mist px-3.5 py-2.5 text-[13px] text-body">
      <Icon name="file" size={16} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate font-medium text-navy">{app.cvFileName}</span>
      {isDemo && <span className="shrink-0 text-xs text-muted">Tải CV khi nối BE</span>}
    </div>
  );
}

function Fact({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex shrink-0 rounded-full border border-ring p-2 text-accent">
        <Icon name={icon} size={15} stroke={1.4} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="m-0 font-medium [overflow-wrap:anywhere]">{children}</dd>
      </div>
    </div>
  );
}

const STATUS_BUTTONS: {
  status: ApplicationStatus;
  label: string;
  short: string;
  icon: IconName;
  idle: string;
  on: string;
}[] = [
  {
    status: 'interview',
    label: 'Hẹn phỏng vấn',
    short: 'Hẹn PV',
    icon: 'calendar',
    idle: 'border-navy text-navy font-medium',
    on: 'border-navy bg-navy text-white font-medium',
  },
  {
    status: 'passed',
    label: 'Đạt',
    short: 'Đạt',
    icon: 'check',
    idle: 'border-ok-line text-ok font-medium',
    on: 'border-ok bg-ok-soft text-ok font-semibold',
  },
  {
    status: 'rejected',
    label: 'Chưa phù hợp',
    short: 'Chưa phù hợp',
    icon: 'x',
    idle: 'border-field text-slate',
    on: 'border-slate bg-tint text-navy font-medium',
  },
];

function StatusButtons({ app, onError }: { app: ApplicationDetailDto; onError: (msg: string) => void }) {
  const update = useUpdateApplication();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">Cập nhật trạng thái</span>
      <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
        {STATUS_BUTTONS.map((b) => {
          const on = app.status === b.status;
          return (
            <button
              key={b.status}
              type="button"
              aria-pressed={on}
              disabled={update.isPending}
              onClick={() =>
                !on &&
                update.mutate({ id: app.id, patch: { status: b.status } }, { onError: (e) => onError(errorMessage(e)) })
              }
              className={`inline-flex min-h-[46px] items-center justify-center gap-[7px] rounded-control border px-3.5 text-[13px] transition-colors lg:min-h-11 ${on ? b.on : `bg-white hover:bg-mist ${b.idle}`}`}
            >
              <Icon name={b.icon} size={15} stroke={1.6} className="max-lg:hidden" />
              <span className="lg:hidden">{b.short}</span>
              <span className="max-lg:hidden">{b.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NoteField({ app, onError }: { app: ApplicationDetailDto; onError: (msg: string) => void }) {
  const update = useUpdateApplication();
  const [note, setNote] = useState(app.note ?? '');
  const saved = useRef(app.note ?? null);
  const latest = useRef(note);
  latest.current = note;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const { mutate } = update;
  const saveNote = useCallback(() => {
    const next = latest.current.trim() || null;
    if (next === saved.current) return;
    saved.current = next;
    mutate(
      { id: app.id, patch: { note: next } },
      { onError: (e) => onErrorRef.current(errorMessage(e, 'Chưa lưu được ghi chú, thử lại.')) },
    );
  }, [app.id, mutate]);
  // Save a moment after typing stops, and when the panel closes (Esc, sheet).
  useEffect(() => {
    const t = setTimeout(saveNote, 1000);
    return () => clearTimeout(t);
  }, [note, saveNote]);
  const saveRef = useRef(saveNote);
  saveRef.current = saveNote;
  useEffect(() => () => saveRef.current(), []);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">Ghi chú nội bộ</span>
      <textarea
        rows={3}
        value={note}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        placeholder="Chỉ HR thấy, vd: hẹn PV thứ 5 lúc 10h"
        className="field-focus resize-y rounded-control border border-field bg-white px-3.5 py-3 text-sm text-navy outline-none placeholder:text-muted"
      />
      <span className="text-xs text-muted">
        {update.isPending ? 'Đang lưu…' : 'Tự lưu. Ứng viên không thấy ghi chú này.'}
      </span>
    </label>
  );
}

function ThankYou({ app, onError }: { app: ApplicationDetailDto; onError: (msg: string) => void }) {
  const update = useUpdateApplication();
  const message = `Chào ${lastName(app.fullName)}, cảm ơn bạn đã ứng tuyển vị trí ${app.jobTitle} tại ${SITE.company}. Lần này chúng tôi đã chọn ứng viên phù hợp hơn với yêu cầu hiện tại. Chúc bạn sớm tìm được công việc ưng ý.`;
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line px-[18px] py-4">
      <strong className="text-sm font-semibold">Gửi lời cảm ơn qua Zalo</strong>
      <p className="m-0 rounded-control bg-hover px-3.5 py-3 text-sm leading-relaxed text-ink">{message}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={zaloLink(app.phone)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void copyText(message)}
          className="btn-glow inline-flex min-h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-white no-underline hover:text-white"
        >
          Mở Zalo và dán
        </a>
        <button
          type="button"
          disabled={!!app.thankedAt || update.isPending}
          onClick={() =>
            update.mutate({ id: app.id, patch: { thanked: true } }, { onError: (e) => onError(errorMessage(e)) })
          }
          className={`inline-flex min-h-11 items-center gap-2 rounded-control border bg-white px-4 text-sm ${
            app.thankedAt ? 'border-ok-line text-ok disabled:opacity-100' : 'border-field text-body hover:bg-mist'
          }`}
        >
          {app.thankedAt && <Icon name="check" size={16} />}
          {app.thankedAt ? 'Đã gửi' : 'Đánh dấu đã gửi'}
        </button>
      </div>
    </div>
  );
}

function DetailBody({ app, onClose }: { app: ApplicationDetailDto; onClose?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5 max-lg:gap-4">
      <div className="flex items-center gap-4 max-lg:gap-3.5">
        <Avatar name={app.fullName} size={56} solid />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="m-0 font-serif text-[24px] font-medium lg:text-[26px]">{app.fullName}</h2>
          <span className="text-[13px] text-slate lg:text-sm">
            {app.jobTitle}
            <span className="lg:hidden"> · {shortDate(app.createdAt)}</span>
          </span>
        </div>
        {onClose && <CloseButton onClick={onClose} className="border-0 bg-tint" />}
      </div>

      <BigActions app={app} />
      <CvFileNote app={app} />

      <dl className="m-0 flex flex-col gap-3 text-sm">
        <Fact icon="phone" label="Điện thoại">
          {formatPhone(app.phone)}
        </Fact>
        <Fact icon="mail" label="Email">
          {app.email ?? 'Không cung cấp'}
        </Fact>
        <Fact icon="calendar" label="Ngày nộp">
          {formatTimestamp(app.createdAt)}
        </Fact>
      </dl>

      {app.message && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Lời nhắn của ứng viên</span>
          <p className="m-0 border-l-2 border-silver bg-hover px-4 py-3.5 text-sm leading-relaxed text-ink">
            {app.message}
          </p>
        </div>
      )}

      {error && (
        <Notice tone="error" icon="alert">
          <span role="alert">{error}</span>
        </Notice>
      )}
      <StatusButtons app={app} onError={setError} />
      <NoteField key={app.id} app={app} onError={setError} />
      {app.status === 'rejected' && <ThankYou app={app} onError={setError} />}

      <div className="flex items-start gap-2.5 rounded-control bg-mist px-3.5 py-3 text-[13px] leading-relaxed text-body">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-accent" />
        <span>
          {app.keepForOtherJobs
            ? 'Ứng viên đồng ý giữ hồ sơ 12 tháng, có thể xét cho vị trí khác.'
            : 'Chỉ đồng ý cho vị trí này. Nếu không tuyển, hồ sơ tự xóa 30 ngày sau khi tin đóng.'}
        </span>
      </div>
    </div>
  );
}

function ApplicantDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const detail = useApplication(id);
  const showSkeleton = useDelayedFlag(detail.isPending, 400);
  if (detail.isPending) {
    return (
      <>
        <LoadingStatus />
        {showSkeleton && (
          <div aria-hidden="true" className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-4">
              <Sk w={56} h={56} round />
              <span className="flex flex-col gap-2">
                <Sk w={200} h={22} />
                <Sk w={150} h={13} />
              </span>
            </div>
            <Sk w="100%" h={64} />
            <Sk w="85%" h={13} />
            <Sk w="100%" h={80} />
          </div>
        )}
      </>
    );
  }
  if (detail.isError) return <ErrorState onRetry={() => detail.refetch()} message={apiMessage(detail.error)} />;
  return <DetailBody app={detail.data} onClose={onClose} />;
}

// ── Page ────────────────────────────────────────────────────────────────

export function HrApplicantsPage() {
  usePageMeta('Hồ sơ ứng viên');
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const jobId = params.get('tin') ?? undefined;
  const tabParam = params.get('trang-thai');
  const tab: TabKey = isTab(tabParam) ? tabParam : 'all';
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const apps = useApplications(jobId);
  const showSkeleton = useDelayedFlag(apps.isPending);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key !== 'id' });
  };

  const rows = useMemo(
    () => (apps.data?.applications ?? []).filter((a) => tab === 'all' || a.status === tab),
    [apps.data, tab],
  );
  const counts = apps.data?.counts;
  const tabs: TabItem<TabKey>[] = TABS.map(([key, label]) => ({ key, label, count: counts?.[key] }));

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeading
        title="Hồ sơ ứng viên"
        titleHiddenOnPhone
        subtitle="Mở một hồ sơ để xem CV, gọi hoặc nhắn Zalo cho ứng viên."
        action={
          <label className="relative flex min-h-[46px] items-center gap-2.5 rounded-control border border-field bg-white pl-3.5 pr-9 max-sm:w-full">
            <Icon name="filter" size={16} className="shrink-0 text-slate" />
            <span className="sr-only">Lọc theo vị trí</span>
            <select
              value={jobId ?? ''}
              onChange={(e) => setParam('tin', e.target.value || null)}
              className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm text-navy outline-none sm:min-w-[240px]"
            >
              <option value="">Tất cả vị trí</option>
              {(apps.data?.jobs ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 text-slate" />
          </label>
        }
      />

      <FilterTabs
        items={tabs}
        value={tab}
        onChange={(key) => setParam('trang-thai', key === 'all' ? null : key)}
        label="Lọc theo trạng thái"
        navyOnPhone
        className="border-b border-field max-lg:order-first max-lg:-mx-4 max-lg:-mt-6 max-lg:border-b-0 max-lg:bg-navy max-lg:px-4 max-sm:gap-x-[18px] sm:max-lg:-mx-6 sm:max-lg:px-6"
      />

      {apps.isPending && (
        <>
          <LoadingStatus />
          {showSkeleton && <ListSkeleton />}
        </>
      )}
      {apps.isError && <ErrorState onRetry={() => apps.refetch()} message={apiMessage(apps.error)} />}

      {apps.data && (
        <div className="flex items-start gap-[22px]">
          <ul className="m-0 min-w-0 flex-1 list-none overflow-hidden rounded-card border border-line bg-white p-0">
            {rows.map((row) => (
              <ApplicantRow
                key={row.id}
                row={row}
                current={row.id === selectedId}
                onPick={() => setParam('id', row.id)}
              />
            ))}
            {rows.length === 0 && (
              <li className="px-5 py-10 text-center text-[15px] text-slate">Chưa có hồ sơ ở trạng thái này.</li>
            )}
          </ul>

          {isDesktop && (
            <section
              aria-label="Chi tiết ứng viên"
              className="sticky top-6 w-[min(440px,42%)] shrink-0 rounded-card border border-line bg-white p-7"
            >
              {selectedId ? (
                <ApplicantDetail key={selectedId} id={selectedId} />
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate">
                  <span className="flex rounded-full border border-ring p-3 text-accent">
                    <Icon name="user" size={22} stroke={1.4} />
                  </span>
                  Chọn một hồ sơ bên trái để xem chi tiết.
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {!isDesktop && (
        <Dialog open={!!selectedId} onClose={() => setParam('id', null)} label="Chi tiết ứng viên">
          <div className="max-h-[92dvh] overflow-y-auto px-[18px] pb-[26px] pt-2.5 sm:px-6 sm:pt-6">
            <SheetHandle />
            {selectedId && <ApplicantDetail key={selectedId} id={selectedId} onClose={() => setParam('id', null)} />}
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default HrApplicantsPage;
