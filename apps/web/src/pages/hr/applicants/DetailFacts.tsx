import { formatPhone, formatTimestamp, type ApplicationDetailDto } from '@careers/shared';
import { useState, type ReactNode } from 'react';
import { useDeleteApplication } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { CopyButton } from '../../../ui/CopyButton';
import { useConfirm } from '../shadcn/Confirm';
import { FieldError } from '../../../ui/Field';
import { Icon, type IconName } from '../../../ui/icons';
import { useMediaQuery } from '../../../lib/hooks';
import { errorMessage } from '../parts';
import { ContactOrigin } from './ContactOrigin';
import { ActivityLogRow, ContactHistoryRow, OtherApplicationsRow } from './DetailDrawers';
import { CvMatch } from './CvMatch';
import { CvPanel } from './CvPanel';
import { InterviewTime } from './InterviewTime';
import { NoteTimeline } from './NoteTimeline';
import { PersonalMarks } from './PersonalMarks';
import { ReviewStatus } from './ReviewGate';

/** A long address wraps after the @, not in the middle of a word. */
function EmailText({ email }: { email: string }) {
  const at = email.indexOf('@');
  if (at < 0) return <>{email}</>;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}

function Fact({
  icon,
  label,
  copy,
  className = '',
  children,
}: {
  icon: IconName;
  label: string;
  /** Shows a copy button for this value. */
  copy?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="flex shrink-0 rounded-full border border-ring p-2 text-accent">
        <Icon name={icon} size={15} stroke={1.4} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="m-0 font-medium [overflow-wrap:anywhere]">{children}</dd>
      </div>
      {copy && <CopyButton text={copy} label={label.toLowerCase()} className="-my-1 max-lg:size-11" />}
    </div>
  );
}

/** Deletes the application and its CV file; two taps, it cannot be undone. */
function DeleteApplication({ app, onDeleted }: { app: ApplicationDetailDto; onDeleted: () => void }) {
  const remove = useDeleteApplication();
  const [confirm, dialog] = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const ask = async () => {
    const agreed = await confirm({
      title: `Xoá hồ sơ ${app.fullName}?`,
      description: 'Xoá cả file CV, không khôi phục được.',
      action: 'Xoá hồ sơ',
      isDanger: true,
    });
    if (!agreed) return;
    setError(null);
    remove.mutate(app.id, { onSuccess: onDeleted, onError: (e) => setError(errorMessage(e)) });
  };
  return (
    <div className="flex flex-col gap-1.5">
      {dialog}
      <Button
        variant="outline"
        icon="trash"
        disabled={remove.isPending}
        className="w-fit text-error! hover:bg-error-soft!"
        onClick={() => void ask()}
      >
        {remove.isPending ? 'Đang xoá…' : 'Xoá hồ sơ'}
      </Button>
      <span className="text-xs text-muted">Dùng khi ứng viên yêu cầu xoá dữ liệu.</span>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function ContactFacts({ app }: { app: ApplicationDetailDto }) {
  return (
    <dl className="m-0 flex flex-col gap-3 text-sm">
      {/* Name and position are cut to one line in the phone header, so the whole of them, and copy, are here. */}
      <Fact icon="user" label="Họ tên" copy={app.fullName} className="lg:hidden">
        {app.fullName}
      </Fact>
      <Fact icon="briefcase" label="Vị trí" className="lg:hidden">
        {app.jobTitle}
      </Fact>
      <Fact icon="phone" label="Điện thoại" copy={app.phone}>
        {formatPhone(app.phone)}
      </Fact>
      <Fact icon="mail" label="Email" copy={app.email}>
        {app.email ? <EmailText email={app.email} /> : 'Không cung cấp'}
      </Fact>
      <Fact icon="user" label={app.hrGender ? 'Giới tính (HR sửa), tuổi (theo CV)' : 'Giới tính, tuổi (theo CV)'}>
        {app.hrGender || app.cvGender || app.cvBirth ? (
          <PersonalMarks gender={app.hrGender ?? app.cvGender} birth={app.cvBirth} />
        ) : (
          'CV không ghi'
        )}
      </Fact>
      {app.interviewAt && app.status !== 'interview' && (
        <Fact icon="clock" label="Ngày phỏng vấn">
          {formatTimestamp(app.interviewAt)}
        </Fact>
      )}
      <Fact icon="calendar" label="Ngày nộp">
        {formatTimestamp(app.createdAt)}
      </Fact>
    </dl>
  );
}

function RetentionNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-control bg-mist px-3.5 py-3 text-[13px] leading-relaxed text-body sm:flex-1">
      <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-accent" />
      <span>Hồ sơ được lưu đến khi ứng viên yêu cầu xoá.</span>
    </div>
  );
}

