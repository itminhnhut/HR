import type { ApplicationRowDto } from '@careers/shared';
import { useDeferredValue, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApplications, useScorePending } from '../../api/queries';
import { useMediaQuery, usePageMeta } from '../../lib/hooks';
import { CloseButton, Dialog, SheetHandle } from '../../ui/Dialog';
import { ErrorState, LoadingStatus, useDelayedFlag } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { AddApplicationDialog } from './applicants/AddApplicationDialog';
import { ApplicantDetail } from './applicants/ApplicantDetail';
import { ApplicantList, ListSkeleton, type RowPick } from './applicants/ApplicantList';
import { ApplicantsToolbar, type ToolbarActions } from './applicants/ApplicantsToolbar';
import { DetailNav } from './applicants/DetailNav';
import { StatusMark } from './applicants/StatusMark';
import { ALL_LOOK, STATUS_STYLE } from './applicants/statusStyle';
import { useApplicantQueue, type TabKey } from './applicants/useApplicantQueue';
import { useQueueShortcuts } from './applicants/useQueueShortcuts';
import { apiMessage, FilterTabs, type TabItem } from './parts';
import { canSendForReview, PickBar, usePicking } from './reviews/PickForReview';
import { SendReviewDialog } from './reviews/SendReviewDialog';
import { ManageSourcesDialog } from './sources/ManageSourcesDialog';

const TAB_KEYS: TabKey[] = ['all', 'new', 'seen', 'interview', 'rejected'];

const isTab = (v: string | null): v is TabKey => TAB_KEYS.some((k) => k === v);

/** Each tab shows its status's icon and word; while active, its colour on the icon, the count and the underline. */
function tabItems(counts: Record<TabKey, number> | undefined): TabItem<TabKey>[] {
  return TAB_KEYS.map((key) => {
    const look = key === 'all' ? ALL_LOOK : STATUS_STYLE[key];
    const count = counts?.[key];
    return {
      key,
      label: look.label,
      count,
      activeBorder: look.underline,
      render: (isActive) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusMark
            look={look}
            count={count}
            iconClass={isActive ? look.activeText : ''}
            countClass={isActive ? `font-bold ${look.activeText}` : 'font-normal text-muted max-lg:text-silver-soft'}
          />
        </span>
      ),
    };
  });
}

/** Everything the list shows is kept in the address, so a link or a reload lands on the same view. */
function useListParams() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key !== 'id' });
  };
  /** Also writes down the tab, so the list does not change under HR when the last "Mới" has been opened. */
  const open = (id: string, tab: TabKey) => {
    const next = new URLSearchParams(params);
    next.set('id', id);
    next.set('trang-thai', tab);
    setParams(next);
  };
  /** What changes who is listed closes the open application, which may not be among them any more. */
  const setListed = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('id');
    setParams(next, { replace: !params.has('id') });
  };
  const typeSearch = (text: string) => {
    setDraft(text);
    if (params.has('id')) setListed('id', null);
  };
  return {
    selectedId: params.get('id'),
    jobId: params.get('tin') ?? undefined,
    tabParam: params.get('trang-thai'),
    source: params.get('nguon') || undefined,
    byMatch: params.get('sap-xep') === 'phu-hop',
    draft,
    typeSearch,
    setParam,
    setListed,
    open,
  };
}

function useApplicantsModel() {
  const list = useListParams();
  const search = useDeferredValue(list.draft.trim());
  const apps = useApplications(list.jobId, search, list.source);
  const all = apps.data?.applications;
  // With unseen applications waiting, the list opens on "Mới"; any tab HR picks is kept in the URL.
  const tab: TabKey = isTab(list.tabParam) ? list.tabParam : (apps.data?.counts.new ?? 0) > 0 ? 'new' : 'all';
  const queue = useApplicantQueue(all, tab, list.selectedId, list.byMatch);
  // CV files without an up-to-date result are scored in the background so the list can be sorted by match. A CV with a
  // percent may still be out of date when the scoring rules changed, and only the server can tell.
  const scoring = useScorePending((all ?? []).some((a) => a.hasCv));
  const picking = usePicking(all ?? []);
  const openRow = (id: string | undefined) => (id ? () => list.open(id, tab) : undefined);
  return {
    ...list,
    search,
    apps,
    tab,
    queue,
    scoring,
    picking,
    goPrev: openRow(queue.prevId),
    goNext: openRow(queue.nextId),
    closeDetail: () => list.setParam('id', null),
  };
}

