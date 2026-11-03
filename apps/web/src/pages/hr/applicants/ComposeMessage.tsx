import {
  MAIL_COMPANY,
  CONTACT_CHANNEL_LABEL,
  formatTimestamp,
  googleCalendarUrl,
  TEMPLATE_KEYS,
  TEMPLATE_LABEL,
  type ApplicationDetailDto,
  type MessageTemplate,
  type TemplateKey,
} from '@careers/shared';
import { useState } from 'react';
import { useHrMe, useMessageTemplates } from '../../../api/queries';
import { buttonClass } from '../../../ui/Button';
import { CloseButton, Dialog } from '../../../ui/Dialog';
import { FieldError, SelectField } from '../../../ui/Field';
import { ErrorState, LoadingStatus, Notice } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { designedMailHtml } from '../mail/mailLogos';
import { MailPreview } from '../mail/MailPreview';
import { DraftEditor, DraftNotices } from './DraftEditor';
import { MessageFields } from './MessageFields';
import { SendActions } from './SendActions';
import { suggestedTemplate, useMailDraft, type MailDraft } from './useMailDraft';

const interviewPlace = (app: ApplicationDetailDto) =>
  app.interviewMode === 'online' ? 'Online (Google Meet)' : MAIL_COMPANY.officeAddress;

const interviewModeOf = (key: TemplateKey) =>
  key === 'interview_online' ? 'online' : key === 'interview_onsite' ? 'onsite' : undefined;

function TemplateSelect({ value, onChange }: { value: TemplateKey; onChange: (key: TemplateKey) => void }) {
  return (
    <SelectField label="Mẫu thư" value={value} onChange={(e) => onChange(e.target.value as TemplateKey)}>
      {TEMPLATE_KEYS.map((k) => (
        <option key={k} value={k}>
          {TEMPLATE_LABEL[k]}
        </option>
      ))}
    </SelectField>
  );
}

type ComposeView = 'edit' | 'preview';

/** On phones the form and the mail share one screen, so HR switches between them. */
function ViewTabs({ view, onChange }: { view: ComposeView; onChange: (view: ComposeView) => void }) {
  const tabs: { key: ComposeView; label: string }[] = [
    { key: 'edit', label: 'Soạn' },
    { key: 'preview', label: 'Xem trước' },
  ];
  return (
    <div className="flex gap-1 border-b border-line px-4 py-2 lg:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-pressed={view === tab.key}
          onClick={() => onChange(tab.key)}
          className={`min-h-10 flex-1 rounded-control text-sm font-medium ${view === tab.key ? 'bg-navy text-white' : 'bg-white text-slate'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DraftPreview({ draft, isHiddenOnPhone }: { draft: MailDraft; isHiddenOnPhone: boolean }) {
  return (
    <section
      aria-label="Xem trước thư"
      className={`flex min-h-0 min-w-0 flex-col bg-[#fbeaec] lg:border-l lg:border-line ${isHiddenOnPhone ? 'max-lg:hidden' : ''}`}
    >
      <MailPreview
        templateKey={draft.content.key}
        title="Xem trước thư"
        html={designedMailHtml(draft.content, draft.details)}
        className="min-h-0 flex-1"
        isWideOnDesktop
      />
    </section>
  );
}

function ComposeForm({
  app,
  template,
  onChooseTemplate,
}: {
  app: ApplicationDetailDto;
  template: MessageTemplate;
  onChooseTemplate: (key: TemplateKey) => void;
}) {
  const me = useHrMe();
  const draft = useMailDraft(app, me.data, template);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [view, setView] = useState<ComposeView>('edit');
  return (
    <>
      <ViewTabs view={view} onChange={setView} />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <div
          className={`flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-5 max-sm:p-4 ${view === 'preview' ? 'max-lg:hidden' : ''}`}
        >
          <TemplateSelect value={template.key} onChange={onChooseTemplate} />
          <MessageFields
            app={app}
            mode={interviewModeOf(template.key)}
            me={me.data}
            template={template}
            values={draft.values}
            missing={draft.missing}
            onLocal={draft.setLocal}
            onSaved={() => setFieldError(null)}
            onError={setFieldError}
          />
          <FieldError>{fieldError}</FieldError>
          <DraftNotices draft={draft} />
          <DraftEditor app={app} template={template} draft={draft} />
        </div>
        <DraftPreview draft={draft} isHiddenOnPhone={view === 'edit'} />
      </div>
      <SendActions app={app} me={me.data} draft={draft} onError={setFieldError} />
    </>
  );
}

function ComposeBody({ app, initialKey }: { app: ApplicationDetailDto; initialKey?: TemplateKey }) {
  const templates = useMessageTemplates();
  const [key, setKey] = useState<TemplateKey>(initialKey ?? suggestedTemplate(app));
  const template = templates.data?.templates.find((t) => t.key === key);

  if (templates.isPending) return <LoadingStatus />;
  if (templates.isError || !template) {
    return <ErrorState onRetry={() => templates.refetch()} message="Chưa tải được mẫu thư." />;
  }
  return <ComposeForm app={app} template={template} onChooseTemplate={setKey} />;
}

/** The "Soạn thư" button and drawer. `request` opens it from elsewhere (e.g. right after "Chưa phù hợp"). */
export function ComposeMessage({
  app,
  request,
  onRequestDone,
  triggerClassName = buttonClass('outline', 'md', 'self-start'),
}: {
  app: ApplicationDetailDto;
  request?: TemplateKey | null;
  onRequestDone?: () => void;
  triggerClassName?: string;
}) {
  const [opened, setOpen] = useState(false);
  const open = opened || !!request;
  const close = () => {
    setOpen(false);
    onRequestDone?.();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        <Icon name="mail" size={16} />
        Soạn thư
      </button>
      <Dialog open={open} onClose={close} label="Soạn thư" variant="side" closeOnBackdrop={false}>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 max-sm:px-4">
            <div className="flex min-w-0 flex-col">
              <h2 className="m-0 font-serif text-[22px] font-medium">Soạn thư</h2>
              <span className="truncate text-sm text-slate">
                {app.fullName} · {app.jobTitle}
              </span>
            </div>
            <CloseButton onClick={close} />
          </header>
          {open && <ComposeBody app={app} initialKey={request ?? undefined} />}
        </div>
      </Dialog>
    </>
  );
}

/** "Đã soạn thư …": what HR prepared for this person. The site cannot see whether it was really sent. */
export function ContactHistory({ app, limit = 5 }: { app: ApplicationDetailDto; limit?: number }) {
  if (app.contacts.length === 0) return null;
  return (
    <Notice tone="mist" icon="mail">
      <span className="flex flex-col gap-1">
        {app.contacts.slice(0, limit).map((c) => (
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
