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
});
