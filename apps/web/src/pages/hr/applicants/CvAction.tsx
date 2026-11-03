import type { ApplicationDetailDto } from '@careers/shared';
import { api } from '../../../api';
import { isWebLink } from '../../../lib/web-link';
import { Icon } from '../../../ui/icons';

type CvTarget =
  | { kind: 'file'; href: string }
  | { kind: 'link'; href: string }
  /** A stored file, on the demo site that keeps no files. */
  | { kind: 'unavailable' }
  | { kind: 'none' };

/** What "the CV" of this application is. Only http(s) links count: a stored "javascript:" link never gets a href. */
function cvTarget(app: ApplicationDetailDto): CvTarget {
  if (app.cvLink && isWebLink(app.cvLink)) return { kind: 'link', href: app.cvLink };
  if (!app.cvFileName) return { kind: 'none' };
  const href = api.hrCvUrl(app.id);
  return href ? { kind: 'file', href } : { kind: 'unavailable' };
}

/**
 * "Xem CV": the stored file in a new tab, through the address that needs an HR session, or the pasted link.
 * `shape` is the size and layout of the place it stands in. With no CV it says so; `isOptional` leaves it out where
 * the way to add one is already next to it.
 */
export function CvAction({
  app,
  shape,
  isOptional = false,
}: {
  app: ApplicationDetailDto;
  shape: string;
  isOptional?: boolean;
}) {
  const target = cvTarget(app);
  if (target.kind === 'none' && isOptional) return null;
  if (target.kind === 'none' || target.kind === 'unavailable') {
    const isMissing = target.kind === 'none';
    return (
      <span
        aria-disabled="true"
        title={isMissing ? 'Bấm "Thêm CV" trong hồ sơ để thêm.' : undefined}
        className={`${shape} cursor-not-allowed border border-dashed border-silver text-muted`}
      >
        <Icon name="file" size={16} stroke={1.5} />
        {isMissing ? 'Chưa có CV' : 'CV chỉ có ở web thật'}
      </span>
    );
  }
  const isFile = target.kind === 'file';
  return (
    <a
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      title={isFile ? 'Mở CV ở tab mới' : 'Mở link CV ở tab mới'}
      className={`${shape} border border-silver bg-white text-navy hover:bg-mist`}
    >
      <Icon name="file" size={16} stroke={1.5} />
      {isFile ? 'Xem CV' : 'Mở link CV'}
    </a>
  );
}
