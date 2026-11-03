import { Icon, type IconName } from '../../../ui/icons';
import type { MatchTab } from './cvMatchLines';
import { MARK_STROKE } from './StatusMark';

/** White on each fill: ok 6.3:1, error 5.2:1, slate 6.0:1. The zero badge: muted on tint 4.7:1. */
const VERDICT: Record<MatchTab, { icon: IconName; tone: string; fill: string }> = {
  met: { icon: 'check', tone: 'text-ok', fill: 'bg-ok' },
  unmet: { icon: 'x', tone: 'text-error', fill: 'bg-error' },
  skipped: { icon: 'minusCircle', tone: 'text-slate', fill: 'bg-slate' },
};

export function VerdictIcon({
  tab,
  isMuted = false,
  className = '',
}: {
  tab: MatchTab;
  isMuted?: boolean;
  className?: string;
}) {
  const { icon, tone } = VERDICT[tab];
  return (
    <Icon
      name={icon}
      size={14}
      stroke={MARK_STROKE}
      className={`shrink-0 ${isMuted ? 'text-muted' : tone} ${className}`}
    />
  );
}

/** The number, filled in the verdict's colour; a zero stays quiet. */
export function VerdictCount({ tab, count }: { tab: MatchTab; count: number }) {
  return (
    <span
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[13px] font-bold ${count > 0 ? `${VERDICT[tab].fill} text-white` : 'bg-tint text-muted'}`}
    >
      {count}
    </span>
  );
}
