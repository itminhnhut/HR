import { OFFICE } from './job-template.js';
import { COMPANY_WEBSITE, SITE_LOGO_PATH } from './seo.js';

/**
 * The home page's title, description and site-wide structured data: one source for the crawler page
 * (apps/api/src/services/home-bot-page.ts), the SPA (JobsPage) and the JSON-LD in apps/web/index.html.
 */

interface Site {
  url: string;
  companyName: string;
}

/** "Gò Vấp, TP. Hồ Chí Minh" → "Gò Vấp, TP.HCM": short enough for a job card or a title. */
export function shortPlace(place: string): string {
  return place.replace(/(Thành phố|TP\.?)\s*(Hồ Chí Minh|HCM)\b/giu, 'TP.HCM');
}

/** "Gò Vấp, TP.HCM": where the office is, as people search for it. */
export const OFFICE_PLACE = shortPlace(`${OFFICE.district}, ${OFFICE.city}`);

export const COMPANY_LEGAL_NAME = 'Công ty Cổ phần Top Flow';

/** "Tuyển dụng TOP FLOW – Việc làm Gò Vấp, TP.HCM": names the brand, so pageTitle adds nothing. */
export const homeTitle = (company: string) => `Tuyển dụng ${company} – Việc làm ${OFFICE_PLACE}`;

export const homeDescription = (company: string) =>
  `Việc làm tại ${company} ở ${OFFICE_PLACE}, công ty giải pháp đường ống và điều khiển lưu chất. ` +
  'Xem vị trí đang tuyển, mức lương, quyền lợi và gửi CV nhanh.';

/** Organization + WebSite, the same graph apps/web/index.html carries (a web test compares them). */
export function siteJsonLd(site: Site): Record<string, unknown> {
  const organizationId = `${site.url}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: site.companyName,
        legalName: COMPANY_LEGAL_NAME,
        url: COMPANY_WEBSITE,
        logo: `${site.url}${SITE_LOGO_PATH}`,
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Tòa nhà Pearl Plaza, 561A Điện Biên Phủ',
          addressLocality: 'TP. Hồ Chí Minh',
          addressCountry: 'VN',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${site.url}/#website`,
        url: `${site.url}/`,
        name: `Tuyển dụng ${site.companyName}`,
        inLanguage: 'vi',
        publisher: { '@id': organizationId },
      },
    ],
  };
}
