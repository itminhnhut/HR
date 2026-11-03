import { escapeHtml } from '../news/render.js';
import { MAIL_COMPANY } from './company.js';
import {
  addressOf,
  calendarLinkOf,
  durationOf,
  interviewerOf,
  interviewPartsOf,
  mapUrlOf,
  meetingLinkOf,
} from './details.js';
import type { InterviewParts } from './interview-date.js';
import type { MailContent, MailDetails } from './types.js';

export const LABEL = 'font-size:11px;letter-spacing:1.5px;color:#999;';
export const ROW_LINE = 'padding:12px 0;border-bottom:1px solid #f3e3e5;';

function dateTile(parts: InterviewParts | null, calendarUrl: string): string {
  const shell = (inner: string) =>
    `<td class="date" width="150" valign="middle" align="center" bgcolor="#C8102E" style="background:#C8102E;padding:22px 12px;color:#ffffff;">${inner}</td>`;
  if (!parts) return shell('<div style="font-size:18px;font-weight:bold;letter-spacing:1px;">Chưa có lịch</div>');
  return shell(`
        <div style="font-size:12px;letter-spacing:2px;color:#ffd6db;">${parts.weekday}</div>
        <div class="date-d" style="font-size:46px;line-height:1;font-weight:bold;margin:6px 0 4px;">${parts.day}</div>
        <div style="font-size:12px;letter-spacing:1px;color:#ffd6db;">THÁNG ${parts.monthYear}</div>
        <div style="width:36px;height:1px;background:#ffb3bc;margin:12px auto;line-height:1px;font-size:0;">&nbsp;</div>
        <div style="font-size:22px;font-weight:bold;letter-spacing:1px;">${parts.time}</div>
        <a href="${escapeHtml(calendarUrl)}" style="display:inline-block;margin-top:12px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:underline;">THÊM VÀO LỊCH</a>
      `);
}

function placeRow(details: MailDetails): string {
  return `<tr><td style="${ROW_LINE}">
            <div style="${LABEL}">ĐỊA ĐIỂM</div>
            <div style="font-size:15px;line-height:1.5;color:#1f1f1f;margin-top:3px;"><b>${escapeHtml(MAIL_COMPANY.officeName)}</b><br><span style="color:#555;">${escapeHtml(addressOf(details))}</span></div>
            <a href="${escapeHtml(mapUrlOf(details))}" style="display:inline-block;margin-top:4px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#C8102E;text-decoration:none;">XEM BẢN ĐỒ &rarr;</a>
          </td></tr>`;
}

/** No row at all without a usable link: a bad link must not reach the candidate. */
function meetingRow(details: MailDetails): string {
  const url = meetingLinkOf(details);
  if (!url) return '';
  const safe = escapeHtml(url);
  return `<tr><td style="${ROW_LINE}">
            <div style="${LABEL}">LINK THAM GIA</div>
            <div style="font-size:15px;line-height:1.5;margin-top:3px;word-break:break-all;"><a href="${safe}" style="color:#C8102E;font-weight:bold;text-decoration:none;">${safe}</a></div>
          </td></tr>`;
}

export const halfCell = (label: string, value: string) => `<td width="50%" valign="top">
                <div style="${LABEL}">${label}</div>
                <div style="font-size:15px;color:#1f1f1f;margin-top:3px;">${escapeHtml(value)}</div>
              </td>`;

function infoRows(content: MailContent, details: MailDetails): string {
  const online = content.key === 'interview_online';
  return `${online ? meetingRow(details) : placeRow(details)}
          <tr><td style="${ROW_LINE}">
            <div style="${LABEL}">NGƯỜI TRAO ĐỔI</div>
            <div style="font-size:15px;line-height:1.5;color:#1f1f1f;margin-top:3px;">${escapeHtml(interviewerOf(details))}</div>
          </td></tr>
          <tr><td style="padding:12px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              ${halfCell('THỜI LƯỢNG', durationOf(details))}
              ${halfCell('HÌNH THỨC', online ? 'Online' : 'Trực tiếp')}
            </tr></table>
          </td></tr>`;
}

/** "THÔNG TIN BUỔI PHỎNG VẤN": date tile on the left, details on the right. */
export function detailsCardRow(content: MailContent, details: MailDetails): string {
  return `<tr><td class="px" style="padding:22px 40px 0;">
  <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#C8102E;padding-bottom:8px;">THÔNG TIN BUỔI PHỎNG VẤN</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ecd3d6;border-radius:8px;border-collapse:separate;overflow:hidden;">
    <tr>
      ${dateTile(interviewPartsOf(details), calendarLinkOf(content.key, details))}
      <td class="info" valign="middle" style="padding:6px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${infoRows(content, details)}
        </table>
      </td>
    </tr>
  </table>
</td></tr>`;
}
