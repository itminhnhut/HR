/**
 * Company details shown across the site. Set them in .env (see .env.example). Each value is read as
 * import.meta.env.VITE_X: Vite then inlines only that string, never the whole env object.
 */
import { DEFAULT_COMPANY, envValue } from './env-value';

export { envValue };

export const SITE = {
  company: envValue(import.meta.env.VITE_COMPANY_NAME) || DEFAULT_COMPANY,
  /** Legal name for the privacy policy (topflow.vn). */
  legalName: 'Công ty Cổ phần Top Flow',
  /** HR contact: empty until set in env, and then hidden everywhere instead of showing a placeholder. */
  hrEmail: envValue(import.meta.env.VITE_HR_EMAIL) || '',
  hrPhone: envValue(import.meta.env.VITE_HR_PHONE) || '',
  hrZalo: envValue(import.meta.env.VITE_HR_ZALO) || '',
  url: (envValue(import.meta.env.VITE_SITE_URL) || (typeof location !== 'undefined' ? location.origin : '')).replace(
    /\/$/,
    '',
  ),
  industry: 'Giải pháp đường ống và điều khiển lưu chất',
  size: '50+ nhân sự',
  founded: 'Hơn 10 năm',
  office: 'Gò Vấp, TP. HCM',
  officeHours: 'Thứ 2 – Thứ 7, 8:00 – 17:30',
  /** Where people actually work: the "TOP FLOW JSC" pin on Google Maps (Gò Vấp). Street address pending from HR. */
  officeAddress: 'Văn phòng TOP FLOW, Gò Vấp, TP. Hồ Chí Minh',
  officeLatLng: '10.8458828,106.6801312',
  /** Registered head office (topflow.vn/lien-he). */
  headOffice: 'Tòa nhà Pearl Plaza, 561A Điện Biên Phủ, P. Thạnh Mỹ Tây, TP. HCM',
  hrContactName: envValue(import.meta.env.VITE_HR_CONTACT_NAME) || '',
} as const;

export const telLink = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;

/** Public link to a job. The preview build uses #/ routes on whatever host serves it. */
export function jobUrl(slug: string): string {
  if (import.meta.env.MODE === 'preview' && typeof location !== 'undefined') {
    return `${location.origin}${location.pathname}#/viec-lam/${slug}`;
  }
  return `${SITE.url}/viec-lam/${slug}`;
}

/** Public link to a news post (same rules as jobUrl). */
export function newsUrl(slug: string): string {
  if (import.meta.env.MODE === 'preview' && typeof location !== 'undefined') {
    return `${location.origin}${location.pathname}#/tin-tuc/${slug}`;
  }
  return `${SITE.url}/tin-tuc/${slug}`;
}
