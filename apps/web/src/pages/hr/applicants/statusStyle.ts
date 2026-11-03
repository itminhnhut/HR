import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from '@careers/shared';
import type { IconName } from '../../../ui/icons';

/** What every place that names a status needs: the word and the icon, so colour is never the only signal. */
export interface StatusLook {
  label: string;
  icon: IconName;
  /** Icon and count of the active tab. From 1024px: below that the tabs stand on navy and stay white. */
  activeText: string;
  /** The underline of the active tab. */
  underline: string;
}

export interface StatusStyle extends StatusLook {
  /** The current status in the status block. */
  filled: string;
  /** A small pill, in the list. */
  soft: string;
  /** A status that could be chosen, on hover. */
  hover: string;
}

/** One look for each application status, everywhere in HR. The colours and their contrast: styles.css. */
export const STATUS_STYLE: Record<ApplicationStatus, StatusStyle> = {
  new: {
    label: APPLICATION_STATUS_LABEL.new,
    icon: 'bell',
    activeText: 'lg:text-status-new-text',
    underline: 'border-status-new',
    filled: 'border-status-new bg-status-new text-white',
    soft: 'border-status-new/30 bg-status-new-soft text-status-new-text',
    hover: 'hover:border-status-new/30 hover:bg-status-new-soft hover:text-status-new-text',
  },
  seen: {
    label: APPLICATION_STATUS_LABEL.seen,
    icon: 'eye',
    activeText: 'lg:text-status-seen-text',
    underline: 'border-status-seen',
    filled: 'border-status-seen bg-status-seen text-white',
    soft: 'border-status-seen/30 bg-status-seen-soft text-status-seen-text',
    hover: 'hover:border-status-seen/30 hover:bg-status-seen-soft hover:text-status-seen-text',
  },
  interview: {
    label: APPLICATION_STATUS_LABEL.interview,
    icon: 'calendar',
    activeText: 'lg:text-status-interview-text',
    underline: 'border-status-interview',
    filled: 'border-status-interview bg-status-interview text-white',
    soft: 'border-status-interview/30 bg-status-interview-soft text-status-interview-text',
    hover: 'hover:border-status-interview/30 hover:bg-status-interview-soft hover:text-status-interview-text',
  },
  rejected: {
    label: APPLICATION_STATUS_LABEL.rejected,
    icon: 'xCircle',
    activeText: 'lg:text-status-rejected-text',
    underline: 'border-status-rejected',
    filled: 'border-status-rejected bg-status-rejected text-white',
    soft: 'border-status-rejected/30 bg-status-rejected-soft text-status-rejected-text',
    hover: 'hover:border-status-rejected/30 hover:bg-status-rejected-soft hover:text-status-rejected-text',
  },
};

/** The "Tất cả" tab: not a status, so a neutral look. */
export const ALL_LOOK: StatusLook = {
  label: 'Tất cả',
  icon: 'list',
  activeText: 'lg:text-navy',
  underline: 'border-navy',
};
