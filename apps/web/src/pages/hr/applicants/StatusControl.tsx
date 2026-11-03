import {
  APPLICATION_STATUS_LABEL,
  type ApplicationDetailDto,
  type ApplicationStatus,
  type TemplateKey,
} from '@careers/shared';
import { useEffect, useId, useState } from 'react';
import type { ApplicationPatch } from '../../../api';
import { useUpdateApplication } from '../../../api/queries';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { BypassForm, needsBypass } from './ReviewGate';
import { MARK_STROKE, StatusMark } from './StatusMark';
import { STATUS_STYLE } from './statusStyle';
import { suggestedTemplate } from './useMailDraft';

/**
 * The statuses in the order an application moves through them. The two with a `reason` or `title` say what a press
 * means, because it is not obvious: "Đã xem" is not a choice (the server sets it when a profile is opened), and "Mới"
 * marks it as not seen again.
 */
const SEGMENTS: { status: ApplicationStatus; reason?: string; title?: string }[] = [
  { status: 'new', title: 'Đánh dấu chưa xem' },
  { status: 'seen', reason: 'Hồ sơ tự chuyển sang "Đã xem" khi được mở.' },
  { status: 'interview' },
  { status: 'rejected' },
];

const SEGMENT =
  'relative -ml-px inline-flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-x-1 border px-1 py-1 text-center text-[12px] leading-tight transition-colors first:ml-0 first:rounded-l-control last:rounded-r-control focus-visible:z-10 lg:flex-nowrap lg:whitespace-nowrap lg:px-2 lg:py-0 lg:text-[13px]';

function segmentTone(status: ApplicationStatus, isActive: boolean, isLocked: boolean): string {
  if (isActive) return `z-[1] font-semibold ${STATUS_STYLE[status].filled}`;
  if (isLocked) return 'cursor-not-allowed border-silver bg-mist text-muted';
  return `border-silver bg-white text-navy ${STATUS_STYLE[status].hover}`;
}

const UNDO_MS = 5000;

function UndoBar({ app, onCompose, onUndo }: { app: ApplicationDetailDto; onCompose: () => void; onUndo: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-navy px-4 py-2.5 text-sm text-white shadow-[0_10px_30px_rgba(11,31,58,0.25)]"
    >
      <span>Đã chuyển sang "{APPLICATION_STATUS_LABEL[app.status]}".</span>
      {(app.status === 'rejected' || app.status === 'interview') && (
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
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  const change = (status: ApplicationStatus, reviewBypassReason?: string) => {
    if (status === 'interview' && needsBypass(app) && !reviewBypassReason) {
      setIsBypassing(true);
      return;
    }
    setIsBypassing(false);
    const before: ApplicationPatch = {
      status: app.status,
      interviewAt: app.interviewAt,
      interviewMode: app.interviewMode,
      meetingUrl: app.meetingUrl,
    };
    update.mutate(
      { id: app.id, patch: { status, ...(reviewBypassReason ? { reviewBypassReason } : {}) } },
      { onSuccess: () => setUndo(before), onError: (e) => onError(errorMessage(e)) },
    );
  };
  const revert = () => {
    if (undo) update.mutate({ id: app.id, patch: undo }, { onError: (e) => onError(errorMessage(e)) });
    setUndo(null);
  };
  return {
    change,
    revert,
    isPending: update.isPending,
    hasUndo: !!undo,
    clearUndo: () => setUndo(null),
    isBypassing,
    stopBypass: () => setIsBypassing(false),
  };
}

function StatusSegments({ app, status }: { app: ApplicationDetailDto; status: ReturnType<typeof useStatusChange> }) {
  const id = useId();
  // A hover title never shows on a phone, so pressing a locked status says why, under the block.
  const [why, setWhy] = useState<string | null>(null);
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="min-w-0 max-lg:w-full">
      <span id={`${id}-label`} className="mb-0.5 block text-[11px] leading-4 text-muted">
        Cập nhật trạng thái
      </span>
      <div className="grid grid-cols-4 lg:inline-flex">
        {SEGMENTS.map(({ status: value, reason, title }) => {
          const isActive = app.status === value;
          const isLocked = !isActive && !!reason;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              aria-disabled={isLocked || undefined}
              title={isActive ? undefined : (reason ?? title)}
              disabled={status.isPending}
              onClick={() => {
                setWhy(isLocked && reason ? reason : null);
                if (!isActive && !isLocked) status.change(value);
              }}
              className={`${SEGMENT} ${segmentTone(value, isActive, isLocked)}`}
            >
              {isActive && <Icon name="check" size={14} stroke={MARK_STROKE} className="shrink-0" />}
              <StatusMark look={STATUS_STYLE[value]} />
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
      <StatusSegments app={app} status={status} />
      {(status.isBypassing || status.hasUndo) && (
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
