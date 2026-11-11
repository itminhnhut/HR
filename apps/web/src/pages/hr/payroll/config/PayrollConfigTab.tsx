import { BadgeCheck, FileText, Receipt, Scale, Search, ShieldCheck, Wallet, X, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorState } from '../../../../ui/feedback';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../../parts';
import { showWhenOffScreen } from '../../timesheet/ConfigTab';
import { useRegions } from '../../timesheet/queries';
import { TabSkeleton } from '../../timesheet/skeletons';
import { monthKeyOf } from '../payrollModel';
import { PeriodControl } from '../PeriodControl';
import { useProfiles } from '../profiles/profileQueries';
import { usePayrollAddress } from '../usePayrollAddress';
import {
  buildItems,
  changedCount,
  CONFIG_GROUPS,
  filterItems,
  fromWords,
  isConfigGroup,
  type ConfigGroup,
  type ConfigItem,
} from './configModel';
import { AddEntry, EntryActions } from './CatalogueEditor';
import { entryIdOf } from './catalogueModel';
import { useSettingsMonth } from './configQueries';
import { SettingItem } from './SettingItem';

/**
 * Cấu hình lương (spec 11.6): menu on the left as in Chấm công, the month viewed on top (the current pay month unless
 * `?ky=` says otherwise), every setting with its default and what that month uses. `?muc=` keeps the group,
 * `?tim=` the search, `?doi=1` "Chỉ mục đã đổi".
 */

const ICONS: Record<ConfigGroup, { icon: LucideIcon; tone: string }> = {
  'khoan-luong': { icon: Wallet, tone: 'text-blue-600' },
  'loai-hd': { icon: FileText, tone: 'text-green-600' },
  'bao-hiem': { icon: ShieldCheck, tone: 'text-rose-600' },
  thue: { icon: Receipt, tone: 'text-amber-600' },
  'quy-tac': { icon: Scale, tone: 'text-indigo-600' },
};