type Model = ReturnType<typeof useApplicantsModel>;

function pickOf(picking: Model['picking'], row: ApplicationRowDto): RowPick | undefined {
  if (!picking.active) return undefined;
  return { on: picking.ids.has(row.id), blocked: !canSendForReview(row), toggle: () => picking.toggle(row.id) };
}

/** "Đang chấm CV" and the note for an open application that the filters left out of the list. */
function ListNotes({ model, isDesktop }: { model: Model; isDesktop: boolean }) {
  const isHidden = isDesktop && !!model.selectedId && model.queue.position === null && !model.apps.isPlaceholderData;
  return (
    <>
      {model.scoring != null && (
        <span role="status" className="flex-none border-b border-line-soft px-3.5 py-1.5 text-xs text-muted">
          Đang chấm CV, còn {model.scoring} hồ sơ…
        </span>
      )}
      {isHidden && (
        <div className="flex flex-none items-center justify-between gap-2 border-b border-line bg-mist px-3.5 py-1.5 text-xs text-body">
          <span role="status">Hồ sơ đang mở không có trong danh sách đang lọc.</span>
          <button
            type="button"
            onClick={model.closeDetail}
            className="min-h-9 shrink-0 border-0 bg-transparent px-1 font-semibold text-link underline"
          >
            Đóng hồ sơ
          </button>
        </div>
      )}
    </>
  );
}

function ListPanel({ model, isDesktop }: { model: Model; isDesktop: boolean }) {
  const { search, picking } = model;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-white lg:w-[340px] lg:flex-none xl:w-[400px] 2xl:w-[440px]">
      <ListNotes model={model} isDesktop={isDesktop} />
      <ApplicantList
        rows={model.queue.rows}
        selectedId={model.selectedId}
        tab={model.tab}
        emptyMessage={search ? `Không tìm thấy hồ sơ nào cho "${search}".` : 'Chưa có hồ sơ ở trạng thái này.'}
        onOpen={(id) => model.open(id, model.tab)}
        pickFor={(row) => pickOf(picking, row)}
      />
    </div>
  );
}

function Nav({ model }: { model: Model }) {
  return (
    <DetailNav
      position={model.queue.position}
      total={model.queue.rows.length}
      onPrev={model.goPrev}
      onNext={model.goNext}
    />
  );
}

function DetailPanel({ model }: { model: Model }) {
  const { selectedId } = model;
  return (
    <section
      aria-label="Chi tiết ứng viên"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-white"
    >
      {selectedId ? (
        <>
          <div className="absolute right-2 top-1.5 z-20">
            <Nav model={model} />
          </div>
          <ApplicantDetail key={selectedId} id={selectedId} layout="wide" onDeleted={model.closeDetail} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-slate">
          <span className="flex rounded-full border border-ring p-3 text-accent">
            <Icon name="user" size={22} stroke={1.4} />
          </span>
          Chọn một hồ sơ bên trái để xem chi tiết.
        </div>
      )}
    </section>
  );
}

/** The bottom sheet of phones and tablets. */
function DetailSheet({ model }: { model: Model }) {
  const { selectedId } = model;
  return (
    <Dialog open={!!selectedId && !model.picking.active} onClose={model.closeDetail} label="Chi tiết ứng viên">
      <div className="relative flex h-[92dvh] flex-col pt-2.5 sm:pt-4">
        <SheetHandle />
        <div className="absolute right-2 top-3.5 z-20 flex items-center sm:top-4">
          <Nav model={model} />
          <CloseButton onClick={model.closeDetail} className="border-0 bg-tint" />
        </div>
        {selectedId && <ApplicantDetail key={selectedId} id={selectedId} onDeleted={model.closeDetail} />}
      </div>
    </Dialog>
  );
}

