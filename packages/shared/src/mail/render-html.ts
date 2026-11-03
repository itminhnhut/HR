import type { TemplateKey } from '../message-templates.js';
import { escapeHtml } from '../news/render.js';
import { callCardRow, callExampleBox } from './call.js';
import { detailsCardRow } from './card.js';
import { MAIL_COMPANY, MAIL_LOGO_URLS } from './company.js';
import { hrEmailOf, interviewPartsOf, isInterviewMail } from './details.js';
import { blocksHtml, paragraphsHtml, type TextStyle } from './inline.js';
import { mailtoHref, signatureRow } from './signature.js';
import type { MailContent, MailDetails } from './types.js';

/** Fixed per template: HR edits the wording, never the frame. */
const HEADINGS: Record<TemplateKey, { title: string; subtitle: string; documentTitle: string }> = {
  interview_onsite: {
    title: 'THƯ MỜI PHỎNG VẤN',
    subtitle: 'INTERVIEW INVITATION',
    documentTitle: 'Thư mời phỏng vấn',
  },
  interview_online: {
    title: 'THƯ MỜI PHỎNG VẤN',
    subtitle: 'INTERVIEW INVITATION',
    documentTitle: 'Thư mời phỏng vấn',
  },
  rejection: {
    title: 'THƯ CẢM ƠN ỨNG TUYỂN',
    subtitle: 'THANK YOU FOR APPLYING',
    documentTitle: 'Thư phản hồi hồ sơ ứng tuyển',
  },
  rejection_interview: {
    title: 'THƯ CẢM ƠN',
    subtitle: 'THANK YOU FOR YOUR TIME',
    documentTitle: 'Thư cảm ơn sau phỏng vấn',
  },
  call: {
    title: 'THƯ HẸN TRAO ĐỔI',
    subtitle: 'PHONE SCREENING',
    documentTitle: 'Thư hẹn trao đổi qua điện thoại',
  },
};

const RESPONSIVE_CSS = `@media only screen and (max-width:600px) {
    .wrap { padding:0 !important; }
    .px { padding-left:18px !important; padding-right:18px !important; }
    .title { font-size:21px !important; letter-spacing:1px !important; }
    .date, .info { display:block !important; width:100% !important; box-sizing:border-box !important; }
    .date { padding:16px 12px !important; }
    .date-d { font-size:38px !important; }
    .info { padding:4px 18px !important; }
    .sig-l, .sig-r { display:block !important; width:100% !important; box-sizing:border-box !important; border:0 !important; padding:0 !important; }
    .sig-logo { display:block !important; width:100% !important; padding:16px 0 0 !important; }
    .sig-l { padding-top:12px !important; }
    .sig-r { padding-top:10px !important; }
  }`;

/** The preview line of an inbox. */
function preheader(key: TemplateKey, details: MailDetails): string {
  const job = details.jobTitle.trim();
  if (key === 'rejection') return `Cảm ơn bạn đã ứng tuyển vị trí ${job} tại ${MAIL_COMPANY.name}.`;
  if (key === 'rejection_interview') return `Cảm ơn bạn đã tham gia phỏng vấn vị trí ${job} tại ${MAIL_COMPANY.name}.`;
  if (key === 'call') {
    return `Hồ sơ của bạn đã qua vòng sàng lọc – vui lòng phản hồi thời gian thuận tiện để HR ${MAIL_COMPANY.name} liên hệ.`;
  }
  const parts = interviewPartsOf(details);
  const when = parts ? ` lúc ${parts.time}, ${parts.weekday} ${parts.date}` : '';
  return `${MAIL_COMPANY.name} mời bạn tham gia phỏng vấn vị trí ${job}${when}.`;
}

