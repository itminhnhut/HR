/**
 * Message templates HR fills for one candidate and sends from their own mailbox (Gmail link, mailto)
 * or pastes into Outlook or Zalo. The texts go into a fixed design, see ./mail.
 */

import type { MailContent } from './mail/types.js';

export { DEFAULT_MESSAGE_TEMPLATES } from './mail/default-templates.js';

export type TemplateKey = 'interview_onsite' | 'interview_online' | 'rejection' | 'rejection_interview' | 'call';
export type InterviewMode = 'onsite' | 'online';
export type ContactChannel = 'gmail' | 'mailto' | 'copy' | 'copy_html';

export const TEMPLATE_KEYS: TemplateKey[] = [
  'interview_onsite',
  'interview_online',
  'rejection',
  'rejection_interview',
  'call',
];
export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  interview_onsite: 'Mời phỏng vấn trực tiếp',
  interview_online: 'Mời phỏng vấn online',
  rejection: 'Từ chối hồ sơ',
  rejection_interview: 'Từ chối sau phỏng vấn',
  call: 'Hẹn gọi điện',
};
export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  gmail: 'Mở Gmail',
  mailto: 'Mở ứng dụng mail',
  copy: 'Sao chép',
  copy_html: 'Sao chép thư đẹp',
};

export const SUBJECT_MAX = 200;
/**
 * Template size limit. Vietnamese letters take 6–9 characters once URL-encoded, so a full template makes a
 * Gmail link of several thousand characters: Gmail web copes, but mailto links can break past ~2,000
 * (see MAILTO_SAFE_LENGTH).
 */
export const TEMPLATE_BODY_MAX = 1500;
/** Note, callout text and closing of a template. */
export const TEMPLATE_SECTION_MAX = 1000;
export const CALLOUT_TITLE_MAX = 80;
/** Above this, some mail apps (Outlook on Windows) cut or refuse mailto links. */
export const MAILTO_SAFE_LENGTH = 1900;

export interface TemplateValues {
  candidateName: string;
  jobTitle: string;
  interviewTime: string;
  address: string;
  meetingUrl: string;
  hrName: string;
  hrPhone: string;
  company: string;
  /** "06/11/2026" */
  interviewDate: string;
  interviewer: string;
  duration: string;
  hrTitle: string;
  hrAlias: string;
}

/** The fields HR can insert, written as the Vietnamese label in braces so templates stay readable. */
export const PLACEHOLDERS: { token: string; key: keyof TemplateValues }[] = [
  { token: '{Tên ứng viên}', key: 'candidateName' },
  { token: '{Vị trí}', key: 'jobTitle' },
  { token: '{Giờ phỏng vấn}', key: 'interviewTime' },
  { token: '{Địa chỉ}', key: 'address' },
  { token: '{Link Meet}', key: 'meetingUrl' },
  { token: '{Tên HR}', key: 'hrName' },
  { token: '{SĐT HR}', key: 'hrPhone' },
  { token: '{Công ty}', key: 'company' },
  { token: '{Ngày phỏng vấn}', key: 'interviewDate' },
  { token: '{Người trao đổi}', key: 'interviewer' },
  { token: '{Thời lượng}', key: 'duration' },
  { token: '{Chức danh HR}', key: 'hrTitle' },
  { token: '{Tên gọi khác}', key: 'hrAlias' },
];

/** The texts HR can edit. Paragraphs are separated by a blank line. */
export interface MessageTemplate {
  key: TemplateKey;
  subject: string;
  /** Before the details card; starts with the greeting. */
  body: string;
  /** After the details card (interview mails only, otherwise empty). */
  note: string;
  calloutTitle: string;
  callout: string;
  /** Before "Thân mến,". */
  closing: string;
}

/** Inserts the values; fields with no value stay as their token and are listed in `missing`. */
export function fillTemplate(text: string, values: TemplateValues): { text: string; missing: string[] } {
  const missing: string[] = [];
  let out = text;
  for (const { token, key } of PLACEHOLDERS) {
    if (!out.includes(token)) continue;
    const value = values[key].trim();
    if (value) out = out.split(token).join(value);
    else missing.push(token);
  }
  return { text: out, missing };
}

/** Fills every text of a template. `missing` lists each empty field once, however many texts use it. */
export function fillTemplateSections(
  t: MessageTemplate,
  values: TemplateValues,
): { content: MailContent; missing: string[] } {
  const subject = fillTemplate(t.subject, values);
  const body = fillTemplate(t.body, values);
  const note = fillTemplate(t.note, values);
  const calloutTitle = fillTemplate(t.calloutTitle, values);
  const callout = fillTemplate(t.callout, values);
  const closing = fillTemplate(t.closing, values);
  const sections = [subject, body, note, calloutTitle, callout, closing];
  return {
    content: {
      key: t.key,
      subject: subject.text,
      body: body.text,
      note: note.text,
      calloutTitle: calloutTitle.text,
      callout: callout.text,
      closing: closing.text,
    },
    missing: [...new Set(sections.flatMap((s) => s.missing))],
  };
}

/**
 * Opens Gmail's compose window, filled in. `from` (the HR's own Gmail) picks that account when the browser is
 * signed in to several Google accounts.
 */
export function gmailComposeUrl(to: string, subject: string, body: string, from?: string | null): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
  if (from) q.set('authuser', from);
  return `https://mail.google.com/mail/?${q.toString()}`;
}

/** For phones and desktop mail apps. Spaces must be %20 here, not "+". */
export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * A new mail in Outlook on the web, with recipient and subject filled in. The body stays out: this link only takes
 * plain text, and HR pastes the designed mail instead. Spaces must be %20, Outlook shows "+" as it is.
 */
export function outlookComposeUrl(to: string | null, subject: string): string {
  const recipient = to ? `to=${encodeURIComponent(to)}&` : '';
  return `https://outlook.office.com/mail/deeplink/compose?${recipient}subject=${encodeURIComponent(subject)}`;
}

const INTERVIEW_MINUTES = 60;

/** 2026-10-30T02:00:00.000Z -> 20261030T020000Z */
const calendarTime = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/**
 * Google Calendar "new event" link, filled in. `guest` adds the candidate as a guest (used by HR, who then
 * clicks "Thêm Google Meet" and saves); without it, candidates use it to put the interview in their calendar.
 */
export function googleCalendarUrl(input: {
  title: string;
  startIso: string;
  details: string;
  location: string;
  guest?: string | null;
  minutes?: number;
}): string {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + (input.minutes ?? INTERVIEW_MINUTES) * 60_000);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${calendarTime(start)}/${calendarTime(end)}`,
    details: input.details,
    location: input.location,
    ctz: 'Asia/Ho_Chi_Minh',
  });
  if (input.guest) q.set('add', input.guest);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
