/** Company details shown across the site. Set them in .env (see .env.example). */
const env = import.meta.env;

export const SITE = {
  company: env.VITE_COMPANY_NAME || '[Tên công ty]',
  hrEmail: env.VITE_HR_EMAIL || '[email HR]',
  hrPhone: env.VITE_HR_PHONE || '[số điện thoại]',
  hrZalo: env.VITE_HR_ZALO || '',
  url: (env.VITE_SITE_URL || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, ''),
  industry: '[Lĩnh vực hoạt động]',
  size: '[50 – 100] nhân viên',
  founded: '[Năm]',
  office: 'Quận 3, TP. HCM',
  hrContactName: '[Tên người phụ trách]',
} as const;

export const telLink = (phone: string) => `tel:${phone.replace(/\s/g, '')}`;

/** Public link to a job. The preview build uses #/ routes on whatever host serves it. */
export function jobUrl(slug: string): string {
  if (import.meta.env.MODE === 'preview' && typeof location !== 'undefined') {
    return `${location.origin}${location.pathname}#/viec-lam/${slug}`;
  }
  return `${SITE.url}/viec-lam/${slug}`;
}
