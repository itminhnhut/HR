import { Icon, type IconName } from '../../../ui/icons';
import { TONE, type Tone } from './tone';

/** An icon in a coloured square: section headings, numbers and menu items. */
export function IconTile({ icon, tone, size = 40 }: { icon: IconName; tone: Tone; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] ${TONE[tone].tile}`}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} />
    </span>
  );
}
