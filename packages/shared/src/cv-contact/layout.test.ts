import { describe, expect, it } from 'vitest';
import { parseCvContact } from './index.js';

describe('parseCvContact – PDF text-layer quirks', () => {
  it('should glue accented letters that the text layer isolated between spaces', () => {
    const text = 'NGUY Ễ N TH Ị   HUY Ề N TRANG\nGi á o vi ê n Ti ế ng Anh\nĐi ệ n tho ạ i: 0913 572 064';

    expect(parseCvContact(text)).toMatchObject({ fullName: 'Nguyễn Thị Huyền Trang', phone: '0913572064' });
  });

  it('should keep one-letter words in ordinary text', () => {
    expect(parseCvContact('Phạm Văn Ý\nTôi ở Hà Nội').fullName).toBe('Phạm Văn Ý');
  });

  it('should read a name whose words are separated by wide gaps', () => {
    expect(parseCvContact('Huỳnh   Gia   Hân\nChăm sóc khách hàng').fullName).toBe('Huỳnh Gia Hân');
  });

  it('should not mistake the given name "Phương" for a ward in an address', () => {
    expect(parseCvContact('CURRICULUM VITAE\nBùi Phương Linh\nEnglish Teacher').fullName).toBe('Bùi Phương Linh');
  });

  it('should join a letter-spaced compound family name split over two lines', () => {
    const text = 'Â U   D Ư Ơ N G\nB Ả O   T R Â M\nThiết kế đồ hoạ';
    expect(parseCvContact(text).fullName).toBe('Âu Dương Bảo Trâm');
  });

  it('should read a letter-spaced name above a letter-spaced job title', () => {
    const text = 'P H Ạ M   K H Á N H   V Y\nC H Ă M   S Ó C   K H Á C H   H À N G\nLIÊN HỆ';
    expect(parseCvContact(text).fullName).toBe('Phạm Khánh Vy');
  });

  it('should return no name when the only letter-spaced header is a job title', () => {
    const text = 'T H I Ế T   K Ế   Đ Ồ   H O Ạ\nLIÊN HỆ\n☎   0378 516 249\n✉   quynhanh.to@gmail.com';
    expect(parseCvContact(text)).toEqual({ fullName: null, phone: '0378516249', email: 'quynhanh.to@gmail.com' });
  });

  it('should join a three-word first half when the second line has two words', () => {
    expect(parseCvContact('TÔN NỮ HOÀNG\nBẢO CHÂU\nGiáo viên Tiếng Anh').fullName).toBe('Tôn Nữ Hoàng Bảo Châu');
  });

  it('should not read a district from a sidebar address line as the name', () => {
    const text = 'LIEN HE\nDien thoai: 0368 245 917\nDia chi: 203 Hung Vuong, Hai Chau, Da\nNang\nTRAN THI THU THUY';
    expect(parseCvContact(text).fullName).toBe('Tran Thi Thu Thuy');
  });

  it('should rebuild an email that a narrow sidebar wrapped over three lines', () => {
    const text = 'Email: nguyenthithanhhuon\ng.ketoantonghop2024@gmai\nl.com\nĐịa chỉ: Biên Hoà';
    expect(parseCvContact(text).email).toBe('nguyenthithanhhuong.ketoantonghop2024@gmail.com');
  });

  it('should rebuild a phone wrapped onto the next line', () => {
    expect(parseCvContact('Email: an@gmail.com   |   Điện thoại: 0346\n718 520').phone).toBe('0346718520');
  });
});

describe('parseCvContact – whose number or address it is', () => {
  it('should prefer "ĐT cá nhân" over "ĐT công ty" listed first', () => {
    const text = 'TRỊNH HOÀI NAM\nĐT công ty: 0903 888 777   |   ĐT cá nhân: 0968 112 233';
    expect(parseCvContact(text).phone).toBe('0968112233');
  });

  it('should prefer "Email cá nhân" over "Email công việc" listed first', () => {
    const text = 'Email công việc: khanh.ngo@saoviet.vn   |   Email cá nhân: ngodangkhanh95@gmail.com';
    expect(parseCvContact(text).email).toBe('ngodangkhanh95@gmail.com');
  });

  it('should skip the employer hotline and recruiting mailbox in a "Kính gửi" line', () => {
    const text = [
      'Kính gửi: Phòng Nhân sự – Công ty TNHH Phú Gia (Hotline: 0909 111 222 – Email:',
      'tuyendung.phugia@gmail.com)',
      'TRẦN THỊ DIỄM MY',
      'Điện thoại: 0352 774 196   |   Email: diemmy.tran@gmail.com',
    ].join('\n');

    expect(parseCvContact(text)).toEqual({
      fullName: 'Trần Thị Diễm My',
      phone: '0352774196',
      email: 'diemmy.tran@gmail.com',
    });
  });

  it('should return no phone when the only mobile is a former employer hotline in work history', () => {
    const text = 'Đoàn Thị Mỹ Linh\nKINH NGHIỆM LÀM VIỆC\nĐT công ty: Hotline: 0903 111 222';
    expect(parseCvContact(text).phone).toBeNull();
  });

  it('should accept a "Hotline" label in the candidate header when nothing better exists', () => {
    expect(parseCvContact('Lê Văn Tài\nHotline: 0912 000 111').phone).toBe('0912000111');
  });
});
