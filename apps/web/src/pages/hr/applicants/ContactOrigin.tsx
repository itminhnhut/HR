import { sourceName, type ApplicationDetailDto } from '@careers/shared';
import { useState } from 'react';
import { useSources } from '../../../api/queries';
import { EditApplicantDrawer } from './EditApplicantDrawer';

/** Where the application came from, who added it, and "Sửa thông tin" for any application. */
export function ContactOrigin({ app }: { app: ApplicationDetailDto }) {
  const sources = useSources().data ?? [];
  const [isEditing, setIsEditing] = useState(false);
  const parts = [
    `Nguồn: ${sourceName(sources, app.source)}`,
    app.referrer && `giới thiệu: ${app.referrer}`,
    app.addedBy && `HR thêm: ${app.addedBy}`,
    app.consentBy && `xác nhận đồng ý: ${app.consentBy}`,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-slate">{parts.join(' · ')}</span>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="border-0 bg-transparent p-0 text-xs text-link underline max-lg:min-h-11"
        >
          Sửa thông tin
        </button>
      </span>
      {/* Mounted while open only, so it starts from the application as it is now. */}
      {isEditing && <EditApplicantDrawer app={app} open onClose={() => setIsEditing(false)} />}
    </div>
  );
}