function Dialogs({ model, managing, onManaged }: { model: Model; managing: boolean; onManaged: () => void }) {
  const navigate = useNavigate();
  const { picking } = model;
  return (
    <>
      <ManageSourcesDialog open={managing} onClose={onManaged} />
      <SendReviewDialog
        rows={picking.rows}
        open={picking.sending}
        onClose={() => picking.setSending(false)}
        onSent={(batchId) => {
          picking.stop();
          navigate(`/hr/duyet/${batchId}`);
        }}
      />
    </>
  );
}

function PageToolbar({ model, actions }: { model: Model; actions: Omit<ToolbarActions, 'onPickForReview'> }) {
  const { apps, picking } = model;
  const canPick = !picking.active && (apps.data?.applications.length ?? 0) > 0;
  return (
    <ApplicantsToolbar
      filters={{
        search: model.draft,
        onSearch: model.typeSearch,
        onSearchCommit: () => model.setParam('q', model.draft.trim() || null),
        jobId: model.jobId,
        jobs: apps.data?.jobs ?? [],
        onJob: (id) => model.setListed('tin', id),
        source: model.source,
        onSource: (key) => model.setListed('nguon', key),
        byMatch: model.byMatch,
        onByMatch: (checked) => model.setParam('sap-xep', checked ? 'phu-hop' : null),
      }}
      actions={{ ...actions, onPickForReview: canPick ? picking.start : undefined }}
    />
  );
}

function PageContent({ model, isDesktop }: { model: Model; isDesktop: boolean }) {
  const { apps } = model;
  const showSkeleton = useDelayedFlag(apps.isPending);
  return (
    <>
      {apps.isPending && (
        <>
          <LoadingStatus />
          {showSkeleton && <ListSkeleton />}
        </>
      )}
      {apps.isError && <ErrorState onRetry={() => apps.refetch()} message={apiMessage(apps.error)} />}
      {apps.data && (
        <div className="flex min-h-0 flex-1 items-stretch gap-3 lg:overflow-hidden lg:pt-2">
          <ListPanel model={model} isDesktop={isDesktop} />
          {isDesktop && <DetailPanel model={model} />}
        </div>
      )}
    </>
  );
}

export function HrApplicantsPage() {
  usePageMeta('Hồ sơ ứng viên');
  const model = useApplicantsModel();
  const { apps, picking, tab } = model;
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [isAdding, setIsAdding] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  useQueueShortcuts({ isEnabled: isDesktop && !picking.active, onPrev: model.goPrev, onNext: model.goNext });
  const tabs = tabItems(apps.data?.counts);

  return (
    // From 1024px the layout makes `main` exactly the window; this takes what is left in it (a notice above the page
    // included) and only the panes inside scroll.
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:gap-1 lg:overflow-hidden">
      <h1 className="sr-only">Hồ sơ ứng viên</h1>
      <PageToolbar
        model={model}
        actions={{ onAdd: () => setIsAdding(true), onManageSources: () => setIsManaging(true) }}
      />
      <FilterTabs
        items={tabs}
        value={tab}
        onChange={(key) => model.setListed('trang-thai', key)}
        label="Lọc theo trạng thái"
        navyOnPhone
        className="flex-none border-b border-field max-lg:order-first max-lg:-mx-4 max-lg:-mt-6 max-lg:border-b-0 max-lg:bg-navy max-lg:px-4 max-sm:gap-x-[18px] sm:max-lg:-mx-6 sm:max-lg:px-6"
      />
      <PageContent model={model} isDesktop={isDesktop} />
      {picking.active && (
        <PickBar count={picking.rows.length} onCancel={picking.stop} onNext={() => picking.setSending(true)} />
      )}
      <AddApplicationDialog
        open={isAdding}
        onClose={() => setIsAdding(false)}
        onAdded={(id) => {
          setIsAdding(false);
          model.open(id, tab);
        }}
      />
      <Dialogs model={model} managing={isManaging} onManaged={() => setIsManaging(false)} />
      {!isDesktop && <DetailSheet model={model} />}
    </div>
  );
}

export default HrApplicantsPage;
