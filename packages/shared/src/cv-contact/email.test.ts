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

  describe('addresses a CV template or a website left behind', () => {
    it.each([
      'Email: yourname@gmail.com',
      'Email: your.name@gmail.com',
      'E-mail: email@gmail.com',
      'Email: tencuaban@gmail.com',
      'Email: abc@yahoo.com',
      'Email: yourname@domain.com',
      'Email: t***n@gmail.com',
      'Email: t•••n@gmail.com',
      'Email: n@gmail.com',
    ])('should not fill %s', (text) => {
      expect(emailOf(text)).toBeNull();
    });

    it('should keep a generic local part on a domain of the candidate', () => {
      expect(emailOf('Email: mail@tranvanbao.dev')).toBe('mail@tranvanbao.dev');
    });
  });

  describe('misread providers', () => {
    it.each(['gmai1.com', 'gmial.com', 'gmail.con', 'gmail.com.vn', 'yah0o.com', 'hotmai1.com'])(
      'should not fill an address at %s',
      (domain) => {
        expect(emailOf(`Email: bichngoc.le@${domain}`)).toBeNull();
      },
    );

    it.each(['mail.com', 'ymail.com', 'fpt.com.vn'])('should keep an address at the real domain %s', (domain) => {
      expect(emailOf(`Email: bichngoc.le@${domain}`)).toBe(`bichngoc.le@${domain}`);
    });
  });

  describe('addresses cut short by extraction', () => {
    it.each([
      ['a local part cut at its dot, with a spaced @', 'bichngoc . le @ gmail . com', 'bichngoc.le@gmail.com'],
      ['a kerning label', 'E - mail :   bichngoc . le @ gmail . com', 'bichngoc.le@gmail.com'],
      ['a letter-spaced address', 'b o . l e @ g m a i l . c o m', 'bo.le@gmail.com'],
      ['a ligature character', 'Email: thao.ﬁnance@gmail.com', 'thao.finance@gmail.com'],
      ['a ligature split out by Chrome', 'Email: thao. fi nance@gmail.com', 'thao.finance@gmail.com'],
      ['a comma typed for the dot', 'bichngoc.le@gmail,com', 'bichngoc.le@gmail.com'],
      ['an address wrapped before @', 'bichngoclethanhhoa.kt\n@gmail.com', 'bichngoclethanhhoa.kt@gmail.com'],
      [
        'an address wrapped inside the local part',
        'bichngoclethanh.kinh\ndoanh88@gmail.com',
        'bichngoclethanh.kinhdoanh88@gmail.com',
      ],
    ])('reads %s', (_case, text, expected) => {
      expect(emailOf(text)).toBe(expected);
    });

    it.each([
      ['a dot before the visible part', 'bichngoc . le@gmail.com'],
      ['a local part split by spaces, no label', 'bich ngoc le@gmail.com'],
      ['an accented letter glued before it', 'Email: thảole@gmail.com'],
      ['a lone long word above that may be the first half', 'bichngocthanhhoakt\ndoanh88@gmail.com'],
    ])('should rather leave it empty with %s', (_case, text) => {
      expect(emailOf(text)).toBeNull();
    });

    it.each([
      ['a sentence that ends before it', 'Điện thoại: 0912 345 678. bichngoc.le@gmail.com'],
      ['a site on the line above', 'bichngoc.github.io\nbichngoc.le@gmail.com'],
      ['a heading word on the line above', 'Marketing\nbichngoc.le@gmail.com'],
      ['"mail" written before it', 'mail bichngoc.le@gmail.com'],
    ])('should read the whole address after %s', (_case, text) => {
      expect(emailOf(text)).toBe('bichngoc.le@gmail.com');
    });

    it('should not glue a sentence to an address on a labelled line', () => {
      expect(emailOf('Email cua toi la bichngoc.le@gmail.com')).toBe('bichngoc.le@gmail.com');
    });
  });

  describe('addresses of someone else or of an employer', () => {
    it.each([
      [
        'a referee block with a Vietnamese heading',
        'NGƯỜI THAM KHẢO\nAnh Lưu Quang Minh – Trưởng nhóm\nEmail: minh.luu@hanoiwood.vn',
      ],
      ['an honorific on the same line', 'Liên hệ: chị Vân – van.pham@hanoiwood.vn'],
      ['a person named on the line above', 'Anh Lưu Quang Minh – Trưởng nhóm\nEmail: minh.luu@hanoiwood.vn'],
      ['a role mailbox in work history', 'KINH NGHIỆM LÀM VIỆC\nLiên hệ: hr@hanoiwood.vn'],
      ['a company address in work history', 'KINH NGHIỆM LÀM VIỆC\nEmail: minh.luu@hanoiwood.vn'],
      ['an employer role mailbox', 'Công ty TNHH Gỗ Hà Nội – lienhe@hanoiwood.vn'],
      ['a letterhead', 'Công ty TNHH Gỗ Hà Nội\nĐiện thoại: 0243 123 4567\nEmail: an@hanoiwood.vn'],
      ['an address to send applications to', 'Gửi CV về: hr.hanoiwood@gmail.com'],
    ])('should leave the box empty with only %s', (_case, text) => {
      expect(emailOf(text)).toBeNull();
    });

    it('should not take a name that opens with "Anh" for an honorific on the line above', () => {
      expect(emailOf('Anh Thư Trịnh\nanhthu.trinh@gmail.com')).toBe('anhthu.trinh@gmail.com');
    });

    it('should read the candidate after a relative on the same line, in the next field', () => {
      expect(emailOf('Khẩn cấp: 0912 345 678 (mẹ) • bichngoc.le@gmail.com')).toBe('bichngoc.le@gmail.com');
    });

    it('should read the candidate in the column next to a company address', () => {
      const text = 'Email công ty: info@hanoiwood.vn   bichngoc.le@gmail.com';

      expect(emailOf(text)).toBe('bichngoc.le@gmail.com');
    });

    it('should prefer a plain label over a school label, wherever the school one is', () => {
      const text = 'Email trường:\n21520114@st.uit.edu.vn\nEmail: bichngoc.le@yahoo.com';

      expect(emailOf(text)).toBe('bichngoc.le@yahoo.com');
    });

    it('should prefer a free-mail address over a school one with no label on either', () => {
      expect(emailOf('21520114@st.uit.edu.vn\nbichngoc.le@yahoo.com')).toBe('bichngoc.le@yahoo.com');
    });

    it('should keep a school address when it is the only one', () => {
      expect(emailOf('Email: 21520114@st.uit.edu.vn')).toBe('21520114@st.uit.edu.vn');
    });

    it('should keep a contact address on the candidate own domain in the header', () => {
      expect(emailOf('Vương Thanh Hà\ncontact@thanhha.design')).toBe('contact@thanhha.design');
    });
  });
});
