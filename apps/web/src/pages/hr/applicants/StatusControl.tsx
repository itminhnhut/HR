import {
  APPLICATION_STATUS_LABEL,
  isAwaitingResult,
  isCandidateSideReason,
  rejectReasonLabel,
  statusChangeProblem,
  type ApplicationDetailDto,
  type ApplicationStatus,
  type RejectReason,
  type TemplateKey,
} from '@careers/shared';
import { useEffect, useId, useState } from 'react';
import type { ApplicationPatch } from '../../../api';
import { useUpdateApplication } from '../../../api/queries';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { RejectForm } from './RejectForm';
import { BypassForm, needsBypass } from './ReviewGate';
import { MARK_STROKE, StatusMark } from './StatusMark';
import { AWAITING_LOOK, STATUS_STYLE } from './statusStyle';
import { suggestedTemplate } from './useMailDraft';

type Segment = ApplicationStatus | 'awaiting';

/** Every step in the order an application moves through them. */
const SEGMENTS: readonly Segment[] = ['new', 'seen', 'interview', 'awaiting', 'passed', 'hired', 'rejected'];

const lookOf = (segment: Segment) => (segment === 'awaiting' ? AWAITING_LOOK : STATUS_STYLE[segment]);

/** Why a step cannot be pressed now, shown on a press, because a hover title never shows on a phone. */
function lockReason(segment: Segment, app: ApplicationDetailDto, active: Segment): string | null {
  if (segment === active) return null;
  if (segment === 'awaiting') return 'Tự chuyển sang "Chờ kết quả" khi đã qua giờ phỏng vấn.';
  if (segment === 'interview' && active === 'awaiting') return 'Muốn hẹn lại, đổi giờ ở mục Giờ phỏng vấn.';
  return statusChangeProblem(app, segment, new Date());
}

const SEGMENT =
  'relative -ml-px inline-flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-x-1 border px-1 py-1 text-center text-[12px] leading-tight transition-colors first:ml-0 first:rounded-l-control last:rounded-r-control focus-visible:z-10 lg:flex-nowrap lg:whitespace-nowrap lg:px-2 lg:py-0 lg:text-[13px]';

function segmentTone(segment: Segment, isActive: boolean, isLocked: boolean): string {
  if (isActive) return `z-[1] font-semibold ${lookOf(segment).filled}`;
  if (isLocked) return 'cursor-not-allowed border-silver bg-mist text-muted';
  return `border-silver bg-white text-navy ${lookOf(segment).hover}`;
}

const UNDO_MS = 5000;

function UndoBar({ app, onCompose, onUndo }: { app: ApplicationDetailDto; onCompose: () => void; onUndo: () => void }) {
  // A candidate who left needs no letter of refusal.
  const canWrite =
    (app.status === 'interview' && !isAwaitingResult(app, new Date())) ||
    (app.status === 'rejected' && !isCandidateSideReason(app.rejectReason));
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-navy px-4 py-2.5 text-sm text-white shadow-[0_10px_30px_rgba(11,31,58,0.25)]"
    >
      <span>Đã chuyển sang "{APPLICATION_STATUS_LABEL[app.status]}".</span>
      {canWrite && (
        <button
          type="button"
          onClick={onCompose}
          className="min-h-9 rounded-control border-0 bg-white px-3 font-semibold text-navy max-lg:min-h-11"
        >
          {app.status === 'rejected' ? 'Soạn thư cảm ơn' : 'Soạn thư mời'}
        </button>
      )}
      <button
        type="button"
        onClick={onUndo}
        className="min-h-9 border-0 bg-transparent px-2 font-semibold text-white underline max-lg:min-h-11"
      >
        Hoàn tác
      </button>
    </div>
  );
}

