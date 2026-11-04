import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../../ui/icons';
import { TONE, type Tone } from './tone';

/** A state in words: always the word and an icon, so colour is never the only signal. */
export function Pill({ tone, icon, children }: { tone: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[tone].pill}`}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}
