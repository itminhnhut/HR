import {
  APPLICATION_STATUS_LABEL,
  formatPhone,
  formatTimestamp,
  NOTE_MAX,
  zaloLink,
  type ApplicationDetailDto,
  type ApplicationStatus,
  type TemplateKey,
} from '@careers/shared';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api, type ApplicationPatch } from '../../../api';
import { useApplication, useDeleteApplication, useUpdateApplication } from '../../../api/queries';
import { telLink } from '../../../lib/site';
import { Button } from '../../../ui/Button';
import { CopyButton } from '../../../ui/CopyButton';
import { CloseButton } from '../../../ui/Dialog';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../../ui/feedback';
import { FieldError } from '../../../ui/Field';
import { Icon, type IconName } from '../../../ui/icons';
import { apiMessage, Avatar, errorMessage } from '../parts';
import { ComposeMessage, ContactHistory, hrCalendarUrl } from './ComposeMessage';
import { CvMatch } from './CvMatch';
import { CvPanel } from './CvPanel';
import { InterviewField } from './InterviewField';
import { BypassForm, needsBypass, ReviewStatus } from './ReviewGate';

const shortDate = (iso: string) => formatTimestamp(iso).slice(0, 5);

const bigAction =
  'flex flex-col items-center justify-center gap-1.5 rounded-control px-1.5 py-3 text-[13px] font-medium no-underline max-lg:rounded-card max-lg:py-3.5';

function BigActions({ app }: { app: ApplicationDetailDto }) {
  const pastedLink = app.cvLink && /^https?:\/\//i.test(app.cvLink) ? app.cvLink : null;
  const cvLink = pastedLink ?? (app.cvFileName ? api.hrCvUrl(app.id) : null);
  return (
    <div className="grid grid-cols-3 gap-2">
      <a href={telLink(app.phone)} className={`${bigAction} btn-glow bg-accent text-white hover:text-white`}>
        <Icon name="phone" size={18} stroke={1.5} />
        Gọi
      </a>
      <a
        href={zaloLink(app.phone)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${bigAction} border border-silver text-navy hover:bg-mist`}
      >
        <Icon name="chat" size={18} stroke={1.5} />
        Nhắn Zalo
      </a>
      {cvLink ? (
        <a
          href={cvLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`${bigAction} border border-silver text-navy hover:bg-mist`}
        >
          <Icon name="file" size={18} stroke={1.5} />
          {pastedLink ? 'Mở link CV' : 'Xem CV'}
        </a>
      ) : (
        <span aria-disabled="true" className={`${bigAction} border border-dashed border-silver text-center text-muted`}>
          <Icon name="file" size={18} stroke={1.5} />
          {app.cvFileName ? 'CV chỉ có ở web thật' : 'Chưa có CV'}
        </span>
      )}
    </div>
  );
}

function Fact({
  icon,
  label,
  copy,
  children,
}: {
  icon: IconName;
  label: string;
  /** Shows a copy button for this value. */
  copy?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex shrink-0 rounded-full border border-ring p-2 text-accent">
        <Icon name={icon} size={15} stroke={1.4} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="m-0 font-medium [overflow-wrap:anywhere]">{children}</dd>
      </div>
      {copy && <CopyButton text={copy} label={label.toLowerCase()} className="-my-1" />}
    </div>
  );
}

const STATUS_BUTTONS: { status: ApplicationStatus; label: string; icon: IconName; idle: string; on: string }[] = [
  {
    status: 'interview',
    label: 'Hẹn phỏng vấn',
    icon: 'calendar',
    idle: 'border-navy text-navy font-medium',
    on: 'border-navy bg-navy text-white font-medium',
  },
  {
    status: 'rejected',
    label: 'Chưa phù hợp',
    icon: 'x',
    idle: 'border-field text-slate',
    on: 'border-slate bg-slate text-white font-medium',
  },
];

const UNDO_MS = 5000;

/** Status buttons. A change can be undone for 5 seconds, in case of a wrong tap. */
function StatusButtons({
  app,
  onError,
  onCompose,
}: {
  app: ApplicationDetailDto;
  onError: (msg: string) => void;
  /** Opens "Soạn thư" with the template that fits the new status. */
  onCompose: (key: TemplateKey) => void;
}) {
  const update = useUpdateApplication();
  // Everything a status change can clear, so "Hoàn tác" brings back the Meet link and mode too.
  const [undo, setUndo] = useState<ApplicationPatch | null>(null);
  const [bypassing, setBypassing] = useState(false);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  const change = (status: ApplicationStatus, reviewBypassReason?: string) => {
    if (status === 'interview' && needsBypass(app) && !reviewBypassReason) {
      setBypassing(true);
      return;
    }
    setBypassing(false);
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

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">Cập nhật trạng thái</span>
      <div className="flex flex-wrap gap-2">
        {STATUS_BUTTONS.map((b) => {
          const on = app.status === b.status;
          return (
            <button
              key={b.status}
              type="button"
              aria-pressed={on}
              disabled={update.isPending}
              onClick={() => !on && change(b.status)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-control border px-3.5 text-[13px] transition-colors sm:flex-none ${on ? b.on : `bg-white hover:bg-mist ${b.idle}`}`}
            >
              <Icon name={b.icon} size={15} stroke={1.6} />
              {b.label}
            </button>
          );
        })}
        {app.status !== 'new' && (
          <button
            type="button"
            disabled={update.isPending}
            onClick={() => change('new')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control border-0 bg-transparent px-2 text-[13px] text-slate underline hover:text-navy"
          >
            Đánh dấu chưa xem
          </button>
        )}
      </div>
      <ReviewStatus app={app} />
      {bypassing && (
        <BypassForm
          app={app}
          busy={update.isPending}
          onConfirm={(reason) => change('interview', reason)}
          onCancel={() => setBypassing(false)}
        />
      )}
      {undo && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-navy px-4 py-2.5 text-sm text-white"
        >
          <span>Đã chuyển sang "{APPLICATION_STATUS_LABEL[app.status]}".</span>
          {(app.status === 'rejected' || app.status === 'interview') && (
            <button
              type="button"
              onClick={() => {
                setUndo(null);
                onCompose(
                  app.status === 'rejected'
                    ? 'rejection'
                    : app.interviewMode === 'online'
                      ? 'interview_online'
                      : 'interview_onsite',
                );
              }}
              className="min-h-9 rounded-control border-0 bg-white px-3 font-semibold text-navy"
            >
              {app.status === 'rejected' ? 'Soạn thư cảm ơn' : 'Soạn thư mời'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              update.mutate({ id: app.id, patch: undo }, { onError: (e) => onError(errorMessage(e)) });
              setUndo(null);
            }}
            className="min-h-9 border-0 bg-transparent px-2 font-semibold text-white underline"
          >
            Hoàn tác
          </button>
        </div>
      )}
    </div>
  );
}

