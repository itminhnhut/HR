import {
  CONTACT_CHANNEL_LABEL,
  fillTemplate,
  formatTimestamp,
  gmailComposeUrl,
  googleCalendarUrl,
  lastName,
  MAILTO_SAFE_LENGTH,
  mailtoUrl,
  TEMPLATE_KEYS,
  TEMPLATE_LABEL,
  type ApplicationDetailDto,
  type ContactChannel,
  type HrMe,
  type MessageTemplate,
  type TemplateKey,
  type TemplateValues,
} from '@careers/shared';
import { useRef, useState } from 'react';
import { useHrMe, useLogContact, useMessageTemplates } from '../../../api/queries';
import { copyText, useFlash, useMediaQuery } from '../../../lib/hooks';
import { SITE } from '../../../lib/site';
import { Button } from '../../../ui/Button';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { FieldError, SelectField } from '../../../ui/Field';
import { ErrorState, LoadingStatus, Notice } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { errorMessage } from '../parts';
import { interviewLabel } from './InterviewField';
import { MessageFields } from './MessageFields';

const interviewPlace = (app: ApplicationDetailDto) =>
  app.interviewMode === 'online' ? 'Online (Google Meet)' : SITE.officeAddress;

function valuesFor(app: ApplicationDetailDto, me: HrMe | null | undefined): TemplateValues {
  return {
    candidateName: lastName(app.fullName),
    jobTitle: app.jobTitle,
    interviewTime: app.interviewAt ? interviewLabel(app.interviewAt) : '',
    address: SITE.officeAddress,
    meetingUrl: app.meetingUrl ?? '',
    hrName: me?.name || '',
    hrPhone: me?.phone || '',
    company: SITE.company,
  };
}

/** The template that fits where the application is now. */
function suggestedTemplate(app: ApplicationDetailDto): TemplateKey {
  if (app.status === 'rejected') return 'rejection';
  if (app.status === 'interview') return app.interviewMode === 'online' ? 'interview_online' : 'interview_onsite';
  return 'call';
}

interface Draft {
  subject: string;
  body: string;
  missing: string[];
  values: TemplateValues;
  /** HR edited the text by hand, then a field changed: the new value is not in the text yet. */
  stale: boolean;
  edit: (next: { subject?: string; body?: string }) => void;
  setLocal: (key: keyof TemplateValues, value: string) => void;
  /** A value was saved (application or account): rebuild the text, unless HR edited it by hand. */
  changed: () => void;
  rebuild: () => void;
}

/**
 * The message text for one template: built from the template and the values, until HR edits it by hand.
 * After that, field changes no longer overwrite it; `stale` tells the UI to offer a rebuild.
 */
function useDraft(
  app: ApplicationDetailDto,
  me: HrMe | null | undefined,
  template: MessageTemplate | undefined,
): Draft {
  const key = template?.key;
  const [overrides, setOverrides] = useState<Partial<TemplateValues>>({});
  const [edited, setEdited] = useState<{ key: TemplateKey; subject: string; body: string } | null>(null);
  const [stale, setStale] = useState(false);
  const values = { ...valuesFor(app, me), ...overrides };
  const filledSubject = template ? fillTemplate(template.subject, values) : { text: '', missing: [] };
  const filledBody = template ? fillTemplate(template.body, values) : { text: '', missing: [] };
  const own = key !== undefined && edited?.key === key ? edited : null;
  const subject = own ? own.subject : filledSubject.text;
  const body = own ? own.body : filledBody.text;
  const changed = () => (own ? setStale(true) : setEdited(null));
  return {
    subject,
    body,
    values,
    stale: stale && !!own,
    missing: [...new Set([...filledSubject.missing, ...filledBody.missing])].filter(
      (token) => subject.includes(token) || body.includes(token),
    ),
    edit: (next) => key && setEdited({ key, subject: next.subject ?? subject, body: next.body ?? body }),
    setLocal: (k, v) => {
      setOverrides((o) => ({ ...o, [k]: v }));
      changed();
    },
    changed,
    rebuild: () => {
      setEdited(null);
      setStale(false);
    },
  };
}

