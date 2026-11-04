import { toggleClass } from '../shadcn/toggle';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  PLACEHOLDERS,
  SUBJECT_MAX,
  addDays,
  fillTemplateSections,
  MAIL_COMPANY,
  todayInVietnam,
  vietnamInterviewParts,
  type HrMe,
  type MessageTemplate,
  type TemplateKey,
  type TemplateValues,
} from '@careers/shared';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../api';
import { useHrMe, useMessageTemplateActions } from '../../../api/queries';
import { Button } from '../../../ui/Button';
import { Notice } from '../../../ui/feedback';
import { interviewLabel } from '../applicants/InterviewField';
import { errorMessage } from '../parts';
import { designedMailHtml } from './mailLogos';
import { MailPreview } from './MailPreview';
import { mailDetails, sectionsFor, type SectionField } from './mailSections';

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
            className={toggleClass(false)}
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A made-up candidate, so HR sees the finished mail while editing the template. */
function sampleValues(me: HrMe | null | undefined, start: string, key: TemplateKey): TemplateValues {
  return {
    candidateName: 'Minh Anh',
    jobTitle: 'Nhân viên Kinh doanh',
    interviewTime: interviewLabel(start),
    interviewDate: vietnamInterviewParts(start).date,
    address: MAIL_COMPANY.officeAddress,
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    interviewer: MAIL_COMPANY.defaultInterviewer,
    duration: key === 'call' ? MAIL_COMPANY.defaultCallDuration : MAIL_COMPANY.defaultDuration,
    hrName: me?.name ?? '',
    hrPhone: me?.phone ?? '',
    hrTitle: me?.jobTitle ?? '',
    hrAlias: me?.alias ?? '',
    company: MAIL_COMPANY.name,
  };
}

function SamplePreview({ template }: { template: MessageTemplate }) {
  const me = useHrMe();
  const start = `${addDays(todayInVietnam(), 2)}T09:00:00+07:00`;
  const values = sampleValues(me.data, start, template.key);
  const { content, missing } = fillTemplateSections(template, values);
  return (
    <section aria-label="Xem trước thư" className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-medium text-slate">Xem trước với ứng viên mẫu (Minh Anh)</span>
      <strong className="text-sm font-semibold text-navy">{content.subject}</strong>
      <MailPreview
        templateKey={template.key}
        title="Xem trước thư"
        html={designedMailHtml(content, { ...mailDetails(values, start), cvUrl: MAIL_COMPANY.careersSite })}
        className="h-[520px] rounded-control border border-line xl:h-[720px]"
      />
      {missing.length > 0 && (
        <span className="text-xs text-[#8a6d00]">
          {missing.join(', ')} chưa có: điền ở <Link to="/hr/tai-khoan">Tài khoản HR</Link>.
        </span>
      )}
    </section>
  );
}

type TextField = 'subject' | SectionField;
type Texts = Omit<MessageTemplate, 'key'>;
type TextBox = HTMLInputElement | HTMLTextAreaElement;

const textsOf = ({ subject, body, note, calloutTitle, callout, closing }: MessageTemplate): Texts => ({
  subject,
  body,
  note,
  calloutTitle,
  callout,
  closing,
});

