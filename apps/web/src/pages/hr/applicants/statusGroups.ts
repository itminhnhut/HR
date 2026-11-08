import type { ApplicationStatus } from '@careers/shared';
import type { IconName } from '../../../ui/icons';
import type { Tone } from '../design/tone';

/** A step of the status block and of the tabs: the statuses, and "Chờ kết quả" (an interview whose time has passed). */
export type Step = ApplicationStatus | 'awaiting';
export type GroupKey = 'intake' | 'interviews' | 'results';

export interface StatusGroup {
  key: GroupKey;
  label: string;
  icon: IconName;
  tone: Tone;
  /** In the order an application moves through them. */
  steps: readonly Step[];
  /** What the group lists and counts: "Chờ kết quả" is part of "Hẹn phỏng vấn", so it is not counted again. */
  statuses: readonly ApplicationStatus[];
}

/** Every status in three stages, so the tabs and the status block fit on one line each. */
export const STATUS_GROUPS: readonly StatusGroup[] = [
  { key: 'intake', label: 'Tiếp nhận', icon: 'inbox', tone: 'sky', steps: ['new', 'seen'], statuses: ['new', 'seen'] },
  {
    key: 'interviews',
    label: 'Phỏng vấn',
    icon: 'calendar',
    tone: 'orange',
    steps: ['scheduling', 'interview', 'awaiting'],
    statuses: ['scheduling', 'interview'],
  },
  {
    key: 'results',
    label: 'Kết quả',
    icon: 'award',
    tone: 'green',
    steps: ['passed', 'hired', 'rejected'],
    statuses: ['passed', 'hired', 'rejected'],
  },
];

export const isGroupKey = (key: string): key is GroupKey => STATUS_GROUPS.some((g) => g.key === key);

/** The group a tab is, or is in; none for "Tất cả". */
export const groupOf = (tab: string): StatusGroup | undefined =>
  STATUS_GROUPS.find((g) => g.key === tab || (g.steps as readonly string[]).includes(tab));
