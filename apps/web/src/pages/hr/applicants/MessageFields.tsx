import { PLACEHOLDERS, type ApplicationDetailDto, type HrMe, type TemplateValues } from '@careers/shared';
import { useState, type ReactNode } from 'react';
import { useUpdateApplication, useUpdateProfile } from '../../../api/queries';
import { ApiError } from '../../../api';
import { errorMessage } from '../parts';

/** The first field error ("Số điện thoại tối đa 30 ký tự"), not just "Kiểm tra lại thông tin". */
const fieldMessage = (e: unknown) =>
  e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : errorMessage(e);
import { InterviewField } from './InterviewField';

type Key = keyof TemplateValues;

const MOVE_TO_INTERVIEW =
  'Đặt giờ phỏng vấn sẽ chuyển hồ sơ sang "Hẹn phỏng vấn": ứng viên tra cứu sẽ thấy "Mời phỏng vấn" ngay. Tiếp tục?';

const LABEL: Record<Key, string> = {
  candidateName: 'Tên ứng viên (cách gọi)',
  jobTitle: 'Vị trí',
  interviewTime: 'Giờ phỏng vấn',
  address: 'Địa chỉ',
  meetingUrl: 'Link Meet',
  hrName: 'Tên HR',
  hrPhone: 'SĐT HR',
  company: 'Công ty',
};

/** Where an edit is kept: on the application, in the HR account, or only in this message. */
const SAVED_IN: Partial<Record<Key, string>> = {
  interviewTime: 'lưu vào hồ sơ',
  meetingUrl: 'lưu vào hồ sơ',
  hrName: 'lưu vào tài khoản của bạn',
  hrPhone: 'lưu vào tài khoản của bạn',
};

function Row({
  label,
  hint,
  missing,
  children,
}: {
  label: string;
  hint?: string;
  missing: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className={missing ? 'font-semibold text-[#8a6d00]' : 'text-muted'}>{label}</span>
        {hint && <span className="text-muted">({hint})</span>}
      </span>
      {children}
    </div>
  );
}

const inputClass = (missing: boolean) =>
  `field-focus min-h-11 w-full rounded-control border px-3.5 text-sm text-navy outline-none ${missing ? 'border-[#e8d27a] bg-[#fff8db]' : 'border-field bg-white'}`;

/**
 * A text box whose value goes into the message as it is typed (`onTyping`), and is saved to the server when
 * the box loses focus, so clicking "Mở Gmail" straight after typing already carries it.
 */
function SavedInput({
  label,
  initial,
  missing,
  placeholder,
  type = 'text',
  maxLength,
  onTyping,
  onSave,
}: {
  label: string;
  initial: string;
  missing: boolean;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  onTyping: (value: string) => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      aria-label={label}
      type={type}
      maxLength={maxLength}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        setValue(e.target.value);
        onTyping(e.target.value);
      }}
      onBlur={() => value.trim() !== initial && onSave(value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={inputClass(missing && !value.trim())}
    />
  );
}

/**
 * One box per piece of information the chosen template uses, so HR fills what is missing right here.
 * Interview time and Meet link go into the application, HR name/phone into the account, the rest only into
 * this message.
 */
export function MessageFields({
  app,
  me,
  text,
  values,
  mode,
  onLocal,
  onSaved,
  onError,
}: {
  app: ApplicationDetailDto;
  /** Interview mode implied by the chosen template, if any. */
  mode?: 'onsite' | 'online';
  me: HrMe | null | undefined;
  /** Template subject + body, to know which fields it uses. */
  text: string;
  values: TemplateValues;
  onLocal: (key: Key, value: string) => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const updateApp = useUpdateApplication();
  const updateProfile = useUpdateProfile();
  const used = PLACEHOLDERS.filter((p) => text.includes(p.token));
  if (used.length === 0) return null;

  const saveApp = (patch: Parameters<typeof updateApp.mutate>[0]['patch']) =>
    updateApp.mutate({ id: app.id, patch }, { onSuccess: onSaved, onError: (e) => onError(fieldMessage(e)) });
  const saveProfile = (patch: { name?: string; phone?: string }) =>
    updateProfile.mutate(
      { name: me?.name ?? '', phone: me?.phone ?? '', contactEmail: me?.contactEmail ?? '', ...patch },
      { onSuccess: onSaved, onError: (e) => onError(fieldMessage(e)) },
    );

  const field = (key: Key) => {
    const missing = !values[key].trim();
    switch (key) {
      case 'interviewTime':
        return (
          <InterviewField
            showTitle={false}
            value={app.interviewAt}
            disabled={updateApp.isPending}
            // An interview time belongs to "Hẹn phỏng vấn": moving there shows "Mời phỏng vấn" to the candidate,
            // so it is confirmed first.
            onChange={(interviewAt) => {
              // The online template makes it an online interview, so the detail view and calendar agree.
              const details = { interviewAt, ...(mode ? { interviewMode: mode } : {}) };
              if (app.status === 'interview') return saveApp(details);
              if (window.confirm(MOVE_TO_INTERVIEW)) saveApp({ status: 'interview', ...details });
            }}
          />
        );
      case 'meetingUrl':
        return (
          <SavedInput
            key={app.meetingUrl ?? ''}
            label="Link Meet"
            onTyping={(v) => onLocal('meetingUrl', v)}
            type="url"
            initial={app.meetingUrl ?? ''}
            missing={missing}
            placeholder="https://meet.google.com/…"
            // Interview details are only stored once the application is "Hẹn phỏng vấn"; before that the
            // link stays in this message only.
            onSave={(meetingUrl) => app.status === 'interview' && saveApp({ meetingUrl, interviewMode: 'online' })}
          />
        );
      case 'hrName':
        return (
          <SavedInput
            key={me?.name ?? ''}
            label="Tên HR"
            onTyping={(v) => onLocal('hrName', v)}
            initial={me?.name ?? ''}
            missing={missing}
            onSave={(name) => saveProfile({ name })}
          />
        );
      case 'hrPhone':
        return (
          <SavedInput
            key={me?.phone ?? ''}
            label="SĐT HR"
            onTyping={(v) => onLocal('hrPhone', v)}
            type="tel"
            maxLength={30}
            initial={me?.phone ?? ''}
            missing={missing}
            placeholder="0909 000 111"
            onSave={(phone) => saveProfile({ phone })}
          />
        );
      default:
        return (
          <input
            aria-label={LABEL[key]}
            value={values[key]}
            onChange={(e) => onLocal(key, e.target.value)}
            className={inputClass(missing)}
          />
        );
    }
  };

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-card border border-line p-4">
      <legend className="px-1.5 text-sm font-medium text-navy">Thông tin trong thư</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {used.map(({ key }) => (
          <div key={key} className={key === 'interviewTime' || key === 'address' ? 'sm:col-span-2' : ''}>
            <Row label={LABEL[key]} hint={SAVED_IN[key]} missing={!values[key].trim()}>
              {field(key)}
            </Row>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
