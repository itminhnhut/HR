import {
  DEFAULT_MESSAGE_TEMPLATES,
  PLACEHOLDERS,
  SUBJECT_MAX,
  TEMPLATE_BODY_MAX,
  TEMPLATE_KEYS,
  TEMPLATE_LABEL,
  addDays,
  fillTemplate,
  todayInVietnam,
  type HrMe,
  type MessageTemplate,
  type TemplateValues,
  type TemplateKey,
} from '@careers/shared';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api';
import { useHrMe, useMessageTemplateActions, useMessageTemplates } from '../../api/queries';
import { SITE } from '../../lib/site';
import { interviewLabel } from './applicants/InterviewField';
import { usePageMeta } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../ui/feedback';
import { apiMessage, errorMessage, FilterTabs, PageHeading, type TabItem } from './parts';

/** Buttons that insert "{Tên ứng viên}" etc. where the cursor is, so nobody types the braces by hand. */
function PlaceholderButtons({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">Bấm để chèn thông tin, web tự điền khi soạn thư cho từng người:</span>
      <div className="flex flex-wrap gap-1.5">
        {PLACEHOLDERS.map(({ token }) => (
          <button
            key={token}
            type="button"
            // Keep the cursor in the text box.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(token)}
            className="min-h-9 rounded-full border border-ring bg-tint px-3 text-[13px] text-accent hover:bg-remind"
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A made-up candidate, so HR sees the finished message while editing the template. */
function sampleValues(me: HrMe | null | undefined): TemplateValues {
  const start = `${addDays(todayInVietnam(), 2)}T09:00:00+07:00`;
  return {
    candidateName: 'Minh Anh',
    jobTitle: 'Nhân viên Kinh doanh',
    interviewTime: interviewLabel(start),
    address: SITE.officeAddress,
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    hrName: me?.name ?? '',
    hrPhone: me?.phone ?? '',
    company: SITE.company,
  };
}

function SamplePreview({ subject, body }: { subject: string; body: string }) {
  const me = useHrMe();
  const values = sampleValues(me.data);
  const filledSubject = fillTemplate(subject, values);
  const filledBody = fillTemplate(body, values);
  const missing = [...new Set([...filledSubject.missing, ...filledBody.missing])];
  return (
    <section aria-label="Xem thử" className="flex flex-col gap-2 rounded-card border border-line bg-mist p-4">
      <span className="text-xs font-medium text-slate">Xem thử với ứng viên mẫu (Minh Anh)</span>
      <strong className="text-sm font-semibold text-navy">{filledSubject.text}</strong>
      <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-body">{filledBody.text}</p>
      {missing.length > 0 && (
        <span className="text-xs text-[#8a6d00]">
          {missing.join(', ')} chưa có: điền ở <Link to="/hr/tai-khoan">Tài khoản HR</Link> (tên, số điện thoại).
        </span>
      )}
    </section>
  );
}

function TemplateEditor({ template, customized }: { template: MessageTemplate; customized: boolean }) {
  const { save, reset } = useMessageTemplateActions();
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [focus, setFocus] = useState<'subject' | 'body'>('body');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  // Compared with what the server has now, so after a save or reset the button settles without a remount.
  const dirty = subject !== template.subject || body !== template.body;

  const insert = (token: string) => {
    const el = focus === 'subject' ? subjectRef.current : bodyRef.current;
    const value = focus === 'subject' ? subject : body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (focus === 'subject') setSubject(next);
    else setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onError = (e: unknown) =>
    setNotice({
      ok: false,
      text: e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : errorMessage(e),
    });

  return (
    <div className="flex max-w-[860px] flex-col gap-4 rounded-card border border-line bg-white px-4 py-5 sm:px-6">
      {notice && (
        <Notice tone={notice.ok ? 'ok' : 'error'} icon={notice.ok ? 'check' : 'alert'}>
          <span role={notice.ok ? 'status' : 'alert'}>{notice.text}</span>
        </Notice>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-navy">Tiêu đề</span>
        <input
          ref={subjectRef}
          maxLength={SUBJECT_MAX}
          value={subject}
          onFocus={() => setFocus('subject')}
          onChange={(e) => setSubject(e.target.value)}
          className="field-focus min-h-[52px] rounded-control border border-field bg-white px-4 text-[15px] text-navy outline-none"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-navy">Nội dung</span>
        <textarea
          ref={bodyRef}
          rows={14}
          maxLength={TEMPLATE_BODY_MAX}
          value={body}
          onFocus={() => setFocus('body')}
          onChange={(e) => setBody(e.target.value)}
          className="field-focus rounded-control border border-field bg-white px-4 py-3 text-[15px] leading-relaxed text-navy outline-none"
        />
        <span className="self-end text-xs text-muted">
          {body.length}/{TEMPLATE_BODY_MAX}
        </span>
      </label>
      <PlaceholderButtons onInsert={insert} />
      <SamplePreview subject={subject} body={body} />
      <div className="flex flex-wrap justify-end gap-2.5">
        {customized && (
          <Button
            variant="ghost"
            icon="copy"
            disabled={reset.isPending}
            onClick={() =>
              reset.mutate(template.key, {
                onSuccess: () => {
                  setSubject(DEFAULT_MESSAGE_TEMPLATES[template.key].subject);
                  setBody(DEFAULT_MESSAGE_TEMPLATES[template.key].body);
                  setNotice({ ok: true, text: 'Đã dùng lại mẫu gốc.' });
                },
                onError,
              })
            }
            className="sm:mr-auto"
          >
            Dùng lại mẫu gốc
          </Button>
        )}
        <Button
          icon="check"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate(
              { key: template.key, subject, body },
              {
                onSuccess: (data) => {
                  // The server trims spaces; take its version so the form is not "changed" right after saving.
                  const saved = data.templates.find((t) => t.key === template.key);
                  if (saved) {
                    setSubject(saved.subject);
                    setBody(saved.body);
                  }
                  setNotice({ ok: true, text: 'Đã lưu mẫu thư.' });
                },
                onError,
              },
            )
          }
          className="px-7"
        >
          {save.isPending ? 'Đang lưu…' : 'Lưu mẫu'}
        </Button>
      </div>
    </div>
  );
}

export function HrMessagesPage() {
  usePageMeta('Mẫu thư');
  const query = useMessageTemplates();
  const showSkeleton = useDelayedFlag(query.isPending);
  const [tab, setTab] = useState<TemplateKey>(TEMPLATE_KEYS[0]);
  const tabs: TabItem<TemplateKey>[] = TEMPLATE_KEYS.map((key) => ({ key, label: TEMPLATE_LABEL[key] }));
  const template = query.data?.templates.find((t) => t.key === tab);

  return (
    <>
      <PageHeading
        title="Mẫu thư"
        titleHiddenOnPhone
        subtitle="Thư HR gửi cho ứng viên bằng Gmail của mình hoặc dán vào Zalo. Mọi HR dùng chung các mẫu này."
      />
      <FilterTabs items={tabs} value={tab} onChange={setTab} label="Chọn mẫu thư" className="border-b border-field" />
      {query.isPending && (
        <>
          <LoadingStatus />
          {showSkeleton && <Sk w="100%" h={420} />}
        </>
      )}
      {query.isError && <ErrorState onRetry={() => query.refetch()} message={apiMessage(query.error)} />}
      {template && (
        <TemplateEditor
          key={template.key}
          template={template}
          customized={query.data?.customized.includes(template.key) ?? false}
        />
      )}
    </>
  );
}

export default HrMessagesPage;
