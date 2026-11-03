import { describe, expect, it } from 'vitest';
import { CANDIDATE_CV_CHANGES_MAX, candidateCvBlock, hrApplicationSchema, hrContactSchema } from './cv-intake.js';
import { applicationFieldsSchema, CV_LINK_MAX, NAME_MAX } from './validation.js';

const valid = {
  jobId: '11111111-1111-4111-8111-111111111111',
  fullName: ' Trần Minh Khoa ',
  phone: '0912 345 678',
  email: 'Khoa@Mail.vn',
  source: 'zalo',
  consent: true,
};

describe('hrApplicationSchema', () => {
  it('should accept an application HR received on Zalo and tidy its fields', () => {
    // Act
    const parsed = hrApplicationSchema.parse(valid);

    // Assert
    expect(parsed).toMatchObject({
      fullName: 'Trần Minh Khoa',
      phone: '0912345678',
      email: 'khoa@mail.vn',
      referrer: null,
    });
  });

  it('should need HR to confirm the candidate agreed', () => {
    const result = hrApplicationSchema.safeParse({ ...valid, consent: false });
    expect(result.error?.issues[0]?.path).toEqual(['consent']);
  });

  it('should need a source', () => {
    expect(hrApplicationSchema.safeParse({ ...valid, source: ' ' }).error?.issues[0]?.path).toEqual(['source']);
  });

  it('should need the name of who referred a candidate', () => {
    const result = hrApplicationSchema.safeParse({ ...valid, source: 'referral' });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['referrer']);
    expect(hrApplicationSchema.safeParse({ ...valid, source: 'referral', referrer: 'Anh Tuấn kho' }).success).toBe(
      true,
    );
  });

  it('should refuse a CV link that is not a web address', () => {
    expect(hrApplicationSchema.safeParse({ ...valid, cvLink: 'drive/cv.pdf' }).success).toBe(false);
  });
});