function titleRow(key: TemplateKey, jobTitle: string): string {
  const { title, subtitle } = HEADINGS[key];
  const job = jobTitle.trim();
  const pill = job
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr>
    <td style="background:#fbeaec;border:1px solid #f0c9ce;border-radius:20px;padding:7px 18px;font-size:14px;color:#2b2b2b;">Vị trí: <b style="color:#C8102E;">${escapeHtml(job)}</b></td>
  </tr></table>`
    : '';
  return `<tr><td class="px" align="center" style="padding:28px 40px 4px;">
  <div class="title" style="font-size:25px;font-weight:bold;letter-spacing:2px;color:#C8102E;">${title}</div>
  <div style="font-size:12px;color:#888;letter-spacing:2px;margin-top:4px;">${escapeHtml(subtitle)}</div>
  ${pill}
</td></tr>`;
}

const textRow = (top: number, lineHeight: number, inner: string) =>
  `<tr><td class="px" style="padding:${top}px 40px 0;font-size:15px;line-height:${lineHeight};">
  ${inner}
</td></tr>`;

function calloutRow(content: MailContent, details: MailDetails): string {
  const title = content.calloutTitle.trim();
  const [first, ...rest] = blocksHtml(content.callout, details);
  if (!title && !first) return '';
  const heading = title ? `<b style="color:#C8102E;">${escapeHtml(title)}</b>${first ? '<br>' : ''}` : '';
  const text =
    content.key === 'call' && first
      ? `${first}\n      ${callExampleBox()}${rest.map((p) => `<div style="margin-top:10px;">${p}</div>`).join('')}`
      : [first, ...rest].filter(Boolean).join('<br><br>');
  return `<tr><td class="px" style="padding:20px 40px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf3f4;border-left:4px solid #C8102E;">
    <tr><td style="padding:14px 18px;font-size:15px;line-height:1.7;">
      ${heading}${text}
    </td></tr>
  </table>
</td></tr>`;
}

/** The button under the callout: the answer goes to the HR mailbox, already titled. */
function answerRow(key: TemplateKey, details: MailDetails): string {
  const isCall = key === 'call';
  const label = isCall ? 'GỬI THỜI GIAN THUẬN TIỆN' : 'XÁC NHẬN THAM DỰ';
  const topic = isCall ? 'Thời gian trao đổi qua điện thoại' : 'Xác nhận tham dự phỏng vấn';
  const subject = encodeURIComponent(`${topic} - ${details.candidateName}`);
  const href = `${mailtoHref(hrEmailOf(details))}?subject=${subject}`;
  return `<tr><td class="px" style="padding:18px 40px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
    <td align="center" bgcolor="#C8102E" style="border-radius:4px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 30px;font-family:'Times New Roman',Times,serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:1px;">${label}</a>
    </td>
  </tr></table>
</td></tr>`;
}

const FOOTER_LINK = 'color:#ffffff;text-decoration:underline;';

function footerRow(): string {
  const { name, tagline, hrEmail, hotline, website, careersSite, careersUrl, privacyPage, privacyUrl } = MAIL_COMPANY;
  return `<tr><td class="px" style="background:#C8102E;padding:14px 40px;font-size:12px;color:#ffe3e6;line-height:1.7;">
  <b style="color:#ffffff;">${escapeHtml(name.toUpperCase())}</b> &nbsp;·&nbsp; ${escapeHtml(tagline)}<br>
  Email: ${escapeHtml(hrEmail)} &nbsp;|&nbsp; Hotline: ${escapeHtml(hotline)} &nbsp;|&nbsp; Website: ${escapeHtml(website)} &nbsp;|&nbsp; Tuyển dụng ${escapeHtml(name)}: <a href="${escapeHtml(careersUrl)}" style="${FOOTER_LINK}">${escapeHtml(careersSite)}</a>
  <div style="font-size:11px;line-height:1.5;margin-top:6px;">Bạn nhận thư này vì đã ứng tuyển tại ${escapeHtml(name)}. Xem chính sách dữ liệu tại <a href="${escapeHtml(privacyUrl)}" style="${FOOTER_LINK}">${escapeHtml(privacyPage)}</a></div>
</td></tr>`;
}

function contentRows(content: MailContent, details: MailDetails): string[] {
  const interview = isInterviewMail(content.key);
  const isCall = content.key === 'call';
  const hasAnswerButton = interview || isCall;
  const lineHeight = hasAnswerButton ? 1.7 : 1.75;
  const style: TextStyle = { gap: hasAnswerButton ? 12 : 14 };
  const closing = paragraphsHtml(content.closing, details, style, true);
  return [
    textRow(24, lineHeight, paragraphsHtml(content.body, details, style)),
    interview ? detailsCardRow(content, details) : '',
    isCall ? callCardRow(details) : '',
    content.note.trim() ? textRow(18, 1.7, paragraphsHtml(content.note, details, style)) : '',
    calloutRow(content, details),
    hasAnswerButton ? answerRow(content.key, details) : '',
    textRow(22, lineHeight, `${closing}${closing ? '\n  ' : ''}<p style="margin:0;">Thân mến,</p>`),
  ];
}

/**
 * The whole mail as a table-based document with inline styles, as HR's designs. Every value and text is escaped;
 * `opts.logos` is for `cid:` images when the server sends the mail itself.
 */
export function renderMailHtml(
  content: MailContent,
  details: MailDetails,
  opts?: { logos?: { logo: string; mark: string } },
): string {
  const logos = opts?.logos ?? MAIL_LOGO_URLS;
  const { name, tagline } = MAIL_COMPANY;
  const rows = [
    `<tr><td class="px" align="center" style="padding:28px 40px 20px;border-bottom:3px solid #C8102E;">
  <img src="${escapeHtml(logos.logo)}" alt="${escapeHtml(`${name.toUpperCase()} – ${tagline}`)}" width="300" style="display:block;width:100%;max-width:300px;height:auto;border:0;">
</td></tr>`,
    titleRow(content.key, details.jobTitle),
    ...contentRows(content, details),
    signatureRow(details, logos.mark),
    footerRow(),
  ];
  return `<!DOCTYPE html>
<html lang="vi"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(`${HEADINGS[content.key].documentTitle} – ${name}`)}</title>
<style>
  ${RESPONSIVE_CSS}
</style>
</head>
<body style="margin:0;padding:0;background:#fbeaec;font-family:'Times New Roman',Times,serif;color:#2b2b2b;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader(content.key, details))}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbeaec;">
<tr><td class="wrap" align="center" style="padding:24px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #f0c9ce;">

${rows.filter(Boolean).join('\n\n')}

</table>
</td></tr>
</table>
</body></html>
`;
}
