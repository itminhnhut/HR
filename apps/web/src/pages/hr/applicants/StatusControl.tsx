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
import { useEffect, useState, type ReactNode } from 'react';
import type { ApplicationPatch } from '../../../api';
import { useUpdateApplication } from '../../../api/queries';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { RejectForm } from './RejectForm';
import { BypassForm, needsBypass } from './ReviewGate';
import { MARK_STROKE, StatusMark } from './StatusMark';
import type { Step } from './statusGroups';
import { StatusMenu } from './StatusMenu';
import { AWAITING_LOOK, STATUS_STYLE } from './statusStyle';
import { suggestedTemplate } from './useMailDraft';

type Segment = Step;

const lookOf = (segment: Segment) => (segment === 'awaiting' ? AWAITING_LOOK : STATUS_STYLE[segment]);

/** Why a step cannot be pressed now, shown on a press, because a hover title never shows on a phone. */
function lockReason(segment: Segment, app: ApplicationDetailDto, active: Segment): string | null {
  if (segment === active) return null;
  if (segment === 'awaiting') return 'Tự chuyển sang "Chờ kết quả" khi đã qua giờ phỏng vấn.';
  if (segment === 'interview' && active === 'awaiting') return 'Muốn hẹn lại, đổi giờ ở mục Giờ phỏng vấn.';
  return statusChangeProblem(app, segment, new Date());
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

/** The usual next step from each one: what "Bước tiếp" does. Waiting for a time and results have none until then. */
const NEXT: Partial<Record<Segment, ApplicationStatus>> = {
  new: 'seen',
  seen: 'scheduling',
  scheduling: 'interview',
  awaiting: 'passed',
  passed: 'hired',
};

const SIDE_BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 lg:min-h-10';

/**
 * One line: the current status (a menu of every step, in three groups), the usual next step, and "Loại".
 * Like an ATS's stage menu, the step HR takes most often is one press.
 */
function StatusBar({ app, status }: { app: ApplicationDetailDto; status: ReturnType<typeof useStatusChange> }) {
  // A hover title never shows on a phone, so pressing a locked status says why, under the line.
  const [why, setWhy] = useState<string | null>(null);
  const active: Segment = isAwaitingResult(app, new Date()) ? 'awaiting' : app.status;
  const next = NEXT[active];
  const canGoNext = !!next && !lockReason(next, app, active);
  const change = (step: ApplicationStatus) => {
    setWhy(null);
    status.change(step);
  };
  return (
    <div role="group" aria-label="Cập nhật trạng thái" className="w-full min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-[13px] text-slate">
          Trạng thái
        </span>
        <StatusMenu
          active={active}
          lookOf={lookOf}
          reasonOf={(step) => lockReason(step, app, active)}
          isBusy={status.isPending}
          onChoose={(step) => step !== 'awaiting' && change(step)}
          onLocked={setWhy}
        />
        {next && canGoNext && (
          <button
            type="button"
            disabled={status.isPending}
            onClick={() => change(next)}
            className={`${SIDE_BUTTON} border-field bg-white text-navy ${lookOf(next).hover}`}
          >
            Bước tiếp: <StatusMark look={lookOf(next)} />
            <Icon name="chevronRight" size={16} stroke={MARK_STROKE} className="shrink-0" />
          </button>
        )}
        {active !== 'rejected' && (
          <button
            type="button"
            disabled={status.isPending}
            onClick={() => change('rejected')}
            className={`${SIDE_BUTTON} border-field bg-white text-navy ${lookOf('rejected').hover}`}
          >
            <Icon name="xCircle" size={16} stroke={MARK_STROKE} className="shrink-0" />
            Loại
          </button>
        )}
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
  aside,
}: {
  app: ApplicationDetailDto;
  onError: (msg: string) => void;
  /** Opens "Soạn thư" with the template that fits the new status. */
  onCompose: (key: TemplateKey) => void;
  /** On the wide layout, the contact actions: on the line of the reason, so neither sits alone on a row. */
  aside?: ReactNode;
}) {
  const status = useStatusChange(app, onError);
  const hasReason = app.status === 'rejected' && !!app.rejectReason;
  return (
    <>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <StatusBar app={app} status={status} />
        {(hasReason || aside) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {hasReason && app.rejectReason && (
              <p className="m-0 flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-slate">
                <Icon name="info" size={14} className="shrink-0" />
                Lý do: <b className="font-semibold text-navy">{rejectReasonLabel(app.rejectReason)}</b>
                {app.rejectNote && <span>· {app.rejectNote}</span>}
              </p>
            )}
            {aside && <div className="ml-auto flex items-center gap-1.5">{aside}</div>}
          </div>
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
