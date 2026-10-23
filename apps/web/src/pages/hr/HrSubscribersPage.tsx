import { DEPARTMENTS, formatPhone, formatTimestamp, zaloLink, type SubscriberDto } from '@careers/shared';
import { useMemo, useState } from 'react';
import { useDeleteSubscriber, useSubscribers } from '../../api/queries';
import { copyText, useFlash, usePageMeta } from '../../lib/hooks';
import { EmptyState, ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { apiMessage, errorMessage, FilterTabs, PageHeading, type TabItem } from './parts';

const ALL = 'Tất cả';

/** Zalo link + delete with an inline two-step confirm (never window.confirm). */
function RowActions({ sub, onError }: { sub: SubscriberDto; onError: (msg: string) => void }) {
  const remove = useDeleteSubscriber();
  const [confirming, setConfirming] = useState(false);
  const phone = formatPhone(sub.phone);

  if (confirming) {
    return (
      <span
        role="group"
        aria-label={`Xác nhận xóa ${phone}`}
        className="inline-flex flex-wrap items-center justify-end gap-1.5"
      >
        <span className="text-[13px] text-body">Xóa số này?</span>
        <button
          type="button"
          autoFocus
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(sub.id, {
              onError: (e) => {
                onError(errorMessage(e));
                setConfirming(false);
              },
            })
          }
          className="btn-glow inline-flex min-h-11 items-center rounded-control border-0 bg-error px-3.5 text-sm font-medium text-white disabled:opacity-60 lg:min-h-10"
        >
          {remove.isPending ? 'Đang xóa…' : 'Xóa'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex min-h-11 items-center rounded-control border border-field bg-white px-3.5 text-sm text-body hover:bg-mist lg:min-h-10"
        >
          Hủy
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-end gap-1">
      <a
        href={zaloLink(sub.phone)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-medium no-underline transition-colors hover:bg-tint lg:min-h-10"
      >
        <Icon name="chat" size={16} stroke={1.5} />
        Nhắn Zalo
      </a>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Xóa ${phone}`}
        className="inline-flex size-11 items-center justify-center rounded-control border-0 bg-transparent text-slate transition-colors hover:bg-tint hover:text-error lg:size-10"
      >
        <Icon name="trash" size={17} stroke={1.5} />
      </button>
    </span>
  );
}

const th = 'border-b border-line-soft px-4 py-3 font-medium';
const td = 'border-b border-line-soft px-4 py-3.5';

function SubscribersTable({ rows, onError }: { rows: SubscriberDto[]; onError: (msg: string) => void }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className={`${th} pl-[22px]`}>
              Số Zalo
            </th>
            <th scope="col" className={th}>
              Phòng ban quan tâm
            </th>
            <th scope="col" className={th}>
              Đăng ký từ tin
            </th>
            <th scope="col" className={th}>
              Ngày đăng ký
            </th>
            <th scope="col" className={`${th} pr-[22px] text-right`}>
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sub) => (
            <tr key={sub.id} className="transition-colors hover:bg-hover">
              <td className={`${td} whitespace-nowrap pl-[22px] font-semibold`}>{formatPhone(sub.phone)}</td>
              <td className={td}>{sub.department}</td>
              <td className={`${td} text-body`}>{sub.fromJobTitle ?? '—'}</td>
              <td className={`${td} whitespace-nowrap text-body`}>{formatTimestamp(sub.createdAt)}</td>
              <td className={`${td} py-2.5 pr-[22px] text-right`}>
                <RowActions sub={sub} onError={onError} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubscriberCards({ rows, onError }: { rows: SubscriberDto[]; onError: (msg: string) => void }) {
  return (
    <ul className="m-0 list-none p-0 md:hidden">
      {rows.map((sub) => (
        <li key={sub.id} className="flex flex-col gap-1.5 border-b border-line-soft px-4 pb-2 pt-3.5 last:border-b-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">{formatPhone(sub.phone)}</span>
            <span className="text-xs text-muted">{formatTimestamp(sub.createdAt)}</span>
          </div>
          <span className="text-[13px] text-body">
            {sub.department}
            {sub.fromJobTitle && <span className="text-slate"> · từ tin {sub.fromJobTitle}</span>}
          </span>
          <div className="-mx-3 flex justify-start">
            <RowActions sub={sub} onError={onError} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TableSkeleton() {
  return (
    <div aria-hidden="true">
      {['40%', '52%', '46%', '58%'].map((w) => (
        <div key={w} className="flex items-center gap-6 border-b border-line-soft px-[22px] py-4 last:border-b-0">
          <Sk w={110} h={15} />
          <Sk w={w} h={13} className="flex-1" />
          <Sk w={80} h={13} className="max-md:hidden" />
          <Sk w={100} h={34} />
        </div>
      ))}
    </div>
  );
}

export function HrSubscribersPage() {
  usePageMeta('Người chờ tin');
  const subs = useSubscribers();
  const [tab, setTab] = useState<string>(ALL);
  const [copied, flashCopied] = useFlash();
  const [error, setError] = useState<string | null>(null);
  const showSkeleton = useDelayedFlag(subs.isPending);

  const all = useMemo(() => subs.data ?? [], [subs.data]);
  const rows = useMemo(() => all.filter((s) => tab === ALL || s.department === tab), [all, tab]);
  const tabs: TabItem<string>[] = [ALL, ...DEPARTMENTS].map((d) => ({
    key: d,
    label: d,
    count: all.filter((s) => d === ALL || s.department === d).length,
  }));

  // BR-23: for messaging inside the company only; never exported as a file.
  const copyAll = async () => {
    if (await copyText(rows.map((s) => s.phone).join('\n'))) flashCopied();
  };

  return (
    <>
      <PageHeading
        title="Người chờ tin"
        titleHiddenOnPhone
        subtitle="Ứng viên để lại số Zalo ở các tin đã đóng. Khi đăng tin mới cùng phòng ban, nhắn cho họ trước khi đăng lên trang khác. Mọi số ở đây đều đã tick đồng ý; tự xóa sau 6 tháng nếu không có tin mới. Chỉ dùng để báo việc, không chia sẻ ra ngoài."
      />

      <FilterTabs
        items={tabs}
        value={tab}
        onChange={(key) => {
          setTab(key);
          setError(null);
        }}
        label="Lọc theo phòng ban"
        className="border-b border-field"
      />

      {error && (
        <Notice tone="error" icon="alert">
          <span role="alert">{error}</span>
        </Notice>
      )}

      <div className="rounded-card border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3.5 sm:px-[22px]">
          <span className="text-sm text-slate">
            {subs.data ? `${rows.length} người đang chờ` : 'Đang tải danh sách'}
          </span>
          <button
            type="button"
            onClick={copyAll}
            disabled={rows.length === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-silver bg-white px-3.5 text-sm text-navy transition-colors hover:bg-mist disabled:opacity-60 lg:min-h-10"
          >
            <Icon name={copied ? 'check' : 'copy'} size={16} stroke={1.5} />
            <span aria-live="polite">{copied ? 'Đã sao chép' : 'Sao chép tất cả số'}</span>
          </button>
        </div>
        {subs.isPending && (
          <>
            <LoadingStatus />
            {showSkeleton && <TableSkeleton />}
          </>
        )}
        {subs.isError && <ErrorState onRetry={() => subs.refetch()} message={apiMessage(subs.error)} />}
        {subs.data && rows.length === 0 && (
          <EmptyState icon="bell" title="Chưa có ai chờ tin">
            {tab === ALL
              ? 'Khi ứng viên đăng ký nhận báo ở tin đã đóng, số Zalo sẽ hiện ở đây.'
              : `Chưa có ai đăng ký nhận tin phòng ${tab}.`}
          </EmptyState>
        )}
        {rows.length > 0 && (
          <>
            <SubscribersTable rows={rows} onError={setError} />
            <SubscriberCards rows={rows} onError={setError} />
          </>
        )}
      </div>
    </>
  );
}

export default HrSubscribersPage;
