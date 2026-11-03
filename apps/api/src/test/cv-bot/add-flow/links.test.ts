import { describe, expect, it } from 'vitest';
import { googleToken } from '../../fakes.js';
import { cookiesFrom } from '../../fixtures.js';
import { add, addedId, detail, errorsOf, form, replace, row, rows, useFlow } from './helpers.js';

const flow = useFlow();

/** Fictional share links, in the shape each service really uses. */
const SHARE_LINKS: [string, string][] = [
  ['Google Drive file', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing'],
  ['Google Drive open', 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345'],
  ['Google Docs', 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit?usp=sharing'],
  ['Dropbox', 'https://www.dropbox.com/scl/fi/a1b2c3d4e5/CV-Khoa.pdf?rlkey=abc123&dl=0'],
  ['OneDrive short', 'https://1drv.ms/b/s!AbCdEfGhIjKlMnOp?e=XyZ123'],
  ['OneDrive SharePoint', 'https://congty-my.sharepoint.com/:b:/g/personal/khoa/EAbCdEf?e=XyZ123'],
  ['TopCV', 'https://www.topcv.vn/xem-cv/abcdef0123456789'],
  ['LinkedIn', 'https://www.linkedin.com/in/tran-minh-khoa-fictional/'],
  ['plain PDF over https', 'https://example.com/files/CV-Khoa.pdf'],
  ['plain PDF over http', 'http://example.com/files/CV-Khoa.pdf'],
  ['bit.ly short link', 'https://bit.ly/3AbCdEf'],
  ['tinyurl short link', 'https://tinyurl.com/cv-khoa-fictional'],
];

describe('HR gives a CV link', () => {
  it.each(SHARE_LINKS)('should store a %s link untouched, with no file and no score', async (_name, link) => {
    // Act
    const id = await addedId(await add(flow, { cvLink: link }));

    // Assert
    const app = await detail(flow, id);
    expect(app.cvLink).toBe(link);
    expect(app.cvFileName).toBeNull();
    expect(app.hasCv).toBe(true);
    expect(app.cvScore).toBeNull();
    expect((await row(flow, id))?.cvPathname).toBeNull();
    expect(flow.t.cvStore.files.size).toBe(0);
  });

  it.each(SHARE_LINKS)('should never contact the host of a %s link', async (_name, link) => {
    // Act
    await addedId(await add(flow, { cvLink: link }));

    // Assert
    expect(flow.network()).toEqual([]);
  });
});

/** Nothing here is ever fetched by the server today. Whether to refuse them is a product decision, see the report. */
const INTERNAL_LINKS: [string, string][] = [
  ['localhost', 'http://localhost/cv.pdf'],
  ['localhost with the dev API port', 'http://localhost:8787/api/health'],
  ['the loopback address', 'http://127.0.0.1/cv.pdf'],
  ['IPv6 loopback', 'http://[::1]/cv.pdf'],
  ['a decimal-encoded loopback', 'http://2130706433/cv.pdf'],
  ['a 10.x address', 'http://10.0.0.5/cv.pdf'],
  ['a 192.168.x address', 'http://192.168.1.1/admin'],
  ['the cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
  ['the Google metadata name', 'http://metadata.google.internal/computeMetadata/v1/'],
];

describe('HR gives a link to an internal address', () => {
  it.each(INTERNAL_LINKS)('should store %s as text and never contact it', async (_name, link) => {
    // Act
    const id = await addedId(await add(flow, { cvLink: link }));

    // Assert
    expect((await detail(flow, id)).cvLink).toBe(link);
    expect(flow.network()).toEqual([]);
  });
});

const REFUSED_LINKS: [string, string][] = [
  ['javascript:', 'javascript:alert(1)'],
  ['upper-case JAVASCRIPT:', 'JAVASCRIPT:alert(1)'],
  ['javascript: with a tab inside', 'java\tscript:alert(1)'],
  ['javascript: with a leading space', '  javascript:alert(1)'],
  ['javascript:// that looks like a host', 'javascript://example.com/%0Aalert(1)'],
  ['data: HTML', 'data:text/html,<script>alert(1)</script>'],
  ['data: PDF', 'data:application/pdf;base64,JVBERi0xLjcK'],
  ['file:', 'file:///etc/passwd'],
  ['blob:', 'blob:https://example.com/0000-1111'],
  ['ftp:', 'ftp://example.com/cv.pdf'],
  ['mailto:', 'mailto:khoa.tran@example.com'],
  ['vbscript:', 'vbscript:msgbox(1)'],
  ['no scheme', 'drive.google.com/file/d/abc/view'],
  ['plain words', 'CV gửi qua Zalo rồi'],
];

describe('HR gives something that is not a web link', () => {
  it.each(REFUSED_LINKS)('should refuse %s on the CV link box and create nothing', async (_name, link) => {
    // Act
    const res = await add(flow, { cvLink: link });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cvLink).toBe('Link CV phải bắt đầu bằng http:// hoặc https://');
    expect(await rows(flow)).toEqual([]);
  });

  it.each(REFUSED_LINKS.slice(0, 8))(
    'should refuse %s when replacing a CV and keep the old one',
    async (_name, link) => {
      // Arrange
      const id = await addedId(await add(flow, { cvLink: 'https://example.com/cv-cu.pdf' }));

      // Act
      const res = await replace(flow, id, { cvLink: link });

      // Assert
      expect(res.status).toBe(422);
      expect((await errorsOf(res)).cv).toBeTruthy();
      expect((await detail(flow, id)).cvLink).toBe('https://example.com/cv-cu.pdf');
    },
  );
});

describe('The other two doors a link can come through', () => {
  it('should refuse javascript: on the public application form', async () => {
    // Arrange
    const body = form({
      jobId: flow.job.id,
      fullName: 'Trần Minh Khoa',
      phone: '0912345678',
      consent: 'true',
      formOpenedAt: String(flow.t.clock.now.getTime() - 60_000),
      cvLink: 'javascript:alert(1)',
    });

    // Act
    const res = await flow.t.request('/api/applications', {
      method: 'POST',
      body,
      headers: { 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse javascript: when the candidate updates the CV from their account', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: 'https://example.com/cu.pdf' }));
    const signedIn = await flow.t.send('POST', '/api/candidate/google', {
      idToken: googleToken('khoa.tran@example.com'),
    });

    // Act
    const res = await flow.t.request(`/api/candidate/applications/${id}/cv`, {
      method: 'PUT',
      body: form({ cvLink: 'javascript:alert(1)' }),
      headers: { cookie: cookiesFrom(signedIn), 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect(res.status).toBe(422);
    expect((await detail(flow, id)).cvLink).toBe('https://example.com/cu.pdf');
  });
});

describe('A link with a login on the other doors', () => {
  const LOGIN_LINK = 'https://khoa:matkhau-bi-mat@example.com/cv.pdf';

  it('should refuse it on the public application form', async () => {
    // Arrange
    const body = form({
      jobId: flow.job.id,
      fullName: 'Trần Minh Khoa',
      phone: '0912345678',
      consent: 'true',
      formOpenedAt: String(flow.t.clock.now.getTime() - 60_000),
      cvLink: LOGIN_LINK,
    });

    // Act
    const res = await flow.t.request('/api/applications', {
      method: 'POST',
      body,
      headers: { 'x-requested-with': 'careers-web' },
    });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cvLink).toContain('đăng nhập');
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse it when replacing a CV and keep the old one', async () => {
    // Arrange
    const id = await addedId(await add(flow, { cvLink: 'https://example.com/cu.pdf' }));

    // Act
    const res = await replace(flow, id, { cvLink: LOGIN_LINK });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).cv).toContain('đăng nhập');
    expect((await detail(flow, id)).cvLink).toBe('https://example.com/cu.pdf');
  });
});

describe('The shape of a stored link', () => {
  it('should drop the whitespace around a pasted link', async () => {
    // Act
    const id = await addedId(await add(flow, { cvLink: '  \t https://example.com/cv.pdf \n ' }));

    // Assert
    expect((await detail(flow, id)).cvLink).toBe('https://example.com/cv.pdf');
  });

  it('should treat an empty link as no CV', async () => {
    // Act
    const id = await addedId(await add(flow, { cvLink: '' }));

    // Assert
    const app = await detail(flow, id);
    expect(app.cvLink).toBeNull();
    expect(app.hasCv).toBe(false);
  });

  it('should keep a 2000-character link whole', async () => {
    // Arrange
    const link = `https://example.com/cv?token=${'a'.repeat(1971)}`;

    // Act
    const id = await addedId(await add(flow, { cvLink: link }));

    // Assert
    expect((await detail(flow, id)).cvLink).toBe(link);
  });

  it('should refuse a one-megabyte link instead of storing it', async () => {
    // Arrange
    const link = `https://example.com/cv?token=${'a'.repeat(1024 * 1024)}`;

    // Act
    const res = await add(flow, { cvLink: link });

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it('should keep a link with Vietnamese letters and spaces as HR typed it', async () => {
    // Arrange
    const link = 'https://example.com/hồ-sơ/Trần Minh Khoa.pdf';

    // Act
    const id = await addedId(await add(flow, { cvLink: link }));

    // Assert
    expect((await detail(flow, id)).cvLink).toBe(link);
  });

  it('should accept a link on a Vietnamese domain name', async () => {
    // Arrange
    const link = 'https://hồsơ.example.vn/khoa.pdf';

    // Act
    const res = await add(flow, { cvLink: link });

    // Assert
    expect(res.status).toBe(201);
  });

  it('should keep the access key in the query string of a share link', async () => {
    // Arrange
    const link = 'https://drive.google.com/file/d/1AbC/view?resourcekey=0-xyz&usp=drive_link';

    // Act
    const id = await addedId(await add(flow, { cvLink: link }));

    // Assert
    expect((await detail(flow, id)).cvLink).toBe(link);
  });

  it('should answer a field error, not a server error, for a link holding a NUL character', async () => {
    // Act
    const res = await add(flow, { cvLink: 'https://example.com/cv\u0000.pdf' });

    // Assert
    expect(res.status).toBeLessThan(500);
  });
});

describe('A link that would deceive or expose something', () => {
  it('should refuse a link carrying a user name and password', async () => {
    // Act
    const res = await add(flow, { cvLink: 'https://khoa:matkhau-bi-mat@example.com/cv.pdf' });

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse a link that shows a trusted name before an @ but goes elsewhere', async () => {
    // Act
    const res = await add(flow, { cvLink: 'https://drive.google.com@ke-gia-mao.example/cv.pdf' });

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it.each([
    ['no slashes after the scheme', 'https:example.com/cv.pdf'],
    ['one slash after the scheme', 'https:/example.com/cv.pdf'],
    ['backslashes after the scheme', 'https:\\\\example.com\\cv.pdf'],
    ['a line break inside the scheme', 'ht\ntps://example.com/cv.pdf'],
  ])('should refuse a link the HR page could not open: %s', async (_name, link) => {
    // Act
    const res = await add(flow, { cvLink: link });

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });

  it('should keep an upper-case scheme openable', async () => {
    // Act
    const id = await addedId(await add(flow, { cvLink: 'HTTPS://EXAMPLE.COM/CV.PDF' }));

    // Assert
    expect((await detail(flow, id)).cvLink).toMatch(/^https?:\/\//i);
  });
});
