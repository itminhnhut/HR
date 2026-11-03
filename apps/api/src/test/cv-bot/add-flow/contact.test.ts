import { NAME_MAX, REFERRER_MAX } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { add, addedId, addWithout, detail, errorsOf, hrSend, list, PHONE, rows, useFlow } from './helpers.js';

const flow = useFlow();

describe('Required details (the page sends no field for an empty box)', () => {
  it('should ask for the name in Vietnamese when the box is empty', async () => {
    // Act
    const res = await addWithout(flow, ['fullName']);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).fullName).toBe('Nhập họ và tên.');
  });

  it('should ask for the phone in Vietnamese when the box is empty', async () => {
    // Act
    const res = await addWithout(flow, ['phone']);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).phone).toBe('Nhập số điện thoại (Zalo).');
  });

  it('should ask for the job in Vietnamese when none is picked', async () => {
    // Act
    const res = await addWithout(flow, ['jobId']);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).jobId).toBe('Chọn vị trí ứng tuyển.');
  });

  it('should ask for the source in Vietnamese when none is picked', async () => {
    // Act
    const res = await addWithout(flow, ['source']);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).source).toBe('Chọn nguồn hồ sơ.');
  });

  it('should save without an email', async () => {
    // Act
    const id = await addedId(await addWithout(flow, ['email']));

    // Assert
    expect((await detail(flow, id)).email).toBeNull();
  });

  it('should save without a CV and show that there is none', async () => {
    // Act
    const id = await addedId(await add(flow));

    // Assert
    const app = await detail(flow, id);
    expect(app.hasCv).toBe(false);
    expect(app.cvLink).toBeNull();
    expect(app.cvFileName).toBeNull();
  });
});

describe('Phone formats', () => {
  it.each([
    ['plain', '0912345678'],
    ['with spaces', '0912 345 678'],
    ['with dots', '0912.345.678'],
    ['with dashes', '0912-345-678'],
    ['with +84', '+84912345678'],
    ['with +84 and spaces', '+84 912 345 678'],
    ['with 84', '84912345678'],
    ['with (+84)', '(+84) 912 345 678'],
    ['with spaces around', '  0912345678  '],
  ])('should store a number written %s as 0912345678', async (_name, phone) => {
    // Act
    const id = await addedId(await add(flow, { phone }));

    // Assert
    expect((await detail(flow, id)).phone).toBe(PHONE);
  });

  it.each(['0312345678', '0512345678', '0712345678', '0812345678', '0912345678'])(
    'should accept the mobile number %s',
    async (phone) => {
      // Act
      const res = await add(flow, { phone });

      // Assert
      expect(res.status).toBe(201);
    },
  );

  it.each([
    ['too short', '091234567'],
    ['too long', '09123456789'],
    ['a landline', '02438123456'],
    ['a 1900 number', '1900123456'],
    ['a foreign number', '+14155550100'],
    ['two numbers in one box', '0912345678 / 0987654321'],
    ['words', 'gọi Zalo'],
    ['full-width digits', '０９１２３４５６７８'],
  ])('should refuse %s and say what is wrong', async (_name, phone) => {
    // Act
    const res = await add(flow, { phone });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).phone).toBe('Số điện thoại chưa đúng, cần 10 số, ví dụ 0912 345 678.');
    expect(await rows(flow)).toEqual([]);
  });

  it('should refuse letters inside a number rather than guess the digits', async () => {
    // Act
    const res = await add(flow, { phone: '09x12345678' });

    // Assert
    expect(res.status).toBe(422);
    expect(await rows(flow)).toEqual([]);
  });
});

describe('Email', () => {
  it.each(['khoa', 'khoa@', '@example.com', 'khoa tran@example.com', 'khoa@example', 'a@b@example.com'])(
    'should refuse %s',
    async (email) => {
      // Act
      const res = await add(flow, { email });

      // Assert
      expect(res.status).toBe(422);
      expect((await errorsOf(res)).email).toBe('Email chưa đúng.');
      expect(await rows(flow)).toEqual([]);
    },
  );

  it('should store it lower case so the candidate account finds it', async () => {
    // Act
    const id = await addedId(await add(flow, { email: 'Khoa.Tran@Example.COM' }));

    // Assert
    expect((await detail(flow, id)).email).toBe('khoa.tran@example.com');
  });

  it('should drop the spaces around a pasted email', async () => {
    // Act
    const res = await add(flow, { email: '  khoa.tran@example.com ' });

    // Assert
    expect(res.status).toBe(201);
    expect((await detail(flow, await addedId(res))).email).toBe('khoa.tran@example.com');
  });

  it('should treat an empty email as none', async () => {
    // Act
    const id = await addedId(await add(flow, { email: '' }));

    // Assert
    expect((await detail(flow, id)).email).toBeNull();
  });
});

