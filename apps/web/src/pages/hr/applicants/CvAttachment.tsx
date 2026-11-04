import { formatDate, type ApplicationDetailDto, type TemplateKey } from '@careers/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { api } from '../../../api';
import { buttonClass } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';

const INVITES: readonly TemplateKey[] = ['interview_onsite', 'interview_online'];

/**
 * Only a stored file: a pasted job-site address can hold the employer's own key, and must not reach the candidate.
 */
export const carriesCvLink = (app: ApplicationDetailDto, key: TemplateKey) =>
  INVITES.includes(key) && app.hasCv && !app.cvLink;

type CvLink = UseQueryResult<{ url: string; expiresAt: string } | null>;

function linkWords(app: ApplicationDetailDto, link: CvLink): string {
  if (app.cvLink) return 'CV là link nên thư không kèm CV.';
  if (link.isPending) return 'Đang gắn link CV vào thư…';
  if (link.isError) return 'Chưa gắn được link CV. Mở lại thư để thử lại.';
  return link.data ? `Đã có link mở CV trong thư, hạn đến ${formatDate(link.data.expiresAt)}.` : 'Thư chưa có link CV.';
}

/** Says whether the letter carries the CV, since a copied letter takes it along. A file to attach is still a press away. */
export function CvAttachment({
  app,
  templateKey,
  link,
}: {
  app: ApplicationDetailDto;
  templateKey: TemplateKey;
  link: CvLink;
}) {
  if (!INVITES.includes(templateKey) || !app.hasCv) return null;
  const file = app.cvLink ? null : api.hrCvUrl(app.id);
  return (
    <section
      aria-label="CV trong thư"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-line bg-mist px-3 py-2"
    >
      <span className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-sm font-medium text-navy">CV trong thư</span>
        <span role="status" className={`text-xs ${link.isError ? 'text-error' : 'text-slate'}`}>
          {linkWords(app, link)}
        </span>
      </span>
      {file && (
        <a href={file} download={`CV-${app.fullName}.pdf`} className={buttonClass('outline', 'md')}>
          <Icon name="download" size={16} />
          Tải CV
        </a>
      )}
    </section>
  );
}
