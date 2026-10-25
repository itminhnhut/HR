import { addDays, todayInVietnam, type HrJobRowDto } from '@careers/shared';
import { useState } from 'react';
import { useSetDeadline } from '../../api/queries';
import { Button } from '../../ui/Button';
import { CloseButton, Dialog } from '../../ui/Dialog';
import { DeadlineField } from './job-form/DeadlineField';
import { errorMessage } from './parts';

/** "Sửa hạn nộp": a new deadline, which also reopens a job that ended. */
export function JobDeadlineDialog({ job, onClose }: { job: HrJobRowDto | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!job}
      onClose={onClose}
      label="Sửa hạn nộp"
      variant="panel"
      className="sm:!w-[min(560px,calc(100vw-48px))]"
    >
      {job && <DeadlineForm key={job.id} job={job} onClose={onClose} />}
    </Dialog>
  );
}

function DeadlineForm({ job, onClose }: { job: HrJobRowDto; onClose: () => void }) {
  const setDeadline = useSetDeadline();
  // The usual length, already picked; HR changes it with one tap.
  const [deadline, setValue] = useState(addDays(todayInVietnam(), 30));
  const [error, setError] = useState<string | undefined>();
  const reopens = job.status === 'expired' || job.status === 'closed';

  const save = () => {
    if (!deadline) return setError('Chọn hạn nộp mới.');
    setDeadline.mutate({ id: job.id, deadline }, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) });
  };

  return (
    <div className="flex max-h-[92dvh] flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-serif text-[24px] font-medium">Sửa hạn nộp</h2>
          <span className="text-sm text-slate">{job.title}</span>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {reopens && (
        <p className="m-0 rounded-control bg-tint px-4 py-3 text-sm leading-relaxed text-navy">
          Tin đang {job.status === 'closed' ? 'đóng' : 'hết hạn'}. Chọn hạn mới thì tin mở lại và nhận hồ sơ tiếp.
        </p>
      )}
      <DeadlineField
        value={deadline}
        error={error}
        onChange={(v) => {
          setValue(v);
          setError(undefined);
        }}
      />
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="outline" onClick={onClose}>
          Huỷ
        </Button>
        <Button icon="check" disabled={setDeadline.isPending} onClick={save}>
          {setDeadline.isPending ? 'Đang lưu…' : reopens ? 'Lưu và mở lại tin' : 'Lưu hạn nộp'}
        </Button>
      </div>
    </div>
  );
}
