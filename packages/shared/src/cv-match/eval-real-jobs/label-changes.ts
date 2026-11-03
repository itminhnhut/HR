/**
 * Every label or tier corrected after the first run, with the reason. labels.lock.txt holds the hashes of the label
 * files as frozen before that run. A correction may only fix a recruiter's mistake visible from the CV and the ad;
 * bending a label to match the bot is not allowed.
 */
export interface LabelChange {
  cvId: string;
  key: string;
  from: string;
  to: string;
  reason: string;
}

export const LABEL_CHANGES: readonly LabelChange[] = [];
