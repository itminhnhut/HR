import type { CandidateApplicationDto } from '@careers/shared';
import { useState } from 'react';
import { ApiError, type CvInput } from '../../api';
import { useCandidateReplaceCv } from '../../api/queries';
import { CvPicker } from '../../site/CvPicker';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import { shortTime } from '../hr/reviews/reviewModel';
import { errorText } from './candidateUi';

/**
 * "Cập nhật CV" of an application already sent (spec-cv-intake.md): while HR has not decided and the job is open,
 * up to 3 times. Otherwise the reason, so the candidate knows to contact HR instead.
 */
export function CvUpdate({ app, savedFileName }: { app: CandidateApplicationDto; savedFileName: string | null }) {
  const replace = useCandidateReplaceCv();
  const [open, setOpen] = useState(false);
  const [cv, setCv] = useState<CvInput | null>(null);
  const fieldError = replace.error instanceof ApiError ? replace.error.fieldErrors.cv : undefined;
  const changed = app.cvChangedAt && (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ok">
      <Icon name="check" size={14} /> Bạn đã cập nhật CV lúc {shortTime(app.cvChangedAt)}
    </span>
  );
  if (app.cvBlock) {
    return (
      <div className="flex flex-col gap-1">
        {changed}
        <span className="text-[13px] text-muted">{app.cvBlock}</span>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button size="sm" variant="outline" icon="upload" onClick={() => setOpen(true)}>
          {app.hasCv ? 'Cập nhật CV' : 'Gửi CV'}
        </Button>
        {changed}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-line bg-mist p-3.5">
      <span className="text-sm font-medium text-navy">CV mới cho vị trí này</span>
      <CvPicker onChange={setCv} error={fieldError} savedFileName={savedFileName} />
      {replace.error && !fieldError && (
        <span role="alert" className="text-[13px] text-error">
          {errorText(replace.error, 'cv', 'Chưa gửi được CV, thử lại sau ít phút.')}
        </span>
      )}
      <span className="flex gap-2">
        <Button
          size="sm"
          disabled={!cv || replace.isPending}
          onClick={() => cv && replace.mutate({ applicationId: app.id, cv }, { onSuccess: () => setOpen(false) })}
        >
          {replace.isPending ? 'Đang gửi…' : 'Gửi CV mới'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Huỷ
        </Button>
      </span>
      <span className="text-xs text-muted">CV mới thay CV cũ của hồ sơ này. HR sẽ thấy bạn vừa cập nhật.</span>
    </div>
  );
}
