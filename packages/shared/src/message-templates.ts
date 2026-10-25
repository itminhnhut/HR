/**
 * Message templates HR fills for one candidate and sends from their own mailbox (Gmail link, mailto)
 * or pastes into Zalo. Nothing is sent by the site itself.
 */

export type TemplateKey = 'interview_onsite' | 'interview_online' | 'rejection' | 'call';
export type InterviewMode = 'onsite' | 'online';
export type ContactChannel = 'gmail' | 'mailto' | 'copy';

export const TEMPLATE_KEYS: TemplateKey[] = ['interview_onsite', 'interview_online', 'rejection', 'call'];
export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  interview_onsite: 'Mời phỏng vấn trực tiếp',
  interview_online: 'Mời phỏng vấn online',
  rejection: 'Cảm ơn / chưa phù hợp',
  call: 'Hẹn gọi điện',
};
export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  gmail: 'Mở Gmail',
  mailto: 'Mở ứng dụng mail',
  copy: 'Sao chép',
};

export const SUBJECT_MAX = 200;
/**
 * Template size limit. Vietnamese letters take 6–9 characters once URL-encoded, so a full template makes a
 * Gmail link of several thousand characters: Gmail web copes, but mailto links can break past ~2,000
 * (see MAILTO_SAFE_LENGTH).
 */
export const TEMPLATE_BODY_MAX = 1500;
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
];

export interface MessageTemplate {
  key: TemplateKey;
  subject: string;
  body: string;
}

const SIGNATURE = 'Trân trọng,\n{Tên HR}\n{Công ty} · {SĐT HR}';

export const DEFAULT_MESSAGE_TEMPLATES: Record<TemplateKey, MessageTemplate> = {
  interview_onsite: {
    key: 'interview_onsite',
    subject: '[{Công ty}] Mời phỏng vấn vị trí {Vị trí}',
    body: `Chào {Tên ứng viên},

Cảm ơn bạn đã ứng tuyển vị trí {Vị trí} tại {Công ty}. Chúng tôi mời bạn đến phỏng vấn:

- Thời gian: {Giờ phỏng vấn}
- Địa điểm: {Địa chỉ}

Bạn trả lời thư này để xác nhận giúp mình, hoặc báo nếu cần đổi giờ.

${SIGNATURE}`,
  },
  interview_online: {
    key: 'interview_online',
    subject: '[{Công ty}] Mời phỏng vấn online vị trí {Vị trí}',
    body: `Chào {Tên ứng viên},

Cảm ơn bạn đã ứng tuyển vị trí {Vị trí} tại {Công ty}. Chúng tôi mời bạn phỏng vấn online qua Google Meet:

- Thời gian: {Giờ phỏng vấn}
- Link tham gia: {Link Meet}

Bạn vào trước vài phút để kiểm tra micro và camera. Trả lời thư này để xác nhận giúp mình, hoặc báo nếu cần đổi giờ.

${SIGNATURE}`,
  },
  rejection: {
    key: 'rejection',
    subject: '[{Công ty}] Kết quả ứng tuyển vị trí {Vị trí}',
    body: `Chào {Tên ứng viên},

Cảm ơn bạn đã dành thời gian ứng tuyển vị trí {Vị trí} tại {Công ty}. Sau khi xem xét, lần này chúng tôi đã chọn ứng viên phù hợp hơn với yêu cầu hiện tại.

Chúng tôi rất trân trọng sự quan tâm của bạn và chúc bạn sớm tìm được công việc ưng ý.

${SIGNATURE}`,
  },
  call: {
    key: 'call',
    subject: '[{Công ty}] Trao đổi về vị trí {Vị trí}',
    body: `Chào {Tên ứng viên},

Cảm ơn bạn đã ứng tuyển vị trí {Vị trí} tại {Công ty}. Mình muốn gọi điện trao đổi thêm khoảng 10–15 phút. Bạn cho mình biết khung giờ nào tiện nghe máy nhé.

${SIGNATURE}`,
  },
};

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
}): string {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + INTERVIEW_MINUTES * 60_000);
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
