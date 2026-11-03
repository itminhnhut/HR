import { normalizeVietnamPhone } from '../phone.js';
import { googleCalendarUrl, type TemplateKey } from '../message-templates.js';
import { MAIL_COMPANY } from './company.js';
import { vietnamInterviewParts, type InterviewParts } from './interview-date.js';
import type { MailDetails } from './types.js';

export const isInterviewMail = (key: TemplateKey) => key === 'interview_onsite' || key === 'interview_online';

/** null when there is no interview time yet, or the stored value is not a date: the mail must still render. */
export function interviewPartsOf(details: MailDetails): InterviewParts | null {
  const iso = details.interviewIso;
  if (!iso || Number.isNaN(new Date(iso).getTime())) return null;
  return vietnamInterviewParts(iso);
}

/** Only http(s) links may reach a mail. Anything else counts as no link. */
export function meetingLinkOf(details: MailDetails): string {
  const url = details.meetingUrl.trim();
  return /^https?:\/\/\S+$/i.test(url) ? url : '';
}

export const addressOf = (details: MailDetails) => details.address.trim() || MAIL_COMPANY.officeAddress;
export const interviewerOf = (details: MailDetails) => details.interviewer.trim() || MAIL_COMPANY.defaultInterviewer;
export const durationOf = (details: MailDetails) => details.duration.trim() || MAIL_COMPANY.defaultDuration;
export const hrEmailOf = (details: MailDetails) => details.hrEmail.trim() || MAIL_COMPANY.hrEmail;
export const hrNameOf = (details: MailDetails) => details.hrName.trim() || MAIL_COMPANY.name;
export const callDurationOf = (details: MailDetails) => details.duration.trim() || MAIL_COMPANY.defaultCallDuration;
/** "Ms. Thuận Lê"; the company name stands alone when no HR name is filled in yet. */
export const hrContactNameOf = (details: MailDetails) => {
  const name = details.hrName.trim();
  return name ? `${MAIL_COMPANY.hrHonorific} ${name}` : MAIL_COMPANY.name;
};

/** "30 – 45 phút" -> 45, "1 giờ" -> 60, "1,5 tiếng" -> 90: the longest case, so the slot stays free. Null if unclear. */
export function durationMinutes(text: string): number | null {
  const numbers = text.match(/\d+(?:[.,]\d+)?/g);
  const last = numbers?.at(-1);
  if (!last) return null;
  const value = Number(last.replace(',', '.'));
  const minutes = /giờ|tiếng|\dh\b/i.test(text) ? value * 60 : value;
  return minutes > 0 ? Math.round(minutes) : null;
}

/** The candidate's "add to calendar" link. Empty when there is no interview time yet. */
export function calendarLinkOf(key: TemplateKey, details: MailDetails): string {
  if (!interviewPartsOf(details) || !details.interviewIso) return '';
  const online = key === 'interview_online';
  const link = meetingLinkOf(details);
  return googleCalendarUrl({
    title: `Phỏng vấn vị trí ${details.jobTitle.trim()} – ${MAIL_COMPANY.name}`,
    startIso: details.interviewIso,
    details:
      `Người trao đổi: ${interviewerOf(details)}\nLiên hệ: ${hrNameOf(details)} ${details.hrPhone.trim()}`.trim(),
    location: online ? link : `${MAIL_COMPANY.officeName}, ${addressOf(details)}`,
    minutes: durationMinutes(durationOf(details)) ?? undefined,
  });
}

/** The address can change per mail, so the map follows it; the office keeps its checked link. */
export function mapUrlOf(details: MailDetails): string {
  const address = addressOf(details);
  if (address === MAIL_COMPANY.officeAddress) return MAIL_COMPANY.mapUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** "0986 605 214" -> "tel:+84986605214". Empty when there are no digits. */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `tel:+84${digits.slice(1)}`;
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}`;
}

/** "0986 605 214" -> "+84 986 605 214"; other numbers stay as typed. */
export function phoneLabel(phone: string): string {
  const mobile = normalizeVietnamPhone(phone);
  if (!mobile) return phone.trim();
  return `+84 ${mobile.slice(1, 4)} ${mobile.slice(4, 7)} ${mobile.slice(7)}`;
}