describe('Name', () => {
  it('should trim the spaces around it', async () => {
    // Act
    const id = await addedId(await add(flow, { fullName: '   Trần Minh Khoa \t' }));

    // Assert
    expect((await detail(flow, id)).fullName).toBe('Trần Minh Khoa');
  });

  it.each([
    ['only spaces', '    '],
    ['a single letter', 'K'],
    ['a single letter with spaces', '  K  '],
    ['empty', ''],
  ])('should refuse %s', async (_name, fullName) => {
    // Act
    const res = await add(flow, { fullName });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).fullName).toBe('Nhập họ và tên.');
  });

  it('should take the longest name allowed and refuse one letter more', async () => {
    // Act
    const longest = await add(flow, { fullName: 'A'.repeat(NAME_MAX) });
    const tooLong = await add(flow, { fullName: 'A'.repeat(NAME_MAX + 1), phone: '0987654321' });

    // Assert
    expect(longest.status).toBe(201);
    expect(tooLong.status).toBe(422);
    expect((await errorsOf(tooLong)).fullName).toBe('Họ tên quá dài.');
  });

  it('should store a decomposed (NFD) Vietnamese name in composed form (NFC)', async () => {
    // Arrange
    const composed = 'Nguyễn Thị Hằng';

    // Act
    const id = await addedId(await add(flow, { fullName: composed.normalize('NFD') }));

    // Assert
    expect((await detail(flow, id)).fullName).toBe(composed);
  });

  it('should find a name typed in NFD when HR searches in NFC', async () => {
    // Arrange
    const composed = 'Nguyễn Thị Hằng';
    await addedId(await add(flow, { fullName: composed.normalize('NFD') }));

    // Act
    const found = await list(flow, `?q=${encodeURIComponent(composed)}`);

    // Assert
    expect(found.applications).toHaveLength(1);
  });

  it('should find a name typed in NFC when HR searches without tones', async () => {
    // Arrange
    await addedId(await add(flow, { fullName: 'Nguyễn Thị Hằng' }));

    // Act
    const found = await list(flow, '?q=nguyen%20hang');

    // Assert
    expect(found.applications).toHaveLength(1);
  });

  it('should store markup as plain text', async () => {
    // Arrange
    const fullName = '<img src=x onerror=alert(1)>';

    // Act
    const id = await addedId(await add(flow, { fullName }));

    // Assert
    expect((await detail(flow, id)).fullName).toBe(fullName);
  });

  it.each([
    ['the note', { note: 'Ghi\u0000chú' }, 'note'],
    ['the referrer', { source: 'referral', referrer: 'Anh\u0000Tuấn' }, 'referrer'],
    ['the source', { source: 'za\u0000lo' }, 'source'],
  ])('should answer a field error, not a server error, for a NUL character in %s', async (_name, over, field) => {
    // Act
    const res = await add(flow, over);

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res))[field]).toBeTruthy();
  });

  it('should answer a field error, not a server error, for a name holding a NUL character', async () => {
    // Act
    const res = await add(flow, { fullName: 'Trần\u0000Khoa' });

    // Assert
    expect(res.status).toBe(422);
  });
});

describe('Referrer', () => {
  it('should be required for a referral', async () => {
    // Act
    const res = await add(flow, { source: 'referral' });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).referrer).toBe('Ghi tên người giới thiệu.');
  });

  it('should refuse only spaces for a referral', async () => {
    // Act
    const res = await add(flow, { source: 'referral', referrer: '   ' });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).referrer).toBe('Ghi tên người giới thiệu.');
  });

  it('should keep the name of whoever referred the candidate', async () => {
    // Act
    const id = await addedId(await add(flow, { source: 'referral', referrer: ' Anh Tuấn (kho) ' }));

    // Assert
    expect((await detail(flow, id)).referrer).toBe('Anh Tuấn (kho)');
  });

  it('should drop a referrer left over from another source', async () => {
    // Act
    const id = await addedId(await add(flow, { source: 'zalo', referrer: 'Anh Tuấn' }));

    // Assert
    expect((await detail(flow, id)).referrer).toBeNull();
  });

  it('should refuse a referrer that is too long', async () => {
    // Act
    const res = await add(flow, { source: 'referral', referrer: 'A'.repeat(REFERRER_MAX + 1) });

    // Assert
    expect(res.status).toBe(422);
    expect((await errorsOf(res)).referrer).toBe(`Tối đa ${REFERRER_MAX} ký tự.`);
  });

  it('should save when a long referrer was left behind in a box another source hides', async () => {
    // Act
    const res = await add(flow, { source: 'zalo', referrer: 'A'.repeat(REFERRER_MAX + 1) });

    // Assert
    expect((await detail(flow, await addedId(res))).referrer).toBeNull();
  });
});

describe('Changing contact details at the same moment', () => {
  it('should let only one of two applications of a job take the same new phone', async () => {
    // Arrange
    const first = await addedId(await add(flow, { phone: '0912000001' }));
    const second = await addedId(await add(flow, { phone: '0912000002' }));
    const edit = (id: string) =>
      hrSend(flow, 'PATCH', `/applications/${id}/contact`, { phone: '0912000003', email: null, source: 'zalo' });

    // Act
    const answers = await Promise.all([edit(first), edit(second)]);

    // Assert
    expect(answers.map((res) => res.status).sort()).toEqual([200, 409]);
  });
});
