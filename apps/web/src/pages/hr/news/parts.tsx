import { NEWS_STATUS_LABEL, type NewsStatus } from '@careers/shared';
import { newsCategoryClasses } from '../../../lib/colors';
import type { IconName } from '../../../ui/icons';
import { Pill } from '../design/Pill';
import type { Tone } from '../design/tone';

const STATUS_LOOK: Record<NewsStatus, { tone: Tone; icon: IconName }> = {
  published: { tone: 'green', icon: 'globe' },
  draft: { tone: 'amber', icon: 'pencil' },
  hidden: { tone: 'slate', icon: 'eyeOff' },
};

export function NewsStatusBadge({ status }: { status: NewsStatus }) {
  const { tone, icon } = STATUS_LOOK[status];
  return (
    <Pill tone={tone} icon={icon}>
      {NEWS_STATUS_LABEL[status]}
    </Pill>
  );
}

/** A post's category with a dot in its colour (same colour as on the public site); "—" when none. */
export function CategoryName({ name, empty = '—' }: { name: string | null; empty?: string }) {
  if (!name) return <>{empty}</>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${newsCategoryClasses(name).fill}`} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** "26/10/2026 14:32" in Vietnam time. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(',', '');
}

/** "14:32" in Vietnam time, for "Đã lưu lúc 14:32". */
export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