describe('the fields HR and the public form share', () => {
  const pub = {
    jobId: 'x',
    fullName: 'Trần Minh Khoa',
    phone: '0912345678',
    consent: true,
    formOpenedAt: 1,
  };
  const messageOf = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }, field: string) =>
    result.error?.issues.find((i) => i.path[0] === field)?.message;

  it('should ask for a missing name, phone and source in Vietnamese', () => {
    // Act
    const hr = hrApplicationSchema.safeParse({ jobId: valid.jobId, consent: true });
    const publicForm = applicationFieldsSchema.safeParse({ jobId: 'x', consent: true, formOpenedAt: 1 });

    // Assert
    expect(messageOf(hr, 'fullName')).toBe('Nhập họ và tên.');
    expect(messageOf(hr, 'phone')).toBe('Nhập số điện thoại (Zalo).');
    expect(messageOf(hr, 'source')).toBe('Chọn nguồn hồ sơ.');
    expect(messageOf(publicForm, 'fullName')).toBe('Nhập họ và tên.');
    expect(messageOf(publicForm, 'phone')).toBe('Nhập số điện thoại (Zalo).');
  });

  it('should store a name in composed form, and count its length once composed', () => {
    // Arrange
    const composed = 'Nguyễn Thị Hằng';
    const longest = 'ễ'.repeat(NAME_MAX);

    // Act
    const hr = hrApplicationSchema.parse({ ...valid, fullName: composed.normalize('NFD') });
    const publicForm = applicationFieldsSchema.parse({ ...pub, fullName: composed.normalize('NFD') });

    // Assert
    expect(hr.fullName).toBe(composed);
    expect(publicForm.fullName).toBe(composed);
    expect(hrApplicationSchema.safeParse({ ...valid, fullName: longest.normalize('NFD') }).success).toBe(true);
  });

  it('should refuse a NUL character in a name or a message with a message of its own', () => {
    // Act
    const name = applicationFieldsSchema.safeParse({ ...pub, fullName: 'Trần\u0000Khoa' });
    const message = applicationFieldsSchema.safeParse({ ...pub, message: 'Chào\u0000em' });

    // Assert
    expect(messageOf(name, 'fullName')).toBe('Có ký tự không hợp lệ, gõ lại giúp.');
    expect(messageOf(message, 'message')).toBe('Có ký tự không hợp lệ, gõ lại giúp.');
  });

  it('should drop the spaces around an email before checking it', () => {
    // Act
    const hr = hrApplicationSchema.parse({ ...valid, email: '  Khoa@Mail.vn ' });
    const publicForm = applicationFieldsSchema.parse({ ...pub, email: '  khoa@mail.vn ' });
    const contact = hrContactSchema.parse({ phone: valid.phone, source: 'email', email: ' khoa@mail.vn\t' });

    // Assert
    expect(hr.email).toBe('khoa@mail.vn');
    expect(publicForm.email).toBe('khoa@mail.vn');
    expect(contact.email).toBe('khoa@mail.vn');
  });

  it.each([
    ['a user name and password', 'https://khoa:matkhau@example.com/cv.pdf'],
    ['a user name only', 'https://khoa@example.com/cv.pdf'],
    ['a password only', 'https://:matkhau@example.com/cv.pdf'],
    ['a trusted name before the @', 'https://drive.google.com@ke-gia-mao.example/'],
    ['a trusted name and an empty password', 'https://drive.google.com:@ke-gia-mao.example/'],
    ['upper-case scheme with a login', 'HTTPS://khoa:mk@example.com/'],
  ])('should refuse a link with %s on both forms', (_name, cvLink) => {
    // Act
    const hr = hrApplicationSchema.safeParse({ ...valid, cvLink });
    const publicForm = applicationFieldsSchema.safeParse({ ...pub, cvLink });

    // Assert
    expect(messageOf(hr, 'cvLink')).toBe('Link CV không được chứa tên đăng nhập hoặc mật khẩu.');
    expect(messageOf(publicForm, 'cvLink')).toBe('Link CV không được chứa tên đăng nhập hoặc mật khẩu.');
  });

  it('should keep an @ that is not in the address part of a link', () => {
    // Arrange
    const links = [
      'https://www.linkedin.com/in/@khoa',
      'https://example.com/cv?mail=khoa@example.com',
      'https://example.com/cv#khoa@example.com',
    ];

    // Act
    const results = links.map((cvLink) => hrApplicationSchema.safeParse({ ...valid, cvLink }).success);

    // Assert
    expect(results).toEqual([true, true, true]);
  });

  it('should take a link of the longest length allowed and refuse one letter more on both forms', () => {
    // Arrange
    const start = 'https://example.com/cv?t=';
    const longest = start + 'a'.repeat(CV_LINK_MAX - start.length);

    // Act
    const hrOk = hrApplicationSchema.safeParse({ ...valid, cvLink: longest });
    const hrLong = hrApplicationSchema.safeParse({ ...valid, cvLink: `${longest}a` });
    const publicLong = applicationFieldsSchema.safeParse({ ...pub, cvLink: `${longest}a` });

    // Assert
    expect(hrOk.success).toBe(true);
    expect(messageOf(hrLong, 'cvLink')).toBe(`Link CV tối đa ${CV_LINK_MAX} ký tự.`);
    expect(messageOf(publicLong, 'cvLink')).toBe(`Link CV tối đa ${CV_LINK_MAX} ký tự.`);
  });

  it('should refuse a link holding a NUL character on both forms', () => {
    // Act
    const hr = hrApplicationSchema.safeParse({ ...valid, cvLink: 'https://example.com/cv\u0000.pdf' });
    const publicForm = applicationFieldsSchema.safeParse({ ...pub, cvLink: 'https://example.com/cv\u0000.pdf' });
    const leading = applicationFieldsSchema.safeParse({ ...pub, cvLink: '\u0000https://example.com/cv.pdf' });

    // Assert
    expect(messageOf(hr, 'cvLink')).toBe('Có ký tự không hợp lệ, gõ lại giúp.');
    expect(messageOf(publicForm, 'cvLink')).toBe('Có ký tự không hợp lệ, gõ lại giúp.');
    expect(leading.success).toBe(false);
  });
});

describe('hrContactSchema', () => {
  it('should check the phone like the public form', () => {
    expect(hrContactSchema.safeParse({ phone: '123', source: 'email' }).success).toBe(false);
  });
});

describe('candidateCvBlock', () => {
  it('should let the candidate replace the CV while HR has not decided and the job is open', () => {
    expect(candidateCvBlock({ status: 'seen', jobOpen: true, changes: 0 })).toBeNull();
  });

  it('should explain why the CV cannot be replaced', () => {
    expect(candidateCvBlock({ status: 'interview', jobOpen: true, changes: 0 })).toMatch(/đã được xử lý/);
    expect(candidateCvBlock({ status: 'new', jobOpen: false, changes: 0 })).toMatch(/Tin đã đóng/);
    expect(candidateCvBlock({ status: 'new', jobOpen: true, changes: CANDIDATE_CV_CHANGES_MAX })).toMatch(
      /tối đa 3 lần/,
    );
  });
});