/** Keyed by the saved link, so a link saved elsewhere (e.g. the compose dialog) shows up here at once. */
function MeetLinkInput({ saved, onSave }: { saved: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(saved);
  return (
    <input
      type="url"
      inputMode="url"
      aria-label="Link Meet"
      placeholder="Dán link Meet: https://meet.google.com/…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() !== saved && onSave(value.trim())}
      className="field-focus min-h-11 rounded-control border border-field bg-white px-3.5 text-sm text-navy outline-none"
    />
  );
}

/** Interview time, onsite/online, and for online the Meet link (made by HR in Google Calendar). */
function InterviewTime({ app, onError }: { app: ApplicationDetailDto; onError: (msg: string) => void }) {
  const update = useUpdateApplication();
  const patch = (p: ApplicationPatch) =>
    update.mutate({ id: app.id, patch: p }, { onError: (e) => onError(errorMessage(e)) });
  const online = app.interviewMode === 'online';
  const calendar = hrCalendarUrl(app);
  return (
    <div className="flex flex-col gap-3">
      <InterviewField
        value={app.interviewAt}
        disabled={update.isPending}
        onChange={(interviewAt) => patch({ interviewAt })}
      />
      <div role="group" aria-label="Hình thức phỏng vấn" className="flex gap-2">
        {(['onsite', 'online'] as const).map((mode) => {
          const on = (app.interviewMode ?? 'onsite') === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={on}
              disabled={update.isPending}
              onClick={() => !on && patch({ interviewMode: mode })}
              className={`min-h-10 rounded-full border px-4 text-sm ${on ? 'border-navy bg-navy text-white' : 'border-field bg-white text-navy hover:bg-mist'}`}
            >
              {mode === 'onsite' ? 'Trực tiếp' : 'Online (Meet)'}
            </button>
          );
        })}
      </div>
      {calendar && (
        <div className="flex flex-col gap-1 rounded-control border border-line px-4 py-3">
          <a
            href={calendar}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium"
          >
            <Icon name="calendar" size={16} />
            Tạo lịch Google (mời ứng viên)
          </a>
          <span className="text-xs text-muted">
            Lưu sự kiện là Google gửi lời mời lịch cho ứng viên.
            {online ? ' Bấm "Thêm hội nghị truyền hình Google Meet" trước khi lưu, rồi dán link Meet bên dưới.' : ''}
          </span>
        </div>
      )}
      {online && (
        <MeetLinkInput
          key={app.meetingUrl ?? ''}
          saved={app.meetingUrl ?? ''}
          onSave={(v) => patch({ meetingUrl: v })}
        />
      )}
    </div>
  );
}

const savedTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));

function NoteField({ app, onError }: { app: ApplicationDetailDto; onError: (msg: string) => void }) {
  const update = useUpdateApplication();
  const [note, setNote] = useState(app.note ?? '');
  const saved = useRef(app.note ?? null);
  const latest = useRef(note);
  latest.current = note;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const { mutate } = update;
  const saveNote = useCallback(() => {
    const next = latest.current.trim() || null;
    if (next === saved.current) return;
    saved.current = next;
    mutate(
      { id: app.id, patch: { note: next } },
      { onError: (e) => onErrorRef.current(errorMessage(e, 'Chưa lưu được ghi chú, thử lại.')) },
    );
  }, [app.id, mutate]);
  // Save a moment after typing stops, and when the panel closes (Esc, sheet).
  useEffect(() => {
    const t = setTimeout(saveNote, 1000);
    return () => clearTimeout(t);
  }, [note, saveNote]);
  const saveRef = useRef(saveNote);
  saveRef.current = saveNote;
  useEffect(() => () => saveRef.current(), []);
  const left = NOTE_MAX - note.length;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">Ghi chú nội bộ</span>
      <textarea
        rows={3}
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        placeholder="Chỉ HR thấy, vd: đã gọi, hẹn gọi lại chiều thứ 6"
        className="field-focus resize-y rounded-control border border-field bg-white px-3.5 py-3 text-sm text-navy outline-none placeholder:text-placeholder"
      />
      <span className="flex justify-between gap-3 text-xs text-muted">
        <span>
          {update.isPending
            ? 'Đang lưu…'
            : app.noteUpdatedAt
              ? `Đã lưu lúc ${savedTime(app.noteUpdatedAt)}${app.noteUpdatedBy ? ` · ${app.noteUpdatedBy}` : ''}`
              : 'Tự lưu. Ứng viên không thấy ghi chú này.'}
        </span>
        {left < 200 && <span className={left < 50 ? 'text-error' : ''}>Còn {left} ký tự</span>}
      </span>
    </label>
  );
}

