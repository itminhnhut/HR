import { Icon } from '../../../ui/icons';
import type { StatusLook } from './statusStyle';

/** One line weight for every status and verdict icon. */
export const MARK_STROKE = 2;

/** A status as HR sees it everywhere: its icon, its word, and a count where there is one. */
export function StatusMark({
  look,
  count,
  size = 14,
  iconClass = '',
  countClass = '',
}: {
  look: StatusLook;
  count?: number;
  size?: number;
  iconClass?: string;
  countClass?: string;
}) {
  return (
    <>
      <Icon name={look.icon} size={size} stroke={MARK_STROKE} className={`shrink-0 ${iconClass}`} />
      <span>{look.label}</span>
      {count != null && (
        <>
          {' '}
          <span className={countClass}>{count}</span>
        </>
      )}
    </>
  );
}
