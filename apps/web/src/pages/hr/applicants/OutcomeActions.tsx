import {
  isAwaitingResult,
  rejectReasonLabel,
  type ApplicationDetailDto,
  type ApplicationStatus,
  type RejectReason,
} from '@careers/shared';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/icons';

interface Actions {
  busy: boolean;
  onStatus: (status: ApplicationStatus) => void;
  onReject: (reason?: RejectReason) => void;
}

function Bar({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex flex-wrap items-center gap-2 text-[13px] text-slate">
      <span className="font-medium text-navy">{title}</span>
      {children}
    </div>
  );
}

/** The next step once the interview is over, so HR need not know the order of the statuses. */
export function OutcomeActions({ app, busy, onStatus, onReject }: { app: ApplicationDetailDto } & Actions) {
  if (app.status === 'rejected' && app.rejectReason) {
    return (
      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] text-slate">
        <Icon name="info" size={14} className="shrink-0" />
        Lý do: <b className="font-semibold text-navy">{rejectReasonLabel(app.rejectReason)}</b>
        {app.rejectNote && <span>· {app.rejectNote}</span>}
      </p>
    );
  }
  if (app.status === 'passed') {
    return (
      <Bar title="Đã đạt, tiếp theo:">
        <Button size="sm" variant="success" icon="briefcase" disabled={busy} onClick={() => onStatus('hired')}>
          Đã nhận việc
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onReject('candidate_declined')}>
          Ứng viên từ chối
        </Button>
      </Bar>
    );
  }
  if (!isAwaitingResult(app, new Date())) return null;
  return (
    <Bar title="Kết quả phỏng vấn:">
      <Button size="sm" variant="success" icon="check" disabled={busy} onClick={() => onStatus('passed')}>
        Đạt
      </Button>
      <Button size="sm" variant="outline" icon="xCircle" disabled={busy} onClick={() => onReject()}>
        Không đạt
      </Button>
      <Button size="sm" variant="outline" icon="clock" disabled={busy} onClick={() => onReject('no_show')}>
        Không đến
      </Button>
    </Bar>
  );
}
