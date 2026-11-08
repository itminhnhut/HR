import type { ApplicationStatus } from '@careers/shared';
import { Icon } from '../../../ui/icons';
import { TONE } from '../design/tone';
import { FilterTabs, type TabItem } from '../parts';
import { groupOf, STATUS_GROUPS, type StatusGroup } from './statusGroups';
import { ALL_LOOK, AWAITING_LOOK, STATUS_STYLE } from './statusStyle';
import type { TabKey } from './useApplicantQueue';

type Counts = Partial<Record<TabKey, number>> | undefined;

const sumOf = (counts: NonNullable<Counts>, statuses: readonly ApplicationStatus[]) =>
  statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);
const lookOf = (step: StatusGroup['steps'][number]) => (step === 'awaiting' ? AWAITING_LOOK : STATUS_STYLE[step]);

/** The statuses of the picked group, as small pills under the group tabs: "Cả nhóm" first. */
function GroupSteps({
  group,
  counts,
  value,
  onChange,
}: {
  group: StatusGroup;
  counts: Counts;
  value: TabKey;
  onChange: (key: TabKey) => void;
}) {
  const items: TabItem<TabKey>[] = [
    {
      key: group.key,
      label: 'Cả nhóm',
      icon: group.icon,
      tone: group.tone,
      count: counts && sumOf(counts, group.statuses),
    },
    ...group.steps.map((step) => ({
      key: step,
      label: lookOf(step).label,
      icon: lookOf(step).icon,
      tone: lookOf(step).tone,
      count: counts?.[step],
    })),
  ];
  return (
    <div
      role="group"
      aria-label="Trạng thái trong nhóm"
      className="scroll-fade-x flex gap-2 overflow-x-auto py-2 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const isOn = item.key === value;
        const tone = TONE[item.tone ?? 'blue'];
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={isOn}
            onClick={() => onChange(item.key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm lg:min-h-8 ${isOn ? `${tone.underline} bg-white font-semibold text-navy` : 'border-line bg-white text-slate hover:border-silver hover:text-navy'}`}
          >
            {item.icon && <Icon name={item.icon} size={14} className={tone.text} />}
            {item.label}{' '}
            {item.count != null && (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${isOn && item.count > 0 ? tone.solid : 'bg-tint text-slate'}`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The status filter in two rows: "Tất cả" and the three stages, then the statuses of the stage picked.
 * Nine tabs in one row no longer fit next to the list.
 */
export function StatusTabs({
  counts,
  value,
  onChange,
}: {
  counts: Counts;
  value: TabKey;
  onChange: (key: TabKey) => void;
}) {
  const group = groupOf(value);
  const top: TabItem<TabKey>[] = [
    { key: 'all', label: ALL_LOOK.label, icon: ALL_LOOK.icon, tone: ALL_LOOK.tone, count: counts?.all },
    ...STATUS_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      icon: g.icon,
      tone: g.tone,
      count: counts && sumOf(counts, g.statuses),
    })),
  ];
  return (
    <div role="group" aria-label="Lọc theo trạng thái" className="flex flex-none flex-col">
      <FilterTabs
        items={top}
        value={group?.key ?? 'all'}
        onChange={onChange}
        label="Nhóm trạng thái"
        className="border-b border-line max-sm:gap-x-[18px]"
      />
      {group && <GroupSteps group={group} counts={counts} value={value} onChange={onChange} />}
    </div>
  );
}
