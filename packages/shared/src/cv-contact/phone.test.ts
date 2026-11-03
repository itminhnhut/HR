import { describe, expect, it } from 'vitest';
import { parseCvContact } from './index.js';

function phoneOf(text: string): string | null {
  return parseCvContact(text).phone;
}

describe('parseCvContact – phone', () => {
  it.each([
    ['a bare 10-digit mobile', '0912345678', '0912345678'],
    ['spaces between groups', 'SĐT: 0912 345 678', '0912345678'],
    ['dots between groups', 'Số điện thoại: 0987.654.321', '0987654321'],
    ['dashes between groups', 'Điện thoại: 0389-123-456', '0389123456'],
    ['a +84 prefix', 'Mobile: +84 912 345 678', '0912345678'],
    ['an 84 prefix without plus', 'Phone: 84 912 345 678', '0912345678'],
    ['a (+84) prefix in brackets', 'Tel: (+84) 912-345-678', '0912345678'],
    ['a +84 (0) prefix', 'Hotline: +84 (0) 912 345 678', '0912345678'],
    ['an "ĐT" label', 'ĐT: 0705 123 456', '0705123456'],
    ['a "Di động" label', 'Di động: 0868.111.222', '0868111222'],
    ['a "Zalo" label', 'Zalo: 0356 789 012', '0356789012'],
    ['a "Liên hệ" label', 'Liên hệ: 0935 222 333', '0935222333'],
    ['a phone icon', '📞 0909 888 777', '0909888777'],
    ['the ☎ icon', '☎ 0911.222.333', '0911222333'],
    ['a phone glued to its label', 'SĐT:0977123456', '0977123456'],
    ['fullwidth digits', 'ＳĐＴ: ０９１２３４５６７８', '0912345678'],
    ['zero-width spaces inside the number', 'SĐT: 0912​345​678', '0912345678'],
    ['non-breaking spaces between groups', 'SĐT: 0912 345 678', '0912345678'],
    ['a label on the line above (sidebar layout)', 'Điện thoại\n0965 432 100', '0965432100'],
  ])('reads %s', (_case, text, expected) => {
    expect(phoneOf(text)).toBe(expected);
  });

  it.each([
    ['a month/year date', 'Tháng 03/2021 - nay'],
    ['a year range', '2015 – 2019: Đại học Kinh tế'],
    ['a full birth date', 'Ngày sinh: 12/03/1995'],
    ['a 12-digit CCCD', 'CCCD: 079201012345'],
    ['a 9-digit CMND', 'CMND: 024567891'],
    ['a 10-digit tax code that looks like a mobile', 'MST: 0312345678'],
    ['a bank account that starts like a mobile', 'STK: 0711 000 123 456 - Vietcombank'],
    ['a salary', 'Mức lương mong muốn: 15.000.000 VNĐ'],
    ['a postal code', 'Quận 1, TP. Hồ Chí Minh 700000'],
    ['a company landline', 'Công ty ABC - ĐT: (028) 3812 3456'],
    ['a foreign number', 'Phone: +1 415 555 0100'],
  ])('should not read %s as a phone', (_case, text) => {
    expect(phoneOf(text)).toBeNull();
  });

  it('should prefer the mobile over a company landline listed first', () => {
    const text = 'Công ty ABC - Tel: 028 3812 3456\nĐiện thoại: 0912 345 678';
    expect(phoneOf(text)).toBe('0912345678');
  });

  it('should prefer the labelled number over an earlier unlabelled one', () => {
    const text = 'NGUYỄN VĂN AN\nMã hồ sơ 0388 000 111\nSĐT: 0912 345 678';
    expect(phoneOf(text)).toBe('0912345678');
  });

  it('should read the phone from lines joined by PDF extraction', () => {
    const text = 'Ngày sinh: 12/03/1995 Điện thoại: 0912 345 678 Email: an@gmail.com Địa chỉ: 12 Lê Lợi';
    expect(phoneOf(text)).toBe('0912345678');
  });

  it('should ignore the phone of the person in the reference section', () => {
    const text = 'NGƯỜI THAM CHIẾU\nÔng Lê Văn Bình - Trưởng phòng\nSĐT: 0903 123 456';
    expect(phoneOf(text)).toBeNull();
  });

  it('should keep the candidate phone when a "Người giới thiệu" block lists another', () => {
    const text = 'SĐT: 0912 345 678\nNgười giới thiệu: Bà Trần Thị Cúc - 0904 555 666';
    expect(phoneOf(text)).toBe('0912345678');
  });

  it('should prefer a contact-area phone over one in work history', () => {
    const text = 'KINH NGHIỆM LÀM VIỆC\nCửa hàng Minh Anh - Hotline 0909 000 111\nLIÊN HỆ\n0912 345 678';
    expect(phoneOf(text)).toBe('0912345678');
  });

  describe('numbers that belong to someone else', () => {
    it.each([
      ['a parent named by the label', 'SĐT mẹ: 0968 112 305\nĐiện thoại: 0345 678 120', '0345678120'],
      ['a parent named in brackets', 'Liên hệ gia đình (bố): 0976 330 451\nDi động: 0398 765 012', '0398765012'],
      ['an emergency contact before the own number', 'Liên hệ khẩn cấp: 0941 207 355\nSĐT: 0377 200 913', '0377200913'],
      ['a referee in the same block', 'Xác nhận công tác: anh Dũng 0901 552 730\nTel: 0862 431 096', '0862431096'],
      ['an honorific and a name', 'Liên hệ: cô Mai – 0918 660 274\nZalo: 0704 512 883', '0704512883'],
      ['a boss named as such', 'Quản lý trực tiếp: 0938 214 660\nPhone: 0352 907 118', '0352907118'],
      ['a recruiter hotline', 'Nhà tuyển dụng gọi hotline: 0917 220 485\nSĐT: 0586 431 207', '0586431207'],
      ['own number in the next column', 'Vợ: 0983 120 447   Điện thoại: 0868 240 915', '0868240915'],
      ['a relative named after the number', '0976 511 028 (bố)\nĐT: 0392 815 640', '0392815640'],
    ])('should prefer the candidate over %s', (_case, text, expected) => {
      expect(phoneOf(text)).toBe(expected);
    });

    it.each([
      ['a sister only', 'Chị gái: 0973 118 406'],
      ['an English next of kin', 'Father: 0905 662 341'],
      ['an untoned family label', 'SDT me: 0905 662 341'],
      ['the father with a name', 'Họ tên bố: Lê Văn Tám – ĐT: 0915 208 733'],
      ['a referee named on the line above', 'Anh Hoàng Long (quản lý)\n0902 660 184'],
      ['a family member named on the line above', 'Mẹ: Nguyễn Thị Lành\n0914 773 026'],
      ['a family block', 'QUAN HỆ GIA ĐÌNH\nBố: 0902 118 734'],
      [
        'a staffing agency line and the line below it',
        'Hồ sơ giới thiệu bởi Công ty Nhân lực Đại Việt\nHotline: 0935 880 124',
      ],
    ])('should leave the box empty with only %s', (_case, text) => {
      expect(phoneOf(text)).toBeNull();
    });
  });

  describe('numbers that are not a personal phone', () => {
    it.each([
      ['a company phone in English', 'Company phone: 0937 120 664'],
      ['an office line labelled in Vietnamese', 'ĐT văn phòng: 0937 120 664'],
      ['a school line', 'ĐT trường: 0937 120 664'],
      ['a mobile on an employer line', 'Công ty TNHH Hưng Thịnh – 0937 120 664'],
      ['a clinic with a hotline', 'Phòng khám Đa khoa Sao Việt – Hotline 0937 120 664'],
      ['an unlabelled number in work history', 'KINH NGHIỆM LÀM VIỆC\nNhân viên bán hàng\n0937 120 664'],
      ['a hotline in work history', 'KINH NGHIỆM LÀM VIỆC\nHotline: 0937 120 664'],
      ['a certificate number', 'TOEIC certificate no. 0937 120 664'],
      ['a certificate number in Vietnamese', 'Chứng chỉ hành nghề số 0937 120 664'],
      ['digits in a bare profile link', 'facebook.com/0937120664'],
      ['digits in a link with a path', 'linkedin.com/in/minh-tuan-0937120664'],
      ['a number inside a sentence', 'Doanh thu đạt mã đơn 0937 120 664 trong quý 3'],
      ['a template filler', 'SĐT: 0900 000 000'],
      ['a class code', 'Mã lớp: 0937 120 664'],
      ['a contract number', 'Số hợp đồng: 0937 120 664'],
      ['a sum of money', 'Doanh số 0937 120 664'],
      ['a contact person', 'Người liên hệ: Trần Văn Bách – 0937 120 664'],
      ['an agent', 'Liên hệ người đại diện: 0937 120 664'],
      ['an advice line', 'Liên hệ tư vấn: 0937 120 664'],
      ['a letterhead with the address between', 'Công ty TNHH Đại Phát\nĐịa chỉ: 5 Lê Duẩn\nĐiện thoại: 0937 120 664'],
      ['a boss named on the line above', 'Giám đốc: Trần Văn Bách\nĐT: 0937 120 664'],
      ['a number misread by OCR with other letters', 'SĐT: 09l2 345 67B'],
    ])('should leave the box empty with only %s', (_case, text) => {
      expect(phoneOf(text)).toBeNull();
    });

    it('should keep a freelancer who labels his own mobile "Hotline"', () => {
      expect(phoneOf('Trần Đức Anh\nHotline: 0935 120 664')).toBe('0935120664');
    });

    it('should keep a contact block printed after work history, beside the free-mail address', () => {
      const text = 'KINH NGHIỆM\nThu ngân\n0935 120 664\nnhung.tran91@gmail.com';

      expect(phoneOf(text)).toBe('0935120664');
    });

    it('should prefer the own mobile over a letterhead above the name', () => {
      const text = 'Công ty TNHH Đại Phát\nĐiện thoại: 0937 120 664\nHà Minh Châu\nDi động: 0348 200 716';

      expect(phoneOf(text)).toBe('0348200716');
    });

    it('should keep a number under a headline with the current employer, beside a free-mail address', () => {
      const text = 'Hà Minh Châu\nKế toán tại Công ty Đại Phát\n0348 200 716\nchau.ha@gmail.com';

      expect(phoneOf(text)).toBe('0348200716');
    });

    it('should keep a number after a place with no separator', () => {
      expect(phoneOf('Đà Nẵng, Việt Nam 0348 200 716')).toBe('0348200716');
    });

    it('should keep a number written under the family name Mã', () => {
      expect(phoneOf('Mã Thanh Tú   0348 200 716')).toBe('0348200716');
    });

    it('should keep a number after a column gap on the name line', () => {
      expect(phoneOf('Đoàn Tuấn Kiệt   0935 120 664')).toBe('0935120664');
    });
  });

  describe('ways of writing the own number', () => {
    it.each([
      ['an old 016x number', 'SĐT: 0165 220 7814', '0352207814'],
      ['an old 012x number', 'Điện thoại: 0126.774.1205', '0767741205'],
      ['an old 018x number', 'Mobile: 0188 413 2760', '0584132760'],
      ['an old number with +84', 'Tel: +84 169 840 2257', '0398402257'],
      ['a 0084 prefix', 'Phone: 0084 908 275 116', '0908275116'],
      ['a phone glued to the next label', 'SĐT:0908275116Email:bao.vy@gmail.com', '0908275116'],
      ['capital O for zero on a labelled line', 'SĐT: O9O8 275 116', '0908275116'],
      ['the short label "LH"', 'LH: 0908 275 116', '0908275116'],
      ['the one-letter label "M"', 'M: 0908 275 116', '0908275116'],
      ['a "Viber" label', 'Viber: 0908 275 116', '0908275116'],
      ['a personal label cut by the line end', 'ĐT cơ quan: 0245 120 664; ĐT cá\nnhân: 0908 275 116', '0908275116'],
    ])('reads %s', (_case, text, expected) => {
      expect(phoneOf(text)).toBe(expected);
    });

    it('should not read a label from the column next to the number', () => {
      const text = 'Công ty CP Sao Việt – ĐT: 0937 120 664   0908 275 116';

      expect(phoneOf(text)).toBe('0908275116');
    });
  });
});
