import type { ApplicationDetailDto } from '@careers/shared';
import { useState } from 'react';
import { ApiError, type CvInput } from '../../../api';
import { useApplicationEdit } from '../../../api/queries';
import { CvPicker } from '../../../site/CvPicker';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { shortTime } from '../reviews/reviewModel';

export function ReplaceCv({ app, onDone }: { app: ApplicationDetailDto; onDone: () => void }) {
  const { replaceCv } = useApplicationEdit(app.id);
  const [cv, setCv] = useState<CvInput | null>(null);
  const fieldError = replaceCv.error instanceof ApiError ? replaceCv.error.fieldErrors.cv : undefined;
  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-line bg-white p-3.5">
      <CvPicker
        onChange={setCv}
        error={fieldError}
        linkHint="Link chỉ được lưu lại, hệ thống không đọc nội dung. Muốn chấm % khớp, hãy tải file PDF."
      />
      {replaceCv.error && !fieldError && (
        <span role="alert" className="text-[13px] text-error">
          {errorMessage(replaceCv.error)}
        </span>
      )}
      <span className="flex gap-2">
        <Button
          size="sm"
          className="max-lg:min-h-11"
          disabled={!cv || replaceCv.isPending}
          onClick={() => cv && replaceCv.mutate(cv, { onSuccess: onDone })}
        >
          {replaceCv.isPending ? 'Đang lưu…' : 'Lưu CV'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="max-lg:min-h-11">
          Huỷ
        </Button>
      </span>
      <span className="text-xs text-muted">
        CV cũ sẽ bị xoá, lịch sử vẫn ghi lại tên file. Hệ thống chấm lại % khớp.
      </span>
    </div>
  );
}

function History({ app }: { app: ApplicationDetailDto }) {
  if (app.cvHistory.length === 0) return null;
  return (
    <details className="text-[13px] text-slate">
      <summary className="cursor-pointer text-link max-lg:flex max-lg:min-h-11 max-lg:items-center">
        Lịch sử CV ({app.cvHistory.length})
      </summary>
      <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
        {app.cvHistory.map((h) => (
          <li key={h.at}>
            {shortTime(h.at)} · {h.by} đổi CV{h.previous ? ` (trước đó: ${h.previous})` : ' (trước đó chưa có CV)'}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** "CV": what is on file, add or replace it, its history (spec-cv-intake.md). */
export function CvPanel({ app }: { app: ApplicationDetailDto }) {
  const [isEditing, setIsEditing] = useState(false);
  const current = app.cvFileName && !app.cvLink ? app.cvFileName : app.cvLink;
  const latest = app.cvHistory[0];
  return (
    <section aria-label="CV" className="flex min-w-0 flex-col gap-2 rounded-control bg-mist px-3 py-2">
      {latest?.by === 'Ứng viên' && (
        <span className="flex items-center gap-2 rounded-control border border-status-new/30 bg-status-new-soft px-3 py-1.5 text-[13px] font-medium text-status-new-text">
          <Icon name="upload" size={15} /> Ứng viên cập nhật CV lúc {shortTime(latest.at)}
        </span>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <Icon name="file" size={16} className="shrink-0 text-accent" />
        <span className={`min-w-0 flex-1 truncate text-[13px] ${current ? 'font-medium text-navy' : 'text-error'}`}>
          {current ?? 'Chưa có CV'}
        </span>
        {!isEditing && (
          <Button
            size="sm"
            variant="outline"
            icon={current ? 'pencil' : 'plus'}
            onClick={() => setIsEditing(true)}
            className="shrink-0 whitespace-nowrap max-lg:min-h-11"
          >
            {current ? 'Đổi CV' : 'Thêm CV'}
          </Button>
        )}
      </div>
      {isEditing && <ReplaceCv app={app} onDone={() => setIsEditing(false)} />}
      <History app={app} />
    </section>
  );
}
