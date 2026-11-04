import {
  fillTemplateSections,
  lastName,
  MAIL_COMPANY,
  vietnamInterviewParts,
  type ApplicationDetailDto,
  type HrMe,
  type MailContent,
  type MailDetails,
  type MessageTemplate,
  type TemplateKey,
  type TemplateValues,
} from '@careers/shared';
import { useState } from 'react';
import { mailDetails, mailText } from '../mail/mailSections';
import { interviewLabel } from './InterviewField';
import { missingTokens } from './mailFields';

/** The template that fits where the application is now. */
export function suggestedTemplate(app: ApplicationDetailDto): TemplateKey {
  if (app.status === 'rejected') return app.interviewAt ? 'rejection_interview' : 'rejection';
  if (app.status === 'interview') return app.interviewMode === 'online' ? 'interview_online' : 'interview_onsite';
  return 'call';
}

function valuesFor(app: ApplicationDetailDto, me: HrMe | null | undefined, key: TemplateKey): TemplateValues {
  return {
    candidateName: lastName(app.fullName),
    jobTitle: app.jobTitle,
    interviewTime: app.interviewAt ? interviewLabel(app.interviewAt) : '',
    interviewDate: app.interviewAt ? vietnamInterviewParts(app.interviewAt).date : '',
    address: MAIL_COMPANY.officeAddress,
    meetingUrl: app.meetingUrl ?? '',
    interviewer: MAIL_COMPANY.defaultInterviewer,
    duration: key === 'call' ? MAIL_COMPANY.defaultCallDuration : MAIL_COMPANY.defaultDuration,
    hrName: me?.name || '',
    hrPhone: me?.phone || '',
    hrTitle: me?.jobTitle || '',
    hrAlias: me?.alias || '',
    company: MAIL_COMPANY.name,
  };
}

export interface MailDraft {
  content: MailContent;
  details: MailDetails;
  values: TemplateValues;
  /** Tokens like "{SĐT HR}" still to fill. */
  missing: string[];
  /** HR edited the text by hand, then a field changed: the new value is not in the text yet. */
  stale: boolean;
  edit: (next: Partial<Omit<MailContent, 'key'>>) => void;
  setLocal: (key: keyof TemplateValues, value: string) => void;
  rebuild: () => void;
}

/**
 * The mail for one template: built from the template and the values, until HR edits the text by hand. After
 * that, field changes no longer overwrite the text; `stale` tells the UI to offer a rebuild. The frame of the
 * mail (date box, signature) always follows the fields, so a change that only shows there needs no rebuild.
 */
export function useMailDraft(
  app: ApplicationDetailDto,
  me: HrMe | null | undefined,
  template: MessageTemplate,
  cvUrl?: string,
): MailDraft {
  const [overrides, setOverrides] = useState<Partial<TemplateValues>>({});
  // `base` is the built text this hand edit started from: when the built text moves on, the edit is behind.
  const [edited, setEdited] = useState<{ content: MailContent; base: MailContent } | null>(null);
  const values = { ...valuesFor(app, me, template.key), ...overrides };
  const built = fillTemplateSections(template, values).content;
  const own = edited?.content.key === template.key ? edited : null;
  const content = own ? own.content : built;
  return {
    content,
    details: { ...mailDetails(values, app.interviewAt), cvUrl },
    values,
    missing: missingTokens(content, values),
    stale: !!own && mailText(own.base) !== mailText(built),
    edit: (next) => setEdited({ content: { ...content, ...next }, base: own ? own.base : built }),
    setLocal: (key, value) => setOverrides((current) => ({ ...current, [key]: value })),
    rebuild: () => setEdited(null),
  };
}