/** A status change and its undo; everything a change can clear is kept, so undo brings back the Meet link too. */
function useStatusChange(app: ApplicationDetailDto, onError: (msg: string) => void) {
  const update = useUpdateApplication();
  const [undo, setUndo] = useState<ApplicationPatch | null>(null);
  const [isBypassing, setIsBypassing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  const send = (patch: ApplicationPatch) => {
    setIsBypassing(false);
    setIsRejecting(false);
    const before: ApplicationPatch = {
      status: app.status,
      interviewAt: app.interviewAt,
      interviewMode: app.interviewMode,
      meetingUrl: app.meetingUrl,
      ...(app.rejectReason ? { rejectReason: app.rejectReason, rejectNote: app.rejectNote } : {}),
      isUndo: true,
    };
    update.mutate(
      { id: app.id, patch },
      { onSuccess: () => setUndo(before), onError: (e) => onError(errorMessage(e)) },
    );
  };
  const change = (status: ApplicationStatus, reviewBypassReason?: string) => {
    if (status === 'interview' && needsBypass(app) && !reviewBypassReason) {
      setIsBypassing(true);
      return;
    }
    if (status === 'rejected') {
      setIsRejecting(true);
      return;
    }
    // Back from a result: the interview did take place at that time.
    const keepsTime = status === 'interview' && (app.status === 'passed' || app.status === 'hired');
    send({
      status,
      ...(keepsTime ? { interviewAt: app.interviewAt } : {}),
      ...(reviewBypassReason ? { reviewBypassReason } : {}),
    });
  };
  const reject = (rejectReason: RejectReason, rejectNote: string | null = null) =>
    send({ status: 'rejected', rejectReason, rejectNote });
  const revert = () => {
    if (undo) update.mutate({ id: app.id, patch: undo }, { onError: (e) => onError(errorMessage(e)) });
    setUndo(null);
  };
  return {
    change,
    reject,
    revert,
    isPending: update.isPending,
    hasUndo: !!undo,
    clearUndo: () => setUndo(null),
    isBypassing,
    stopBypass: () => setIsBypassing(false),
    isRejecting,
    stopReject: () => setIsRejecting(false),
  };
}

function StatusSegments({ app, status }: { app: ApplicationDetailDto; status: ReturnType<typeof useStatusChange> }) {
  const id = useId();
  // A hover title never shows on a phone, so pressing a locked status says why, under the block.
  const [why, setWhy] = useState<string | null>(null);
  const active: Segment = isAwaitingResult(app, new Date()) ? 'awaiting' : app.status;
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="min-w-0 max-lg:w-full">
      <span id={`${id}-label`} className="mb-0.5 block text-[11px] leading-4 text-muted">
        Cập nhật trạng thái
      </span>
      <div className="grid grid-cols-4 lg:flex lg:flex-wrap">
        {SEGMENTS.map((segment) => {
          const isActive = segment === active;
          const reason = lockReason(segment, app, active);
          return (
            <button
              key={segment}
              type="button"
              aria-pressed={isActive}
              aria-disabled={!!reason || undefined}
              title={reason ?? (segment === 'new' && !isActive ? 'Đánh dấu chưa xem' : undefined)}
              disabled={status.isPending}
              onClick={() => {
                setWhy(reason);
                if (!isActive && !reason && segment !== 'awaiting') status.change(segment);
              }}
              className={`${SEGMENT} ${segmentTone(segment, isActive, !!reason)}`}
            >
              {isActive && <Icon name="check" size={14} stroke={MARK_STROKE} className="shrink-0" />}
              <StatusMark look={lookOf(segment)} />
            </button>
          );
        })}
      </div>
      {why && (
        <span role="status" className="mt-1 block text-xs text-slate">
          {why}
        </span>
      )}
    </div>
  );
}

/**
 * The status block in the detail header: every status, the current one filled and ticked. A change can be undone for 5 seconds, in case of a wrong tap. The undo bar
 * and the "Vẫn hẹn" form float over the top of the content (the nearest positioned parent is the header), so the
 * CV next to them does not jump.
 */
export function StatusControl({
  app,
  onError,
  onCompose,
}: {
  app: ApplicationDetailDto;
  onError: (msg: string) => void;
  /** Opens "Soạn thư" with the template that fits the new status. */
  onCompose: (key: TemplateKey) => void;
}) {
  const status = useStatusChange(app, onError);
  return (
    <>
      <div className="flex min-w-0 flex-col gap-2 max-lg:w-full">
        <StatusSegments app={app} status={status} />
        {app.status === 'rejected' && app.rejectReason && (
          <p className="m-0 flex flex-wrap items-center gap-1.5 text-[13px] text-slate">
            <Icon name="info" size={14} className="shrink-0" />
            Lý do: <b className="font-semibold text-navy">{rejectReasonLabel(app.rejectReason)}</b>
            {app.rejectNote && <span>· {app.rejectNote}</span>}
          </p>
        )}
      </div>
      {(status.isBypassing || status.isRejecting || status.hasUndo) && (
        <div className="absolute inset-x-3 top-full z-10 mt-1 flex max-h-[60dvh] flex-col gap-2 overflow-y-auto rounded-control">
          {status.isBypassing && (
            <div className="rounded-control bg-white shadow-[0_10px_30px_rgba(11,31,58,0.25)]">
              <BypassForm
                app={app}
                busy={status.isPending}
                onConfirm={(reason) => status.change('interview', reason)}
                onCancel={status.stopBypass}
              />
            </div>
          )}
          {status.isRejecting && (
            <div className="rounded-control bg-white shadow-[0_10px_30px_rgba(11,31,58,0.25)]">
              <RejectForm busy={status.isPending} onConfirm={status.reject} onCancel={status.stopReject} />
            </div>
          )}
          {status.hasUndo && (
            <UndoBar
              app={app}
              onCompose={() => {
                status.clearUndo();
                onCompose(suggestedTemplate(app));
              }}
              onUndo={status.revert}
            />
          )}
        </div>
      )}
    </>
  );
}
