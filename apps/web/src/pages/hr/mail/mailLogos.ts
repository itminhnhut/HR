import { renderMailHtml, type MailContent, type MailDetails } from '@careers/shared';
import logo from './assets/top-flow-logo.png?inline';
import mark from './assets/top-flow-mark.png?inline';

/** HR's sample images, embedded in the mail as in their design files instead of linked to a site. */
export const MAIL_LOGOS = { logo, mark };

/** The mail as the admin shows and copies it. Only HR screens import this, so the images stay out of the public site. */
export const designedMailHtml = (content: MailContent, details: MailDetails): string =>
  renderMailHtml(content, details, { logos: MAIL_LOGOS });