function ComposeBody({
  app,
  initialKey,
  onClose,
}: {
  app: ApplicationDetailDto;
  initialKey?: TemplateKey;
  onClose: () => void;
}) {
  const templates = useMessageTemplates();
  const me = useHrMe();
  const [key, setKey] = useState<TemplateKey>(initialKey ?? suggestedTemplate(app));
  const template = templates.data?.templates.find((t) => t.key === key);
  const draft = useDraft(app, me.data, template);
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (templates.isPending) return <LoadingStatus />;
  if (templates.isError || !template) {
    return <ErrorState onRetry={() => templates.refetch()} message="Chưa tải được mẫu thư." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <SelectField label="Mẫu thư" value={key} onChange={(e) => setKey(e.target.value as TemplateKey)}>
        {TEMPLATE_KEYS.map((k) => (
          <option key={k} value={k}>
            {TEMPLATE_LABEL[k]}
          </option>
        ))}
      </SelectField>
      <MessageFields
        app={app}
        mode={key === 'interview_online' ? 'online' : key === 'interview_onsite' ? 'onsite' : undefined}
        me={me.data}
        text={`${template.subject}\n${template.body}`}
        values={draft.values}
        onLocal={draft.setLocal}
        onSaved={() => {
          setFieldError(null);
          draft.changed();
        }}
        onError={setFieldError}
      />
      <FieldError>{fieldError}</FieldError>
      <DraftNotices draft={draft} />
      <DraftEditor app={app} draft={draft} />
      <SendActions app={app} me={me.data} templateKey={key} draft={draft} onError={setFieldError} />
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </div>
  );
}

function DraftNotices({ draft }: { draft: Draft }) {
  return (
    <>
      {draft.stale && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-tint px-4 py-3 text-sm text-navy">
          <span>Bạn đã sửa tay nội dung thư, nên thông tin mới chưa được điền vào.</span>
          <button
            type="button"
            onClick={draft.rebuild}
            className="min-h-10 rounded-control border border-silver bg-white px-3 font-medium text-navy hover:bg-mist"
          >
            Điền lại thông tin mới vào thư
          </button>
        </div>
      )}
      {draft.missing.length > 0 && (
        <div role="note" className="rounded-control border border-[#e8d27a] bg-[#fff8db] px-4 py-3 text-sm text-navy">
          Còn thiếu: <strong className="font-semibold">{draft.missing.join(', ')}</strong>. Điền vào các ô tô vàng ở
          trên, hoặc sửa thẳng trong thư.
        </div>
      )}
    </>
  );
}

function DraftEditor({ app, draft }: { app: ApplicationDetailDto; draft: Draft }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Gửi tới</span>
        <span className="text-sm font-medium text-navy">{app.email ?? 'Ứng viên không để lại email'}</span>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Tiêu đề</span>
        <input
          value={draft.subject}
          onChange={(e) => draft.edit({ subject: e.target.value })}
          className="field-focus min-h-11 rounded-control border border-field bg-white px-3.5 text-sm text-navy outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Nội dung (sửa được trước khi gửi)</span>
        <textarea
          rows={12}
          value={draft.body}
          onChange={(e) => draft.edit({ body: e.target.value })}
          className="field-focus rounded-control border border-field bg-white px-3.5 py-3 text-sm leading-relaxed text-navy outline-none"
        />
      </label>
    </>
  );
}

/** One log line per message and channel, even after a double click; a failed write can be retried. */
function useRecordContact(app: ApplicationDetailDto, templateKey: TemplateKey, onError: (message: string) => void) {
  const log = useLogContact();
  const lastLogged = useRef('');
  return (channel: ContactChannel, text: string) => {
    const stamp = `${templateKey}:${channel}:${text}`;
    if (lastLogged.current === stamp) return;
    lastLogged.current = stamp;
    log.mutate(
      { id: app.id, templateKey, channel },
      {
        onError: (e) => {
          lastLogged.current = '';
          onError(`Chưa ghi được lịch sử liên hệ: ${errorMessage(e)}`);
        },
      },
    );
  };
}

const primaryLink = 'btn-glow bg-accent font-medium text-white hover:text-white';
const secondaryLink = 'border border-silver bg-white text-navy hover:bg-mist';