/** The form's texts, and inserting a token where the cursor was in whichever box had the focus last. */
function useTemplateTexts(template: MessageTemplate) {
  const [texts, setTexts] = useState<Texts>(textsOf(template));
  const [focus, setFocus] = useState<TextField>('body');
  const boxes = useRef<Partial<Record<TextField, TextBox>>>({});
  const insert = (token: string) => {
    const el = boxes.current[focus];
    const value = texts[focus];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setTexts({ ...texts, [focus]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const bind = (field: TextField) => ({
    ref: (el: TextBox | null) => {
      if (el) boxes.current = { ...boxes.current, [field]: el };
    },
    value: texts[field],
    onFocus: () => setFocus(field),
    onChange: (e: { target: { value: string } }) => setTexts({ ...texts, [field]: e.target.value }),
  });
  return { texts, setTexts, insert, bind };
}

const inputClass =
  'field-focus min-h-11 rounded-control border border-field bg-white px-3 text-sm text-navy outline-none';

function TemplateFields({ template, form }: { template: MessageTemplate; form: ReturnType<typeof useTemplateTexts> }) {
  return (
    <>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-navy">Tiêu đề</span>
        <input maxLength={SUBJECT_MAX} className={inputClass} {...form.bind('subject')} />
      </label>
      {sectionsFor(template.key).map(({ field, label, rows, max }) => (
        <div key={field} className="flex flex-col gap-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-navy">{label}</span>
            {rows === 1 ? (
              <input maxLength={max} className={inputClass} {...form.bind(field)} />
            ) : (
              <textarea
                rows={rows}
                maxLength={max}
                className="field-focus rounded-control border border-field bg-white px-4 py-3 text-[15px] leading-relaxed text-navy outline-none"
                {...form.bind(field)}
              />
            )}
          </label>
          <span className="self-end text-xs text-muted">
            {form.texts[field].length}/{max}
          </span>
        </div>
      ))}
    </>
  );
}

type EditorNotice = { ok: boolean; text: string };

/** Saving and resetting, each ending in a notice. After either, the form takes the server's text. */
function useTemplateSaving(template: MessageTemplate, form: ReturnType<typeof useTemplateTexts>) {
  const { save, reset } = useMessageTemplateActions();
  const [notice, setNotice] = useState<EditorNotice | null>(null);
  const onError = (e: unknown) =>
    setNotice({
      ok: false,
      text: e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : errorMessage(e),
    });
  const restoreDefault = () =>
    reset.mutate(template.key, {
      onSuccess: () => {
        form.setTexts(textsOf(DEFAULT_MESSAGE_TEMPLATES[template.key]));
        setNotice({ ok: true, text: 'Đã dùng lại mẫu gốc.' });
      },
      onError,
    });
  const saveTexts = () =>
    save.mutate(
      { key: template.key, ...form.texts },
      {
        onSuccess: (data) => {
          // The server trims spaces; take its version so the form is not "changed" right after saving.
          const saved = data.templates.find((t) => t.key === template.key);
          if (saved) form.setTexts(textsOf(saved));
          setNotice({ ok: true, text: 'Đã lưu mẫu thư.' });
        },
        onError,
      },
    );
  return { notice, restoreDefault, saveTexts, isSaving: save.isPending, isResetting: reset.isPending };
}

export function TemplateEditor({ template, customized }: { template: MessageTemplate; customized: boolean }) {
  const form = useTemplateTexts(template);
  const { notice, restoreDefault, saveTexts, isSaving, isResetting } = useTemplateSaving(template, form);
  // Compared with what the server has now, so after a save or reset the button settles without a remount.
  const dirty = JSON.stringify(form.texts) !== JSON.stringify(textsOf(template));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-white p-4 sm:p-6">
        {notice && (
          <Notice tone={notice.ok ? 'ok' : 'error'} icon={notice.ok ? 'check' : 'alert'}>
            <span role={notice.ok ? 'status' : 'alert'}>{notice.text}</span>
          </Notice>
        )}
        <Notice tone="mist" icon="mail">
          Bố cục, logo, khung ngày giờ, chữ ký và chân thư là cố định. Ở đây chỉ sửa được phần chữ.
        </Notice>
        <TemplateFields template={template} form={form} />
        <PlaceholderButtons onInsert={form.insert} />
        <div className="flex flex-wrap justify-end gap-2.5">
          {customized && (
            <Button variant="ghost" icon="copy" disabled={isResetting} onClick={restoreDefault} className="sm:mr-auto">
              Dùng lại mẫu gốc
            </Button>
          )}
          <Button icon="check" disabled={!dirty || isSaving} onClick={saveTexts} className="px-7">
            {isSaving ? 'Đang lưu…' : 'Lưu mẫu'}
          </Button>
        </div>
      </div>
      <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <SamplePreview template={{ key: template.key, ...form.texts }} />
      </div>
    </div>
  );
}
