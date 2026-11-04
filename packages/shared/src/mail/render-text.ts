import { callDetailsText, callExampleText } from './call.js';
import { MAIL_COMPANY } from './company.js';
import {
  addressOf,
  calendarLinkOf,
  durationOf,
  hrEmailOf,
  hrNameOf,
  interviewerOf,
  interviewPartsOf,
  isInterviewMail,
  meetingLinkOf,
  phoneLabel,
} from './details.js';
import { splitParagraphs } from './inline.js';
import type { MailContent, MailDetails } from './types.js';

/** "THỨ NĂM" -> "Thứ Năm" reads better inside a sentence. */
const titleCase = (text: string) =>
  text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

function detailsText(content: MailContent, details: MailDetails): string {
  if (content.key === 'call') return callDetailsText(details);
  if (!isInterviewMail(content.key)) return '';
  const online = content.key === 'interview_online';
  const parts = interviewPartsOf(details);
  const link = meetingLinkOf(details);
  const place = online
    ? [link ? `- Link tham gia: ${link}` : '']
    : [`- Địa điểm: ${MAIL_COMPANY.officeName}, ${addressOf(details)}`];
  return [
    'THÔNG TIN BUỔI PHỎNG VẤN',
    `- Thời gian: ${parts ? `${parts.time}, ${titleCase(parts.weekday)}, ${parts.date}` : 'Chưa có lịch'}`,
    ...place,
    `- Người trao đổi: ${interviewerOf(details)}`,
    `- Thời lượng: ${durationOf(details)}`,
    `- Hình thức: ${online ? 'Online' : 'Trực tiếp'}`,
    parts ? `- Thêm vào lịch: ${calendarLinkOf(content.key, details)}` : '',
    details.cvUrl ? `- CV bạn đã nộp: ${details.cvUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function signatureText(details: MailDetails): string {
  const alias = details.hrAlias.trim();
  const title = details.hrTitle.trim();
  const phone = details.hrPhone.trim();
  return [
    'Thân mến,',
    `${hrNameOf(details)}${alias ? ` (${alias})` : ''}`,
    title.toUpperCase(),
    phone ? `M: ${phoneLabel(phone)}` : '',
    `E: ${hrEmailOf(details)}`,
    `W: ${MAIL_COMPANY.website}`,
    `Tuyển dụng ${MAIL_COMPANY.name}: ${MAIL_COMPANY.careersSite}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** A call mail shows how to answer right after the request, as the designed mail does. */
function calloutBody(content: MailContent): string {
  const [first, ...rest] = splitParagraphs(content.callout);
  if (!first) return '';
  return (content.key === 'call' ? [first, callExampleText(), ...rest] : [first, ...rest]).join('\n\n');
}

/** The same mail as plain text, for Gmail links, mail apps and Zalo. */
export function renderMailText(content: MailContent, details: MailDetails): string {
  const callout = [content.calloutTitle.trim(), calloutBody(content)].filter(Boolean).join('\n');
  return [
    content.body.trim(),
    detailsText(content, details),
    content.note.trim(),
    callout,
    content.closing.trim(),
    signatureText(details),
    `Bạn nhận thư này vì đã ứng tuyển tại ${MAIL_COMPANY.name}. Xem chính sách dữ liệu tại ${MAIL_COMPANY.privacyPage}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
