import { formatTimestamp, type ApplicationRowDto, type ApplicationStatus } from '@careers/shared';
import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApplications, useScorePending } from '../../api/queries';
import { useMediaQuery, usePageMeta } from '../../lib/hooks';
import { Dialog, SheetHandle } from '../../ui/Dialog';
import { ErrorState, LoadingStatus, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { ApplicantDetail } from './applicants/ApplicantDetail';
import { percentTone } from './applicants/CvMatch';
import { interviewLabel } from './applicants/InterviewField';
import { apiMessage, Avatar, FilterTabs, PageHeading, type TabItem } from './parts';

type TabKey = ApplicationStatus | 'all';

const TABS: [TabKey, string][] = [
  ['all', 'Tất cả'],
  ['new', 'Mới'],
  ['seen', 'Đã xem'],
  ['interview', 'Hẹn phỏng vấn'],
  ['rejected', 'Chưa phù hợp'],
];

const isTab = (v: string | null): v is TabKey => TABS.some(([k]) => k === v);

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
          {row.status === 'interview' && row.interviewAt && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-navy">
              <Icon name="calendar" size={12} />
              {interviewLabel(row.interviewAt)}
            </span>
          )}
          {row.noteLine && <span className="truncate text-xs italic text-muted">“{row.noteLine}”</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <StatusText status={row.status} />
          <span className="text-xs text-muted">{formatTimestamp(row.createdAt)}</span>
          {row.matchPercent != null && (
            <span
              title="Phù hợp với yêu cầu (chấm CV tự động)"
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${percentTone(row.matchPercent)}`}
            >
              {row.matchPercent}%
            </span>
          )}
          <span
            title={row.hasCv ? 'Có CV' : 'Chưa có CV'}
            className={`inline-flex items-center gap-1 text-[11px] ${row.hasCv ? 'text-accent' : 'text-error'}`}
          >
            <Icon name="file" size={12} />
            {row.hasCv ? 'CV' : 'Không CV'}
          </span>
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]"
    >
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

// ── Page ────────────────────────────────────────────────────────────────

export function HrApplicantsPage() {
  usePageMeta('Hồ sơ ứng viên');
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const jobId = params.get('tin') ?? undefined;
  const tabParam = params.get('trang-thai');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const search = useDeferredValue(draft.trim());
  const apps = useApplications(jobId, search);
  // With unseen applications waiting, the list opens on "Mới"; any tab HR picks is kept in the URL.
  const tab: TabKey = isTab(tabParam) ? tabParam : (apps.data?.counts.new ?? 0) > 0 ? 'new' : 'all';
  const showSkeleton = useDelayedFlag(apps.isPending);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key !== 'id' });
  };

  const byMatch = params.get('sap-xep') === 'phu-hop';
  const rows = useMemo(() => {
    // The open application stays in the list after its status changes, so HR still sees where they are.
    const list = (apps.data?.applications ?? []).filter(
      (a) => tab === 'all' || a.status === tab || a.id === selectedId,
    );
    // Best match first; applications not scored yet go last, newest first among them.
    return byMatch ? [...list].sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1)) : list;
  }, [apps.data, tab, byMatch, selectedId]);
  const counts = apps.data?.counts;
  const at = rows.findIndex((r) => r.id === selectedId);
  const nextId = at >= 0 ? rows[at + 1]?.id : rows[0]?.id;
  // CV files without a percent yet are scored in the background so the list can be sorted by match.
  const scoring = useScorePending((apps.data?.applications ?? []).some((a) => a.hasCv && a.matchPercent == null));
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

      <label className="relative flex min-h-[46px] items-center gap-2.5 rounded-control border border-field bg-white px-3.5 lg:max-w-[420px]">
        <Icon name="search" size={17} className="shrink-0 text-slate" />
        <span className="sr-only">Tìm hồ sơ</span>
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setParam('q', draft.trim() || null)}
          placeholder="Tìm theo tên hoặc số điện thoại"
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-navy outline-none placeholder:text-placeholder"
        />
      </label>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={byMatch}
            onChange={(e) => setParam('sap-xep', e.target.checked ? 'phu-hop' : null)}
            className="size-[18px] accent-accent"
          />
          Xếp theo % phù hợp với yêu cầu
        </label>
        {scoring != null && (
          <span role="status" className="text-xs text-muted">
            Đang chấm CV, còn {scoring} hồ sơ…
          </span>
        )}
      </div>

      <FilterTabs
        items={tabs}
        value={tab}
        onChange={(key) => setParam('trang-thai', key)}
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
          <ul className="m-0 min-w-0 flex-1 list-none overflow-hidden rounded-card border border-line bg-white p-0 lg:w-[380px] lg:flex-none xl:w-[420px]">
            {rows.map((row) => (
              <ApplicantRow
                key={row.id}
                row={row}
                current={row.id === selectedId}
                onPick={() => setParam('id', row.id)}
              />
            ))}
            {rows.length === 0 && (
              <li className="px-5 py-10 text-center text-[15px] text-slate">
                {search ? `Không tìm thấy hồ sơ nào cho "${search}".` : 'Chưa có hồ sơ ở trạng thái này.'}
              </li>
            )}
          </ul>

          {isDesktop && (
            <section
              aria-label="Chi tiết ứng viên"
              className="sticky top-6 min-w-0 flex-1 rounded-card border border-line bg-white p-7 xl:p-9"
            >
              {selectedId ? (
                <div className="max-w-[820px]">
                  <ApplicantDetail
                    key={selectedId}
                    id={selectedId}
                    onDeleted={() => setParam('id', null)}
                    onNext={nextId ? () => setParam('id', nextId) : undefined}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-slate">
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
            {selectedId && (
              <ApplicantDetail
                key={selectedId}
                id={selectedId}
                onClose={() => setParam('id', null)}
                onDeleted={() => setParam('id', null)}
                onNext={nextId ? () => setParam('id', nextId) : undefined}
              />
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default HrApplicantsPage;