function OtherApplications({ app }: { app: ApplicationDetailDto }) {
  if (app.otherApplications.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-control border border-ring bg-tint px-4 py-3">
      <span className="text-sm font-medium text-navy">
        Người này đã nộp thêm {app.otherApplications.length} vị trí khác
      </span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {app.otherApplications.map((o) => (
          <li key={o.id}>
            <Link to={`/hr/ho-so?id=${o.id}`} className="no-underline hover:underline">
              {o.jobTitle}
            </Link>{' '}
            <span className="text-muted">
              · {APPLICATION_STATUS_LABEL[o.status]} · {shortDate(o.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Deletes the application and its CV file; two taps, it cannot be undone. */
function DeleteApplication({ app, onDeleted }: { app: ApplicationDetailDto; onDeleted: () => void }) {
  const remove = useDeleteApplication();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => {
          if (!confirm) return setConfirm(true);
          setError(null);
          remove.mutate(app.id, {
            onSuccess: onDeleted,
            onError: (e) => {
              setConfirm(false);
              setError(errorMessage(e));
            },
          });
        }}
        className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-control border px-4 text-sm transition-colors disabled:opacity-60 ${confirm ? 'border-error bg-error font-medium text-white' : 'border-field bg-white text-error hover:bg-error-soft'}`}
      >
        <Icon name="trash" size={16} />
        {remove.isPending ? 'Đang xoá…' : confirm ? 'Bấm lần nữa để xoá hẳn' : 'Xoá hồ sơ'}
      </button>
      <span className="text-xs text-muted">
        Xoá cả file CV, không khôi phục được. Dùng khi ứng viên yêu cầu xoá dữ liệu.
      </span>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function DetailBody({
  app,
  onClose,
  onDeleted,
  onNext,
}: {
  app: ApplicationDetailDto;
  onClose?: () => void;
  onDeleted: () => void;
  onNext?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [composeRequest, setComposeRequest] = useState<TemplateKey | null>(null);
  return (
    <div className="flex flex-col gap-5 max-lg:gap-4">
      <div className="flex items-center gap-4 max-lg:gap-3.5">
        <Avatar name={app.fullName} size={56} solid />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1">
            <h2 className="m-0 font-serif text-[24px] font-medium lg:text-[26px]">{app.fullName}</h2>
            <CopyButton text={app.fullName} label="họ tên" />
          </span>
          <span className="text-[13px] text-slate lg:text-sm">{app.jobTitle}</span>
        </div>
        {onNext && (
          <Button
            variant="ghost"
            size="sm"
            iconRight="arrowRight"
            onClick={onNext}
            aria-label="Hồ sơ tiếp"
            className="shrink-0"
          >
            {/* Arrow only on phones, so the name keeps the width. */}
            <span className="max-sm:hidden">Hồ sơ tiếp</span>
          </Button>
        )}
        {onClose && <CloseButton onClick={onClose} className="border-0 bg-tint" />}
      </div>

      <BigActions app={app} />
      {/* What HR does next sits right under the contact buttons, before the long reading below. */}
      {error && (
        <Notice tone="error" icon="alert">
          <span role="alert">{error}</span>
        </Notice>
      )}
      <StatusButtons app={app} onError={setError} onCompose={setComposeRequest} />
      {app.status === 'interview' && <InterviewTime app={app} onError={setError} />}
      <ComposeMessage app={app} request={composeRequest} onRequestDone={() => setComposeRequest(null)} />
      <CvPanel app={app} />
      <CvMatch app={app} />

      <dl className="m-0 flex flex-col gap-3 text-sm">
        <Fact icon="phone" label="Điện thoại" copy={app.phone}>
          {formatPhone(app.phone)}
        </Fact>
        <Fact icon="mail" label="Email" copy={app.email}>
          {app.email ?? 'Không cung cấp'}
        </Fact>
        <Fact icon="calendar" label="Ngày nộp">
          {formatTimestamp(app.createdAt)}
        </Fact>
      </dl>

      <OtherApplications app={app} />

      {app.message && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Lời nhắn của ứng viên</span>
          <p className="m-0 border-l-2 border-silver bg-hover px-4 py-3.5 text-sm leading-relaxed text-ink">
            {app.message}
          </p>
        </div>
      )}

      <ContactHistory app={app} />
      <NoteField key={app.id} app={app} onError={setError} />

      <div className="flex items-start gap-2.5 rounded-control bg-mist px-3.5 py-3 text-[13px] leading-relaxed text-body">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-accent" />
        <span>Ứng viên đồng ý cho vị trí này. Nếu không tuyển, hồ sơ được xóa 30 ngày sau khi tin đóng.</span>
      </div>
      <DeleteApplication app={app} onDeleted={onDeleted} />
    </div>
  );
}

export function ApplicantDetail({
  id,
  onClose,
  onDeleted,
  onNext,
}: {
  id: string;
  onClose?: () => void;
  onDeleted: () => void;
  /** Next application in the current list, to go through new ones without going back. */
  onNext?: () => void;
}) {
  const detail = useApplication(id);
  const showSkeleton = useDelayedFlag(detail.isPending, 400);
  if (detail.isPending) {
    return (
      <>
        <LoadingStatus />
        {showSkeleton && (
          <div aria-hidden="true" className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-4">
              <Sk w={56} h={56} round />
              <span className="flex flex-col gap-2">
                <Sk w={200} h={22} />
                <Sk w={150} h={13} />
              </span>
            </div>
            <Sk w="100%" h={64} />
            <Sk w="85%" h={13} />
            <Sk w="100%" h={80} />
          </div>
        )}
      </>
    );
  }
  if (detail.isError) return <ErrorState onRetry={() => detail.refetch()} message={apiMessage(detail.error)} />;
  return <DetailBody app={detail.data} onClose={onClose} onDeleted={onDeleted} onNext={onNext} />;
}
