import { describe, expect, it } from 'vitest';
import { homeDescription, homeTitle, shortPlace, siteJsonLd } from './home-seo.js';

const site = { url: 'https://www.lee-hr.com', companyName: 'TOP FLOW' };

describe('homeTitle and homeDescription', () => {
  it('should give the home page a keyword title Google shows whole', () => {
    // Act
    const title = homeTitle(site.companyName);

    // Assert
    expect(title).toBe('Tuyển dụng TOP FLOW – Việc làm Gò Vấp, TP.HCM');
    expect(title.length).toBeLessThanOrEqual(65);
  });

  it('should give the home page a description between 120 and 160 characters', () => {
    // Act
    const description = homeDescription(site.companyName);

    // Assert
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain('TOP FLOW');
  });
});

describe('shortPlace', () => {
  it('should shorten Hồ Chí Minh City and leave other places as they are', () => {
    expect(shortPlace('Gò Vấp, TP. Hồ Chí Minh')).toBe('Gò Vấp, TP.HCM');
    expect(shortPlace('Gò Vấp, Thành phố Hồ Chí Minh')).toBe('Gò Vấp, TP.HCM');
    expect(shortPlace('Hải Châu, Đà Nẵng')).toBe('Hải Châu, Đà Nẵng');
  });
});

describe('siteJsonLd', () => {
  it('should describe the company with its raster logo and the site it publishes', () => {
    // Act
    const data = siteJsonLd(site) as { '@graph': Record<string, unknown>[] };

    // Assert
    expect(data['@graph'][0]).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://www.lee-hr.com/#organization',
      name: 'TOP FLOW',
      url: 'https://topflow.vn',
      logo: 'https://www.lee-hr.com/images/logo-512.png',
    });
    expect(data['@graph'][1]).toMatchObject({
      '@type': 'WebSite',
      url: 'https://www.lee-hr.com/',
      publisher: { '@id': 'https://www.lee-hr.com/#organization' },
    });
  });
});
