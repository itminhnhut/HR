import type { IconName } from '../../../ui/icons';
import { IconTile } from './IconTile';
import type { Tone } from './tone';

/** The heading of a block in a page: its icon, its colour and its name. */
export function SectionTitle({ icon, tone, children }: { icon: IconName; tone: Tone; children: string }) {
  return (
    <span className="flex items-center gap-2.5 font-serif text-lg text-navy">
      <IconTile icon={icon} tone={tone} size={32} />
      {children}
    </span>
  );
}
