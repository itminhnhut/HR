import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from '@careers/shared';
import type { IconName } from '../../../ui/icons';
import type { Tone } from '../design/tone';

/** What every place that names a status needs: the word and the icon, so colour is never the only signal. */
export interface StatusLook {
  label: string;
  icon: IconName;
  /** Its colour family on tabs. */
  tone: Tone;
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
    tone: 'sky',
    filled: 'border-status-new bg-status-new text-white',
    soft: 'border-status-new/30 bg-status-new-soft text-status-new-text',
    hover: 'hover:border-status-new/30 hover:bg-status-new-soft hover:text-status-new-text',
  },
  seen: {
    label: APPLICATION_STATUS_LABEL.seen,
    icon: 'eye',
    tone: 'slate',
    filled: 'border-status-seen bg-status-seen text-white',
    soft: 'border-status-seen/30 bg-status-seen-soft text-status-seen-text',
    hover: 'hover:border-status-seen/30 hover:bg-status-seen-soft hover:text-status-seen-text',
  },
  interview: {
    label: APPLICATION_STATUS_LABEL.interview,
    icon: 'calendar',
    tone: 'orange',
    filled: 'border-status-interview bg-status-interview text-white',
    soft: 'border-status-interview/30 bg-status-interview-soft text-status-interview-text',
    hover: 'hover:border-status-interview/30 hover:bg-status-interview-soft hover:text-status-interview-text',
  },
  passed: {
    label: APPLICATION_STATUS_LABEL.passed,
    icon: 'star',
    tone: 'green',
    filled: 'border-green-700 bg-green-700 text-white',
    soft: 'border-green-300 bg-green-50 text-green-800',
    hover: 'hover:border-green-300 hover:bg-green-50 hover:text-green-800',
  },
  hired: {
    label: APPLICATION_STATUS_LABEL.hired,
    icon: 'briefcase',
    tone: 'teal',
    filled: 'border-teal-700 bg-teal-700 text-white',
    soft: 'border-teal-300 bg-teal-50 text-teal-800',
    hover: 'hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800',
  },
  rejected: {
    label: APPLICATION_STATUS_LABEL.rejected,
    icon: 'xCircle',
    tone: 'rose',
    filled: 'border-status-rejected bg-status-rejected text-white',
    soft: 'border-status-rejected/30 bg-status-rejected-soft text-status-rejected-text',
    hover: 'hover:border-status-rejected/30 hover:bg-status-rejected-soft hover:text-status-rejected-text',
  },
};

/** The "Tất cả" tab: not a status, so a neutral look. */
export const ALL_LOOK: StatusLook = {
  label: 'Tất cả',
  icon: 'list',
  tone: 'blue',
};

/** "Chờ kết quả": not a status of its own, the interviews whose time has passed. White on the fill: 5.0:1. */
export const AWAITING_LOOK: StatusStyle = {
  label: 'Chờ kết quả',
  icon: 'clock',
  tone: 'amber',
  filled: 'border-amber-700 bg-amber-700 text-white',
  soft: 'border-amber-300 bg-amber-50 text-amber-800',
  hover: 'hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800',
};
