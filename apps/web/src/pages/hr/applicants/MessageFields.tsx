import {
  PLACEHOLDERS,
  type ApplicationDetailDto,
  type HrMe,
  type MessageTemplate,
  type TemplateValues,
} from '@careers/shared';
import { useState, type ReactNode } from 'react';
import { useUpdateApplication, useUpdateProfile } from '../../../api/queries';
import { ApiError, type ApplicationPatch, type HrProfilePatch } from '../../../api';
import { errorMessage } from '../parts';

/** The first field error ("Số điện thoại tối đa 30 ký tự"), not just "Kiểm tra lại thông tin". */
const fieldMessage = (e: unknown) =>
  e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : errorMessage(e);
import { InterviewField } from './InterviewField';
import { fieldsFor, isUsableLink } from './mailFields';

type Key = keyof TemplateValues;

/** Boxes saved in the HR account, by the name of the value they fill in the mail. */
const ACCOUNT_BOXES: Partial<
  Record<
    Key,
    { save: 'name' | 'phone' | 'jobTitle' | 'alias'; type?: string; maxLength?: number; placeholder?: string }
  >
> = {
  hrName: { save: 'name' },
  hrPhone: { save: 'phone', type: 'tel', maxLength: 30, placeholder: '0909 000 111' },
  hrTitle: { save: 'jobTitle', maxLength: 100, placeholder: 'HR Generalist' },
  hrAlias: { save: 'alias', maxLength: 100, placeholder: 'Ms. Lee' },
};

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
  interviewDate: 'Ngày phỏng vấn',
  interviewer: 'Người trao đổi',
  duration: 'Thời lượng',
  hrTitle: 'Chức danh HR',
  hrAlias: 'Tên gọi khác',
};

/** Where an edit is kept: on the application, in the HR account, or only in this message. */
const SAVED_IN: Partial<Record<Key, string>> = {
  interviewTime: 'lưu vào hồ sơ',
  meetingUrl: 'lưu vào hồ sơ',
  hrName: 'lưu vào tài khoản của bạn',
  hrPhone: 'lưu vào tài khoản của bạn',
  hrTitle: 'không bắt buộc, lưu vào tài khoản của bạn',
  hrAlias: 'không bắt buộc',
};

/** "Link Meet" with text that is not a link is left out of the mail: say why it is still asked for. */
const hintFor = (key: Key, values: TemplateValues) =>
  key === 'meetingUrl' && values.meetingUrl.trim() && !isUsableLink(values.meetingUrl)
    ? 'link phải bắt đầu bằng https://'
    : SAVED_IN[key];

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
      onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && (e.target as HTMLInputElement).blur()}
      className={inputClass(missing)}
    />
  );
}

/** Saves a field where it belongs: on the application, or in the HR account. */
function useFieldSaving(
  app: ApplicationDetailDto,
  me: HrMe | null | undefined,
  onSaved: () => void,
  onError: (message: string) => void,
) {
  const updateApp = useUpdateApplication();
  const updateProfile = useUpdateProfile();
  const replies = { onSuccess: onSaved, onError: (e: unknown) => onError(fieldMessage(e)) };
  return {
    isSavingApp: updateApp.isPending,
    saveApp: (patch: ApplicationPatch) => updateApp.mutate({ id: app.id, patch }, replies),
    saveProfile: (patch: Partial<HrProfilePatch>) =>
      updateProfile.mutate(
        {
          name: me?.name ?? '',
          phone: me?.phone ?? '',
          contactEmail: me?.contactEmail ?? '',
          jobTitle: me?.jobTitle ?? '',
          alias: me?.alias ?? '',
          ...patch,
        },
        replies,
      ),
  };
}

