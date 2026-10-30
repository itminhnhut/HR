import { describe, expect, it } from 'vitest';
import { parseCvContact } from './index.js';

function emailOf(text: string): string | null {
  return parseCvContact(text).email;
}

describe('parseCvContact – email', () => {
  it.each([
    ['a plain address', 'Email: nguyen.an@gmail.com', 'nguyen.an@gmail.com'],
    ['an uppercase address, lowercased', 'EMAIL: Nguyen.An@Gmail.COM', 'nguyen.an@gmail.com'],
    ['an "E-mail" label', 'E-mail: tranhung95@yahoo.com.vn', 'tranhung95@yahoo.com.vn'],
    ['a "Gmail:" label', 'Gmail: lethihoa.hr@gmail.com', 'lethihoa.hr@gmail.com'],
    ['a mailto: link', 'Liên hệ qua mailto:pham.minh@outlook.com', 'pham.minh@outlook.com'],
    ['spaces around @ and dots from PDF extraction', 'Email: nguyen.an @ gmail . com', 'nguyen.an@gmail.com'],
    ['a provider domain broken by a stray space', 'Email: vuthanh@gm ail.com', 'vuthanh@gmail.com'],
    ['a labelled local part split by PDF extraction', 'Email: nguyenvan an@gmail.com', 'nguyenvanan@gmail.com'],
    ['"[at]" and "[dot]" obfuscation', 'Mail: hoang.long [at] gmail [dot] com', 'hoang.long@gmail.com'],
    ['"(at)" obfuscation', 'dang.khoa(at)fpt.edu.vn', 'dang.khoa@fpt.edu.vn'],
    ['spoken " at … dot " on a labelled line', 'Email: buiminh at outlook dot com', 'buiminh@outlook.com'],
    ['spoken " at " with a free-mail domain', 'Liên hệ: ngocanh at gmail.com', 'ngocanh@gmail.com'],
    ['trailing punctuation stripped', 'Email của tôi là an.le@gmail.com.', 'an.le@gmail.com'],
    ['an address in brackets', '(huynhmai@gmail.com)', 'huynhmai@gmail.com'],
    ['an address glued to the next label', 'Email: an@gmail.comPhone: 0912345678', 'an@gmail.com'],
    ['a multi-level school domain', 'Email: 20201234@sv.hust.edu.vn', '20201234@sv.hust.edu.vn'],
    ['an icon before the address', '✉ thao.nguyen@icloud.com', 'thao.nguyen@icloud.com'],
  ])('reads %s', (_case, text, expected) => {
    expect(emailOf(text)).toBe(expected);
  });

  it('should not turn "worked at shopee.vn" into an email', () => {
    expect(emailOf('Từng worked at shopee.vn trong 2 năm')).toBeNull();
  });

  it('should prefer the personal address over a company role mailbox', () => {
    const text = 'KINH NGHIỆM\nCông ty ABC (hr@abc.com.vn)\nTHÔNG TIN\nEmail: minhthu@gmail.com';
    expect(emailOf(text)).toBe('minhthu@gmail.com');
  });

  it.each(['info', 'contact', 'careers', 'tuyendung', 'noreply'])(
    'should skip a %s@ company mailbox listed before the personal one',
    (local) => {
      const text = `Công ty TNHH XYZ - ${local}@xyz.vn\nan.tran@gmail.com`;
      expect(emailOf(text)).toBe('an.tran@gmail.com');
    },
  );

  it('should ignore the email of a person in the reference section', () => {
    const text = 'NGƯỜI THAM CHIẾU\nÔng Lê Văn Bình - Trưởng phòng\nEmail: binh.le@gmail.com';
    expect(emailOf(text)).toBeNull();
  });

  it('should keep the candidate email listed before the "References" block', () => {
    const text = 'Email: huong.do@gmail.com\nREFERENCES\nMr. John Lee - john.lee@acme.com';
    expect(emailOf(text)).toBe('huong.do@gmail.com');
  });

  it('should return null when the text has no address', () => {
    expect(emailOf('Nguyễn Văn An\n0912345678\nHà Nội')).toBeNull();
  });
});
