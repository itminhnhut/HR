import { describe, expect, it } from 'vitest';
import { CANDIDATE_CV_CHANGES_MAX, candidateCvBlock, hrApplicationSchema, hrContactSchema } from './cv-intake.js';

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

  it('should need the name of who referred a candidate', () => {
    const result = hrApplicationSchema.safeParse({ ...valid, source: 'referral' });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['referrer']);
    expect(hrApplicationSchema.safeParse({ ...valid, source: 'referral', referrer: 'Anh Tuấn kho' }).success).toBe(
      true,
    );
  });

  it('should not let HR pick "Website", which only the form can set', () => {
    expect(hrApplicationSchema.safeParse({ ...valid, source: 'website' }).success).toBe(false);
  });

  it('should refuse a CV link that is not a web address', () => {
    expect(hrApplicationSchema.safeParse({ ...valid, cvLink: 'drive/cv.pdf' }).success).toBe(false);
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
