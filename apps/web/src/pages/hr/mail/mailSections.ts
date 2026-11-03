import {
  CALLOUT_TITLE_MAX,
  TEMPLATE_BODY_MAX,
  TEMPLATE_SECTION_MAX,
  MAIL_COMPANY,
  type MailContent,
  type MailDetails,
  type TemplateValues,
  type TemplateKey,
} from '@careers/shared';

/** The parts of a mail HR writes. Everything else (logo, date box, signature, footer) is a fixed frame. */
export type SectionField = 'body' | 'note' | 'calloutTitle' | 'callout' | 'closing';

export interface MailSection {
  field: SectionField;
  label: string;
  rows: number;
  max: number;
}

const SECTIONS: MailSection[] = [
  { field: 'body', label: 'Nội dung mở đầu', rows: 7, max: TEMPLATE_BODY_MAX },
  { field: 'note', label: 'Đoạn sau khung thông tin', rows: 3, max: TEMPLATE_SECTION_MAX },
  { field: 'calloutTitle', label: 'Tiêu đề khối nổi bật', rows: 1, max: CALLOUT_TITLE_MAX },
  { field: 'callout', label: 'Khối nổi bật', rows: 4, max: TEMPLATE_SECTION_MAX },
  { field: 'closing', label: 'Đoạn kết', rows: 4, max: TEMPLATE_SECTION_MAX },
];

/** Interview mails: the long ones, with the date and place box. */
export const hasInfoBox = (key: TemplateKey) => key === 'interview_onsite' || key === 'interview_online';

/** Every part a mail of this template can have: the info box has text after it only in interview mails. */
export const sectionsFor = (key: TemplateKey): MailSection[] =>
  SECTIONS.filter((s) => s.field !== 'note' || hasInfoBox(key));

/** All the texts of a mail (or of a template, which has the same parts), to look for tokens in them. */
export const mailText = (content: MailContent): string =>
  [content.subject, ...SECTIONS.map((s) => content[s.field])].join('\n');

/** What the fixed frame shows. Candidates answer the company mailbox; contactEmail is the Gmail an HR sends from. */
export const mailDetails = (values: TemplateValues, interviewIso: string | null): MailDetails => ({
  interviewIso,
  address: values.address,
  meetingUrl: values.meetingUrl,
  interviewer: values.interviewer,
  duration: values.duration,
  candidateName: values.candidateName,
  jobTitle: values.jobTitle,
  hrName: values.hrName,
  hrPhone: values.hrPhone,
  hrTitle: values.hrTitle,
  hrAlias: values.hrAlias,
  hrEmail: MAIL_COMPANY.hrEmail,
});