function SendActions({
  app,
  me,
  templateKey,
  draft,
  onError,
}: {
  app: ApplicationDetailDto;
  me: HrMe | null | undefined;
  templateKey: TemplateKey;
  draft: Draft;
  onError: (message: string) => void;
}) {
  const [copied, flash] = useFlash();
  const record = useRecordContact(app, templateKey, onError);
  // Gmail's web compose link does not survive on phones (inbox or app store), so phones get the mail app first.
  const isPhone = useMediaQuery('(max-width: 639px)');
  const { subject, body } = draft;
  const text = `${subject}\n${body}`;
  const mailto = app.email ? mailtoUrl(app.email, subject, body) : '';
  return (
    <>
      {/* On phones the send buttons stay at the bottom of the dialog, reachable with one thumb. */}
      <div className="flex flex-wrap gap-2 max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-6 max-sm:border-t max-sm:border-line max-sm:bg-white max-sm:px-6 max-sm:py-3">
        {app.email ? (
          <>
            <a
              href={gmailComposeUrl(app.email, subject, body, me?.contactEmail)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => record('gmail', text)}
              className={`${isPhone ? `order-2 ${secondaryLink}` : primaryLink} inline-flex min-h-11 items-center gap-2 rounded-control px-4 text-sm no-underline`}
            >
              <Icon name="mail" size={16} />
              Mở Gmail{isPhone ? ' (web)' : ''}
            </a>
            {mailto.length > MAILTO_SAFE_LENGTH ? (
              <span className="self-center text-xs text-muted">
                Thư dài, ứng dụng mail có thể cắt bớt: dùng Gmail hoặc Sao chép.
              </span>
            ) : (
              <a
                href={mailto}
                onClick={() => record('mailto', text)}
                className={`${isPhone ? `order-1 ${primaryLink}` : secondaryLink} inline-flex min-h-11 items-center gap-2 rounded-control px-4 text-sm no-underline`}
              >
                <Icon name="external" size={16} />
                Mở ứng dụng mail
              </a>
            )}
          </>
        ) : (
          <span className="text-sm text-muted">Không có email: sao chép rồi gửi qua Zalo.</span>
        )}
        <button
          type="button"
          onClick={() =>
            // For Zalo: the body only, the "[Công ty] …" subject line reads oddly in a chat.
            copyText(body).then((ok) => {
              if (!ok) return;
              flash();
              record('copy', text);
            })
          }
          className="order-3 inline-flex min-h-11 items-center gap-2 rounded-control border border-field bg-white px-4 text-sm text-body hover:bg-mist"
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
      </div>
      <p className="m-0 text-xs text-muted">
        Thư gửi từ Gmail đang đăng nhập trên máy này
        {me?.contactEmail ? ` (nên là ${me.contactEmail})` : ''}: kiểm tra người gửi trước khi bấm Gửi.
      </p>
    </>
  );
}

/** The "Soạn thư" button and dialog. `request` opens it from elsewhere (e.g. right after "Chưa phù hợp"). */
export function ComposeMessage({
  app,
  request,
  onRequestDone,
}: {
  app: ApplicationDetailDto;
  request?: TemplateKey | null;
  onRequestDone?: () => void;
}) {
  const [opened, setOpen] = useState(false);
  const open = opened || !!request;
  const close = () => {
    setOpen(false);
    onRequestDone?.();
  };
  return (
    <>
      <Button variant="outline" icon="mail" onClick={() => setOpen(true)} className="self-start">
        Soạn thư
      </Button>
      <Dialog
        open={open}
        onClose={close}
        label="Soạn thư"
        variant="panel"
        className="sm:!w-[min(680px,calc(100vw-48px))]"
      >
        <div className="flex max-h-[92dvh] flex-col gap-4 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 font-serif text-[24px] font-medium">Soạn thư</h2>
              <span className="text-sm text-slate">
                {app.fullName} · {app.jobTitle}
              </span>
            </div>
            <CloseButton onClick={close} />
          </div>
          {open && <ComposeBody app={app} initialKey={request ?? undefined} onClose={close} />}
        </div>
      </Dialog>
    </>
  );
}

/** "Đã soạn thư …": what HR prepared for this person. The site cannot see whether it was really sent. */
export function ContactHistory({ app }: { app: ApplicationDetailDto }) {
  if (app.contacts.length === 0) return null;
  return (
    <Notice tone="mist" icon="mail">
      <span className="flex flex-col gap-1">
        {app.contacts.slice(0, 5).map((c) => (
          <span key={c.createdAt + c.templateKey} className="text-[13px]">
            Đã soạn thư <strong className="font-semibold">{TEMPLATE_LABEL[c.templateKey]}</strong> (
            {CONTACT_CHANNEL_LABEL[c.channel].toLowerCase()}) · {formatTimestamp(c.createdAt)} · {c.hrName}
          </span>
        ))}
      </span>
    </Notice>
  );
}

/** HR-side Google Calendar link: the candidate is added as a guest; HR clicks "Thêm Google Meet" and saves. */
export function hrCalendarUrl(app: ApplicationDetailDto): string | null {
  if (!app.interviewAt) return null;
  return googleCalendarUrl({
    title: `Phỏng vấn ${app.fullName} - ${app.jobTitle}`,
    startIso: app.interviewAt,
    details: `Ứng viên: ${app.fullName}, ${app.phone}${app.email ? `, ${app.email}` : ''}`,
    location: interviewPlace(app),
    guest: app.email,
  });
}