interface MessageFieldsProps {
  app: ApplicationDetailDto;
  /** Interview mode implied by the chosen template, if any. */
  mode?: 'onsite' | 'online';
  me: HrMe | null | undefined;
  /** To know which fields the mail uses. */
  template: MessageTemplate;
  values: TemplateValues;
  /** Tokens still to fill: their boxes are tinted. */
  missing: string[];
  onLocal: (key: Key, value: string) => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

type Saving = ReturnType<typeof useFieldSaving>;

/** An interview time belongs to "Hẹn phỏng vấn": moving there shows "Mời phỏng vấn" to the candidate, so it is confirmed first. */
function InterviewBox({ app, mode, saving }: Pick<MessageFieldsProps, 'app' | 'mode'> & { saving: Saving }) {
  return (
    <InterviewField
      showTitle={false}
      value={app.interviewAt}
      disabled={saving.isSavingApp}
      onChange={(interviewAt) => {
        // The online template makes it an online interview, so the detail view and calendar agree.
        const details = { interviewAt, ...(mode ? { interviewMode: mode } : {}) };
        if (app.status === 'interview') return saving.saveApp(details);
        if (window.confirm(MOVE_TO_INTERVIEW)) saving.saveApp({ status: 'interview', ...details });
      }}
    />
  );
}

function MeetingBox({
  app,
  isEmpty,
  onLocal,
  saving,
}: Pick<MessageFieldsProps, 'app' | 'onLocal'> & { isEmpty: boolean; saving: Saving }) {
  return (
    <SavedInput
      key={app.meetingUrl ?? ''}
      label="Link Meet"
      onTyping={(v) => onLocal('meetingUrl', v)}
      type="url"
      initial={app.meetingUrl ?? ''}
      missing={isEmpty}
      placeholder="https://meet.google.com/…"
      // Interview details are only stored once the application is "Hẹn phỏng vấn"; before that the
      // link stays in this message only.
      onSave={(meetingUrl) => app.status === 'interview' && saving.saveApp({ meetingUrl, interviewMode: 'online' })}
    />
  );
}

/** The box for one field. `isEmpty` tints it. */
function FieldBox({
  field: key,
  isEmpty,
  app,
  me,
  values,
  mode,
  onLocal,
  saving,
}: Pick<MessageFieldsProps, 'app' | 'me' | 'values' | 'mode' | 'onLocal'> & {
  field: Key;
  isEmpty: boolean;
  saving: Saving;
}) {
  const box = ACCOUNT_BOXES[key];
  if (box) {
    const saved = me?.[box.save] ?? '';
    return (
      <SavedInput
        key={saved}
        label={LABEL[key]}
        onTyping={(v) => onLocal(key, v)}
        type={box.type}
        maxLength={box.maxLength}
        initial={saved}
        missing={isEmpty}
        placeholder={box.placeholder}
        onSave={(value) => saving.saveProfile({ [box.save]: value })}
      />
    );
  }
  if (key === 'interviewTime') return <InterviewBox app={app} mode={mode} saving={saving} />;
  if (key === 'meetingUrl') return <MeetingBox app={app} isEmpty={isEmpty} onLocal={onLocal} saving={saving} />;
  return (
    <input
      aria-label={LABEL[key]}
      value={values[key]}
      onChange={(e) => onLocal(key, e.target.value)}
      className={inputClass(isEmpty)}
    />
  );
}

const SIGNATURE_KEYS: readonly Key[] = ['hrName', 'hrPhone', 'hrTitle', 'hrAlias'];
const WIDE_KEYS: readonly Key[] = ['interviewTime', 'address', 'interviewer'];

/** Stays filled from one mail to the next, so it folds away as one line unless something is missing. */
function SignatureGroup({
  values,
  isIncomplete,
  children,
}: {
  values: TemplateValues;
  isIncomplete: boolean;
  children: ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const isShown = isOpen || isIncomplete;
  const summary = [values.hrName, values.hrPhone, values.hrTitle].map((v) => v.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <button
        type="button"
        aria-expanded={isShown}
        onClick={() => setOpen(!isOpen)}
        className="flex min-h-10 items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-navy"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted">Người gửi</span>
          <span className="truncate text-sm">{summary.join(' · ') || 'Chưa điền'}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-slate">{isShown ? 'Thu gọn' : 'Sửa'}</span>
      </button>
      <div className={`grid gap-3 sm:grid-cols-2 ${isShown ? '' : 'hidden'}`}>{children}</div>
    </div>
  );
}

/**
 * One box per piece of information the chosen mail uses, so HR fills what is missing right here. Interview time
 * and Meet link go into the application, HR details into the account, the rest only into this message.
 */
export function MessageFields(props: MessageFieldsProps) {
  const { app, me, template, values, missing, mode, onLocal, onSaved, onError } = props;
  const saving = useFieldSaving(app, me, onSaved, onError);
  const isMissing = (key: Key) => PLACEHOLDERS.some((p) => p.key === key && missing.includes(p.token));
  const fields = fieldsFor(template);
  const box = (key: Key) => (
    <div key={key} className={WIDE_KEYS.includes(key) ? 'sm:col-span-2' : ''}>
      <Row label={LABEL[key]} hint={hintFor(key, values)} missing={isMissing(key)}>
        <FieldBox
          field={key}
          isEmpty={isMissing(key)}
          app={app}
          me={me}
          values={values}
          mode={mode}
          onLocal={onLocal}
          saving={saving}
        />
      </Row>
    </div>
  );
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-card border border-line p-4">
      <legend className="px-1.5 text-sm font-medium text-navy">Thông tin trong thư</legend>
      <div className="grid gap-3 sm:grid-cols-2">{fields.filter((k) => !SIGNATURE_KEYS.includes(k)).map(box)}</div>
      <SignatureGroup values={values} isIncomplete={SIGNATURE_KEYS.some(isMissing)}>
        {fields.filter((k) => SIGNATURE_KEYS.includes(k)).map(box)}
      </SignatureGroup>
    </fieldset>
  );
}