function GroupLink(p: { id: ConfigGroup; label: string; count: number; isOn: boolean; onPick: () => void }) {
  const { icon: Icon, tone } = ICONS[p.id];
  return (
    <button
      ref={p.isOn ? showWhenOffScreen : undefined}
      type="button"
      aria-current={p.isOn ? 'page' : undefined}
      onClick={p.onPick}
      className={`flex h-11 shrink-0 items-center gap-2.5 rounded-md px-3 text-left text-sm font-medium whitespace-nowrap lg:h-10 ${p.isOn ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      <Icon className={`size-4 shrink-0 ${tone}`} />
      <span className="flex-1">{p.label}</span>
      {p.count > 0 && (
        <span
          title="Mục đã đổi"
          className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 tabular-nums"
        >
          {p.count}
        </span>
      )}
    </button>
  );
}

/** The engine's menu areas (`configLink` of the grid's "Mở cấu hình") land on the group that holds them. */
const AREA_GROUP: Readonly<Record<string, ConfigGroup>> = {
  'tham-so': 'bao-hiem',
  'tuy-chon': 'quy-tac',
  'khu-vuc': 'bao-hiem',
};

function useConfigAddress() {
  const address = usePayrollAddress();
  const [params, setParams] = useSearchParams();
  const raw = params.get('muc');
  const set = (name: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  return {
    address,
    group: isConfigGroup(raw) ? raw : (AREA_GROUP[raw ?? ''] ?? 'khoan-luong'),
    /** `?khoa=`: the setting a link points at, opened and marked. */
    focusKey: params.get('khoa'),
    onlyChanged: params.get('doi') === '1',
    /** One write: two in a row would each start from the same address, and the second would undo the first. */
    pickGroup: (g: ConfigGroup) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('muc', g);
          next.delete('khoa');
          next.delete('tim');
          return next;
        },
        { replace: true },
      ),
    setOnlyChanged: (on: boolean) => set('doi', on ? '1' : ''),
  };
}

/** Items in order, with a heading wherever the component or contract type (or, when searching, the group) changes. */
function headingOf(item: ConfigItem, isSearching: boolean): string {
  const group = CONFIG_GROUPS.find((g) => g.id === item.group)?.label ?? '';
  if (item.entry) return isSearching ? `${group} › ${item.entry}` : item.entry;
  return isSearching ? group : '';
}

/** Đổi tên / Ngừng dùng of the pay component or contract type a section is about. */
function HeadingActions({ item, month }: { item: ConfigItem | undefined; month: string }) {
  const id = item ? entryIdOf(item.key) : null;
  if (!item?.entry || !id || (item.group !== 'khoan-luong' && item.group !== 'loai-hd')) return null;
  const name = item.entry.split(' · đã ngừng dùng')[0] ?? item.entry;
  return <EntryActions kind={item.group === 'khoan-luong' ? 'khoan' : 'loai-hd'} id={id} name={name} month={month} />;
}

function ItemList(p: { items: readonly ConfigItem[]; month: string; isSearching: boolean; focusKey: string | null }) {
  const people = useProfiles().data?.people ?? [];
  const [openKey, setOpenKey] = useState<string | null>(p.focusKey);
  if (p.items.length === 0)
    return <p className="ts-card m-0 px-4 py-8 text-center text-sm text-slate-600">Không có mục phù hợp.</p>;
  const sections = p.items.reduce<{ heading: string; items: ConfigItem[] }[]>((acc, item) => {
    const heading = headingOf(item, p.isSearching);
    const last = acc.at(-1);
    return last && last.heading === heading
      ? [...acc.slice(0, -1), { heading, items: [...last.items, item] }]
      : [...acc, { heading, items: [item] }];
  }, []);
  return (
    <div className="flex flex-col gap-3">
      {sections.map((s, i) => (
        <section key={`${s.heading}-${i}`} aria-label={s.heading || 'Mục cấu hình'} className="ts-card overflow-hidden">
          {s.heading && (
            <h3 className="m-0 flex flex-wrap items-center gap-2 border-b bg-slate-50 px-4 py-2 text-sm font-semibold">
              <span className="min-w-0 flex-1">{s.heading}</span>
              <HeadingActions item={s.items[0]} month={p.month} />
            </h3>
          )}
          <ul className="m-0 list-none p-0">
            {s.items.map((item) => (
              <SettingItem
                key={item.key}
                item={item}
                month={p.month}
                people={people}
                isOpen={openKey === item.key}
                isFocus={p.focusKey === item.key}
                onToggle={() => setOpenKey(openKey === item.key ? null : item.key)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Toolbar(p: { config: ReturnType<typeof useConfigAddress>; readOn: string }) {
  const { address, onlyChanged } = p.config;
  return (
    <div className="ts-card flex flex-wrap items-center gap-2 p-2">
      <PeriodControl year={address.period.year} month={address.period.month} onPeriod={address.setPeriod} />
      <span className="relative max-md:w-full">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          aria-label="Tìm mục cấu hình"
          value={address.filters.query}
          onChange={(e) => address.setQuery(e.target.value)}
          placeholder="Tìm mục, vd: tiền cơm"
          className="ts-field w-56 bg-white pl-8 max-md:w-full"
        />
        {address.filters.query && (
          <button
            type="button"
            aria-label="Xoá tìm"
            onClick={address.clearSearch}
            className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        )}
      </span>
      <button
        type="button"
        aria-pressed={onlyChanged}
        onClick={() => p.config.setOnlyChanged(!onlyChanged)}
        className={`ts-field inline-flex items-center gap-1.5 rounded-md border px-3 text-sm font-medium whitespace-nowrap ${onlyChanged ? 'border-blue-600 bg-blue-50 text-blue-800' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
      >
        <BadgeCheck className="size-4" />
        Chỉ mục đã đổi
      </button>
      <span className="text-xs text-slate-600 lg:ml-auto">{p.readOn}</span>
    </div>
  );
}

export function PayrollConfigTab() {
  const config = useConfigAddress();
  const { address, onlyChanged, focusKey } = config;
  const month = monthKeyOf(address.period.year, address.period.month);
  const view = useSettingsMonth(month);
  // Chấm công's regions: each has its own minimum-wage zone (Bảo hiểm).
  const regions = useRegions().data;
  const items = useMemo(() => (view.data ? buildItems(view.data, regions ?? []) : []), [view.data, regions]);
  const group = items.find((i) => i.key === focusKey)?.group ?? config.group;
  const query = address.filters.query;
  const shown = useMemo(() => filterItems(items, { group, query, onlyChanged }), [items, group, query, onlyChanged]);
  const readOn = view.data
    ? `Xem cấu hình áp dụng cho ${fromWords(month)} · BH theo ${fromWords(view.data.insuranceDate)} · thuế theo ngày chi ${fromWords(view.data.payDate)}`
    : '';
  const body = () => {
    if (view.isPending) return <TabSkeleton />;
    if (view.isError)
      return (
        <div className="ts-site-tokens">
          <ErrorState onRetry={() => void view.refetch()} message={errorMessage(view.error)} />
        </div>
      );
    const kind = group === 'khoan-luong' ? 'khoan' : group === 'loai-hd' ? 'loai-hd' : null;
    return (
      <>
        <ItemList
          key={`${month}-${group}-${focusKey ?? ''}`}
          items={shown}
          month={month}
          isSearching={query.trim() !== ''}
          focusKey={focusKey}
        />
        {kind && !query.trim() && <AddEntry key={`${kind}-${month}`} kind={kind} view={view.data} />}
      </>
    );
  };
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Nhóm cấu hình" className="ts-card flex gap-1 overflow-x-auto p-2 lg:flex-col">
        {CONFIG_GROUPS.map((g) => (
          <GroupLink
            key={g.id}
            id={g.id}
            label={g.label}
            count={changedCount(items, g.id)}
            isOn={g.id === group && !query.trim()}
            onPick={() => config.pickGroup(g.id)}
          />
        ))}
      </nav>
      <div className="flex min-w-0 flex-col gap-3">
        <Toolbar config={config} readOn={readOn} />
        {body()}
      </div>
    </div>
  );
}
