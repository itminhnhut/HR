import { escapeHtml } from '../news/render.js';
import { MAIL_COMPANY } from './company.js';
import { hrEmailOf, hrNameOf, phoneLabel, telHref } from './details.js';
import type { MailDetails } from './types.js';

const CONTACT_LINK = 'color:#2b2b2b;text-decoration:none;';

const contactLine = (letter: string, href: string, label: string) =>
  `<b style="color:#C8102E;display:inline-block;width:16px;">${letter}</b> <a href="${escapeHtml(href)}" style="${CONTACT_LINK}">${escapeHtml(label)}</a>`;

/** The mailbox only: the address is encoded so a value cannot add its own mailto fields. */
export const mailtoHref = (email: string) => `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}`;

function contactLines(details: MailDetails): string {
  const email = hrEmailOf(details);
  const tel = telHref(details.hrPhone);
  const lines = [
    tel ? contactLine('M', tel, phoneLabel(details.hrPhone)) : '',
    contactLine('E', mailtoHref(email), email),
    contactLine('W', `https://${MAIL_COMPANY.website}`, MAIL_COMPANY.website),
  ];
  return lines.filter(Boolean).join('<br>\n        ');
}

function nameLines(details: MailDetails): string {
  const alias = details.hrAlias.trim();
  const title = details.hrTitle.trim();
  const aliasHtml = alias
    ? ` <span style="font-weight:normal;color:#666;font-size:14px;">(${escapeHtml(alias)})</span>`
    : '';
  const titleHtml = title
    ? `<div style="font-size:13px;font-weight:bold;color:#C8102E;letter-spacing:1px;">${escapeHtml(title.toUpperCase())}</div>`
    : '';
  return `<div style="font-size:17px;font-weight:bold;color:#1f1f1f;">${escapeHtml(hrNameOf(details))}${aliasHtml}</div>
        ${titleHtml}`;
}

export function signatureRow(details: MailDetails, markUrl: string): string {
  return `<tr><td class="px" style="padding:18px 40px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0c9ce;">
    <tr>
      <td class="sig-logo" width="100" valign="middle" style="padding:16px 16px 0 0;">
        <img src="${escapeHtml(markUrl)}" alt="${escapeHtml(MAIL_COMPANY.name)}" width="100" style="display:block;width:100px;height:auto;border:0;">
      </td>
      <td class="sig-l" width="36%" valign="middle" style="padding:16px 18px 0 0;border-right:2px solid #C8102E;">
        ${nameLines(details)}
      </td>
      <td class="sig-r" valign="middle" style="padding:16px 0 0 18px;font-size:13px;line-height:1.8;color:#2b2b2b;">
        ${contactLines(details)}
      </td>
    </tr>
  </table>
</td></tr>`;
}
