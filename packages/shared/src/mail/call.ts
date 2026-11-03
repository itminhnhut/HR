import { escapeHtml } from '../news/render.js';
import { halfCell, LABEL, ROW_LINE } from './card.js';
import { MAIL_COMPANY } from './company.js';
import { callDurationOf, hrContactNameOf } from './details.js';
import type { MailDetails } from './types.js';

const CALL_TOPICS = 'Kinh nghiệm làm việc, mong muốn về công việc & thời gian có thể nhận việc';
const CALL_MODE = 'Điện thoại';
const EXAMPLE_TIMES = ['Thứ Tư: 9:00 – 11:00', 'Thứ Năm: sau 14:00'];

/** "THÔNG TIN CUỘC GỌI": who calls, about what, for how long. */
export function callCardRow(details: MailDetails): string {
  const phone = details.hrPhone.trim();
  const phoneLine = phone
    ? `<div style="font-size:13px;color:#555;margin-top:2px;">HR sẽ gọi từ số: <b style="color:#C8102E;">${escapeHtml(phone)}</b></div>`
    : '';
  return `<tr><td class="px" style="padding:22px 40px 0;">
  <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#C8102E;padding-bottom:8px;">THÔNG TIN CUỘC GỌI</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ecd3d6;border-top:3px solid #C8102E;border-radius:8px;border-collapse:separate;">
    <tr><td style="padding:6px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="${ROW_LINE}">
          <div style="${LABEL}">NGƯỜI LIÊN HỆ</div>
          <div style="font-size:15px;line-height:1.5;color:#1f1f1f;margin-top:3px;"><b>${escapeHtml(hrContactNameOf(details))}</b> – HR ${escapeHtml(MAIL_COMPANY.name)}</div>
          ${phoneLine}
        </td></tr>
        <tr><td style="${ROW_LINE}">
          <div style="${LABEL}">NỘI DUNG TRAO ĐỔI</div>
          <div style="font-size:15px;line-height:1.5;color:#1f1f1f;margin-top:3px;">${escapeHtml(CALL_TOPICS)}</div>
        </td></tr>
        <tr><td style="padding:12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${halfCell('THỜI LƯỢNG', callDurationOf(details))}
            ${halfCell('HÌNH THỨC', CALL_MODE)}
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>`;
}

/** The example inside the callout, which shows how to answer. */
export function callExampleBox(): string {
  const lines = EXAMPLE_TIMES.map((time) => `• ${escapeHtml(time)}`).join('<br>');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:#ffffff;border:1px dashed #e8b9bf;">
        <tr><td style="padding:10px 14px;font-size:14px;line-height:1.8;color:#555;">
          <i>Ví dụ:</i><br>
          ${lines}
        </td></tr>
      </table>`;
}

export function callDetailsText(details: MailDetails): string {
  const phone = details.hrPhone.trim();
  return [
    'THÔNG TIN CUỘC GỌI',
    `- Người liên hệ: ${hrContactNameOf(details)} – HR ${MAIL_COMPANY.name}`,
    phone ? `- HR sẽ gọi từ số: ${phone}` : '',
    `- Nội dung trao đổi: ${CALL_TOPICS}`,
    `- Thời lượng: ${callDurationOf(details)}`,
    `- Hình thức: ${CALL_MODE}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export const callExampleText = () => ['Ví dụ:', ...EXAMPLE_TIMES.map((time) => `- ${time}`)].join('\n');