/** Name, phone, email, gender and age, the day it came, then where from and "Sửa thông tin". */
function FactsCard({ app }: { app: ApplicationDetailDto }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-3.5">
      <ContactFacts app={app} />
      <ContactOrigin app={app} />
    </div>
  );
}

function CandidateMessage({ app }: { app: ApplicationDetailDto }) {
  if (!app.message) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">Lời nhắn của ứng viên</span>
      <p className="m-0 border-l-2 border-silver bg-hover px-4 py-3.5 text-sm leading-relaxed text-ink">
        {app.message}
      </p>
    </div>
  );
}

interface BodyProps {
  app: ApplicationDetailDto;
  onError: (msg: string) => void;
  onDeleted: () => void;
}

/** One small row at the end: what is kept and for how long, and deleting. */
function EndRow({ app, onDeleted }: Omit<BodyProps, 'onError'>) {
  return (
    <div className="flex flex-col gap-3 border-t border-line-soft pt-4 sm:flex-row sm:items-start sm:justify-between">
      <RetentionNote />
      <DeleteApplication app={app} onDeleted={onDeleted} />
    </div>
  );
}

/** Two columns, each as tall as what it holds: the candidate on the left, HR's work on the right. */
function WideBody({ app, onError }: Omit<BodyProps, 'onDeleted'>) {
  return (
    <div className="grid grid-cols-2 items-start gap-5">
      <div role="group" aria-label="Về ứng viên" className="flex min-w-0 flex-col gap-4">
        <FactsCard app={app} />
        <CandidateMessage app={app} />
        <CvMatch app={app} />
        <CvPanel app={app} />
      </div>
      <div role="group" aria-label="Việc của HR" className="flex min-w-0 flex-col gap-4">
        <NoteTimeline key={app.id} app={app} onError={onError} />
        <ActivityLogRow app={app} />
        <ContactHistoryRow app={app} />
        <OtherApplicationsRow app={app} />
      </div>
    </div>
  );
}

/** Phones, the sheet and narrow panels: one column, in the order HR reads it. */
function NarrowBody({ app, onError }: Omit<BodyProps, 'onDeleted'>) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FactsCard app={app} />
      <NoteTimeline key={app.id} app={app} onError={onError} />
      <CvMatch app={app} />
      <CvPanel app={app} />
      <CandidateMessage app={app} />
      <ActivityLogRow app={app} />
      <ContactHistoryRow app={app} />
      <OtherApplicationsRow app={app} />
    </div>
  );
}

/**
 * The body of the detail, all in the one scroller around it. What needs deciding now (the reviewer, the interview
 * time) comes first, across the width; from 1280px the rest stands in two columns; deleting comes last.
 */
export function DetailFacts({ app, onError, onDeleted }: BodyProps) {
  const isWide = useMediaQuery('(min-width: 1280px)');
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ReviewStatus app={app} />
      {app.status === 'interview' && <InterviewTime app={app} onError={onError} />}
      {isWide ? <WideBody app={app} onError={onError} /> : <NarrowBody app={app} onError={onError} />}
      <EndRow app={app} onDeleted={onDeleted} />
    </div>
  );
}
