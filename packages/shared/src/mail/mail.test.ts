import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  fillTemplateSections,
  TEMPLATE_KEYS,
  type TemplateKey,
  type TemplateValues,
} from '../message-templates.js';
import {
  MAIL_COMPANY,
  MAIL_FONT,
  MAIL_LOGO_URLS,
  renderMailHtml as renderWithFont,
  renderMailText,
  vietnamInterviewParts,
} from './index.js';
import type { MailContent, MailDetails } from './types.js';

/** The font is on every tag (tested below): the other tests read better without it. */
const renderMailHtml = (...args: Parameters<typeof renderWithFont>) =>
  renderWithFont(...args).replaceAll(MAIL_FONT, '');

/** 09:30 on Thursday 5 Nov 2026 in Vietnam. */
const INTERVIEW_ISO = '2026-11-05T02:30:00.000Z';

const details: MailDetails = {
  interviewIso: INTERVIEW_ISO,
  address: MAIL_COMPANY.officeAddress,
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  interviewer: MAIL_COMPANY.defaultInterviewer,
  duration: MAIL_COMPANY.defaultDuration,
  candidateName: 'Phạm Quốc Huy',
  jobTitle: 'Nhân viên Kinh doanh',
  hrName: 'Thuận Lê',
  hrPhone: '0986 605 214',
  hrTitle: 'HR Generalist',
  hrAlias: 'Ms. Lee',
  hrEmail: MAIL_COMPANY.hrEmail,
};

const values: TemplateValues = {
  candidateName: details.candidateName,
  jobTitle: details.jobTitle,
  interviewTime: '09:30, 05/11/2026',
  address: details.address,
  meetingUrl: details.meetingUrl,
  hrName: details.hrName,
  hrPhone: details.hrPhone,
  company: MAIL_COMPANY.name,
  interviewDate: '05/11/2026',
  interviewer: details.interviewer,
  duration: details.duration,
  hrTitle: details.hrTitle,
  hrAlias: details.hrAlias,
};

const filled = (key: TemplateKey): MailContent => fillTemplateSections(DEFAULT_MESSAGE_TEMPLATES[key], values).content;

const content = (key: TemplateKey, texts: Partial<MailContent> = {}): MailContent => ({ ...filled(key), ...texts });

describe('vietnamInterviewParts', () => {
  it('should give the parts of the date tile', () => {
    expect(vietnamInterviewParts('2026-11-05T02:30:00.000Z')).toEqual({
      weekday: 'THỨ NĂM',
      day: '05',
      monthYear: '11/2026',
      time: '09:30',
      date: '05/11/2026',
    });
  });

  it('should use the Vietnam date when UTC is still on the day before', () => {
    // Saturday evening in UTC is already Sunday morning in Vietnam.
    expect(vietnamInterviewParts('2026-10-31T23:30:00.000Z')).toEqual({
      weekday: 'CHỦ NHẬT',
      day: '01',
      monthYear: '11/2026',
      time: '06:30',
      date: '01/11/2026',
    });
  });

  it('should read midnight as 00:00 across a year boundary', () => {
    expect(vietnamInterviewParts('2026-12-31T17:00:00.000Z')).toMatchObject({
      weekday: 'THỨ SÁU',
      monthYear: '01/2027',
      time: '00:00',
      date: '01/01/2027',
    });
  });

  it('should accept a time with its own offset', () => {
    expect(vietnamInterviewParts('2026-11-05T09:30:00+07:00').time).toBe('09:30');
  });
});

describe('renderMailHtml', () => {
  it.each([
    ['interview_onsite', 'THƯ MỜI PHỎNG VẤN', 'INTERVIEW INVITATION'],
    ['interview_online', 'THƯ MỜI PHỎNG VẤN', 'INTERVIEW INVITATION'],
    ['rejection', 'THƯ CẢM ƠN ỨNG TUYỂN', 'THANK YOU FOR APPLYING'],
    ['rejection_interview', 'THƯ CẢM ƠN', 'THANK YOU FOR YOUR TIME'],
    ['call', 'THƯ HẸN TRAO ĐỔI', 'PHONE SCREENING'],
  ] as const)('should render %s with its fixed title and the common frame', (key, title, subtitle) => {
    // Act
    const html = renderMailHtml(filled(key), details);

    // Assert
    expect(html).toContain(`>${title}</div>`);
    expect(html).toContain(subtitle);
    expect(html).toContain('Vị trí: <b style="color:#C8102E;">Nhân viên Kinh doanh</b>');
    expect(html).toContain('Thân mến,');
    expect(html).not.toContain('BEST REGARDS');
    expect(html).toContain('Top Solution, Top Choice');
    expect(html).toMatch(/Hotline: <a [^>]*>0937 705 533<\/a>/);
    expect(html).toContain('#C8102E');
    expect(html).toContain('mso-hide:all');
    expect(html).toContain('@media only screen');
  });

  it('should have no embedded image and no leftover double braces in any template', () => {
    for (const key of TEMPLATE_KEYS) {
      const html = renderMailHtml(filled(key), details);

      expect(html).not.toContain('data:image');
      expect(html).not.toContain('base64');
      expect(html).not.toContain('{{');
      expect(html).not.toMatch(/\{[^{}\s:;]+[^{}:;]*\}/);
    }
  });

  it('should keep the order of the design in an interview mail', () => {
    // Arrange
    const html = renderMailHtml(filled('interview_onsite'), details);
    const order = [
      'top-flow-logo.png',
      'THƯ MỜI PHỎNG VẤN</div>',
      'Thân gửi bạn',
      'THÔNG TIN BUỔI PHỎNG VẤN',
      'Buổi phỏng vấn là cơ hội',
      '<b style="color:#C8102E;">XÁC NHẬN THAM DỰ</b>',
      'letter-spacing:1px;">XÁC NHẬN THAM DỰ</a>',
      'Chân thành cảm ơn',
      'Thân mến,',
      'Hotline:',
    ];

    // Act
    const positions = order.map((text) => html.indexOf(text));

    // Assert
    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('should show the Vietnam date and time in the date tile', () => {
    const html = renderMailHtml(filled('interview_onsite'), { ...details, interviewIso: '2026-10-31T23:30:00.000Z' });

    expect(html).toContain('>CHỦ NHẬT</div>');
    expect(html).toContain('>01</div>');
    expect(html).toContain('>THÁNG 11/2026</div>');
    expect(html).toContain('>06:30</div>');
  });

  it('should show the place, map, interviewer, duration and mode of an onsite interview', () => {
    const html = renderMailHtml(filled('interview_onsite'), details);

    expect(html).toContain('ĐỊA ĐIỂM');
    expect(html).toContain('Văn phòng Công ty Top Flow');
    expect(html).toContain(MAIL_COMPANY.officeAddress);
    expect(html).toContain(`href="${MAIL_COMPANY.mapUrl.replace('&', '&amp;')}"`);
    expect(html).toContain('XEM BẢN ĐỒ');
    expect(html).toContain('Quản lý bộ phận (Team Manager)');
    expect(html).toContain('30 – 45 phút');
    expect(html).toContain('Trực tiếp');
    expect(html).not.toContain('LINK THAM GIA');
  });

  it('should point the map at the address when HR changes it for one mail', () => {
    const html = renderMailHtml(filled('interview_onsite'), { ...details, address: '1 Lê Lợi, Quận 1' });

    expect(html).toContain('1 Lê Lợi, Quận 1');
    expect(html).toContain('query=1%20L%C3%AA%20L%E1%BB%A3i%2C%20Qu%E1%BA%ADn%201');
    expect(html).not.toContain(MAIL_COMPANY.officeAddress);
  });

  it('should replace the place with a clickable link in an online interview', () => {
    const html = renderMailHtml(filled('interview_online'), details);

    expect(html).toContain('LINK THAM GIA');
    expect(html).toContain('href="https://meet.google.com/abc-defg-hij"');
    expect(html).toContain('>Online</div>');
    expect(html).not.toContain('ĐỊA ĐIỂM');
    expect(html).not.toContain('XEM BẢN ĐỒ');
  });

  it('should leave out a meeting link that is not http or https', () => {
    for (const meetingUrl of ['javascript:alert(1)', 'data:text/html,x', 'meet.google.com/abc', '']) {
      const html = renderMailHtml(filled('interview_online'), { ...details, meetingUrl });

      expect(html).not.toContain('LINK THAM GIA');
      if (meetingUrl) expect(html).not.toContain(meetingUrl);
    }
  });

  it('should show "Chưa có lịch" rather than crash without an interview time', () => {
    for (const interviewIso of [null, '', 'khong-phai-ngay']) {
      const html = renderMailHtml(filled('interview_onsite'), { ...details, interviewIso });

      expect(html).toContain('Chưa có lịch');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('NaN');
    }
  });

  it('should have no details card or confirm button outside interview mails', () => {
    for (const key of ['rejection', 'rejection_interview', 'call'] as const) {
      const html = renderMailHtml(filled(key), details);

      expect(html).not.toContain('THÔNG TIN BUỔI PHỎNG VẤN');
      expect(html).not.toContain('>XÁC NHẬN THAM DỰ</a>');
    }
  });

  it('should encode the confirm link subject, Vietnamese and all', () => {
    const html = renderMailHtml(filled('interview_onsite'), details);
    const subject = encodeURIComponent('Xác nhận tham dự phỏng vấn - Phạm Quốc Huy');

    expect(html).toContain(`href="mailto:hr@topflow.vn?subject=${subject}"`);
    expect(subject).toContain('X%C3%A1c%20nh%E1%BA%ADn');
  });

  it('should keep a hostile name from breaking out of the confirm link', () => {
    // Arrange
    const candidateName = `"><script>alert(1)</script>'&x=1`;

    // Act
    const html = renderMailHtml(filled('interview_onsite'), { ...details, candidateName });

    // Assert
    expect(html).not.toContain('<script');
    expect(html).toMatch(/href="mailto:hr@topflow\.vn\?subject=[^"<>]*&#39;%26x%3D1"/);
  });

  it('should escape hostile values everywhere they are shown', () => {
    // Arrange
    const attack = `<script>alert('x')</script>&"`;
    const hostile: MailDetails = {
      ...details,
      candidateName: attack,
      jobTitle: attack,
      address: attack,
      meetingUrl: `https://x.vn/"><script>`,
      interviewer: attack,
      duration: attack,
      hrName: attack,
      hrPhone: attack,
      hrTitle: attack,
      hrAlias: attack,
      hrEmail: attack,
    };
    const texts = { body: attack, note: attack, calloutTitle: attack, callout: attack, closing: attack };

    for (const key of TEMPLATE_KEYS) {
      // Act
      const html = renderMailHtml(content(key, texts), hostile);

      // Assert
      expect(html).not.toMatch(/<script/i);
      expect(html).toContain('&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;&quot;');
      if (key === 'interview_online') expect(html).toContain('href="https://x.vn/&quot;&gt;&lt;script&gt;"');
    }
  });

  it('should escape the logo urls it is given', () => {
    const html = renderMailHtml(filled('call'), details, { logos: { logo: 'cid:"logo', mark: 'cid:mark' } });

    expect(html).toContain('src="cid:&quot;logo"');
    expect(html).toContain('src="cid:mark"');
    expect(html).not.toContain(MAIL_LOGO_URLS.logo);
  });

  it('should use the hosted logos by default and cid images when asked', () => {
    expect(renderMailHtml(filled('call'), details)).toContain(`src="${MAIL_LOGO_URLS.logo}"`);
    expect(renderMailHtml(filled('call'), details)).toContain(`src="${MAIL_LOGO_URLS.mark}"`);

    const html = renderMailHtml(filled('call'), details, { logos: { logo: 'cid:logo', mark: 'cid:mark' } });

    expect(html).toContain('src="cid:logo"');
    expect(html).toContain('src="cid:mark"');
    expect(html).not.toContain('lee-hr.com/images');
  });

  it('should turn a blank line into a paragraph and a single newline into a line break', () => {
    const html = renderMailHtml(content('rejection', { body: 'Một\nHai\n\nBa' }), details);

    expect(html).toContain('<p style="margin:0 0 14px;">Một<br>Hai</p>');
    expect(html).toContain('<p style="margin:0;">Ba</p>');
  });

  it('should accept Windows line endings', () => {
    const html = renderMailHtml(content('call', { body: 'Một\r\n\r\nHai' }), details);

    expect(html).toContain('>Một</p>');
    expect(html).toContain('>Hai</p>');
  });

  it('should bold the candidate, position, interview date and HR contact as the designs do', () => {
    // Act
    const html = renderMailHtml(filled('rejection_interview'), details);

    // Assert
    expect(html).toContain('Thân gửi bạn <b>Phạm Quốc Huy</b>,');
    expect(html).toContain('vị trí <b>Nhân viên Kinh doanh</b> vào ngày <b>05/11/2026</b>.');
    expect(html).toContain('<b>Ms. Thuận Lê – 0986 605 214</b> (Zalo)');
    expect(html).toContain('chưa thật sự phù hợp');
    expect(html).not.toContain('<b>chưa thật sự phù hợp</b>');
  });

  it('should bold a name holding special characters without breaking the escaping', () => {
    const html = renderMailHtml(content('call', { body: 'Chào A & B <C>, hẹn gặp.' }), {
      ...details,
      candidateName: 'A & B <C>',
    });

    expect(html).toContain('Chào <b>A &amp; B &lt;C&gt;</b>, hẹn gặp.');
  });

  it('should not bold a value inside an entity or inside another word', () => {
    // Arrange
    const candidateName = 'amp';

    // Act
    const html = renderMailHtml(content('call', { body: 'A & B, ampere, amp.' }), { ...details, candidateName });

    // Assert
    expect(html).toContain('A &amp; B, ampere, <b>amp</b>.');
  });

  it('should link only the exact site names, to the fixed addresses', () => {
    // Act
    const html = renderMailHtml(
      content('call', {
        body: 'Xem www.lee-hr.com hoặc topflow.vn. Mail hr@topflow.vn, khác xtopflow.vn, evil.topflow.vn, http://evil.vn',
      }),
      details,
    );

    // Assert
    expect(html).toContain(
      'Xem <a href="https://www.lee-hr.com" style="color:#C8102E;font-weight:bold;text-decoration:none;">www.lee-hr.com</a>',
    );
    expect(html).toContain(
      'hoặc <a href="https://topflow.vn" style="color:#C8102E;font-weight:bold;text-decoration:none;">topflow.vn</a>.',
    );
    expect(html).toContain('Mail hr@topflow.vn, khác xtopflow.vn, evil.topflow.vn, http://evil.vn');
    expect(html).not.toContain('href="http://evil.vn"');
  });

  it('should show HTML typed by HR as text, never as markup', () => {
    const html = renderMailHtml(content('call', { closing: '<a href="https://evil.vn">bấm</a>' }), details);

    expect(html).not.toContain('<a href="https://evil.vn"');
    expect(html).toContain('&lt;a href=&quot;https://evil.vn&quot;&gt;bấm&lt;/a&gt;');
  });

  it('should show the signature with alias, uppercase title and a +84 phone link', () => {
    const html = renderMailHtml(filled('rejection'), details);

    expect(html).toContain('>Thuận Lê</b> <span');
    expect(html).toContain('(Ms. Lee)</span>');
    expect(html).toContain('>HR GENERALIST</div>');
    expect(html).toContain('href="tel:+84986605214"');
    expect(html).toContain('>+84 986 605 214</a>');
    expect(html).toContain('href="mailto:hr@topflow.vn"');
    expect(html).toContain('href="https://topflow.vn"');
  });

  it('should leave out what an HR account has not filled in', () => {
    const html = renderMailHtml(filled('rejection'), { ...details, hrAlias: '', hrTitle: '', hrPhone: '' });

    expect(html).not.toContain('font-size:14px;">(');
    expect(html).not.toContain('tel:+84986605214');
    expect(html).not.toContain('>M</b>');
  });

  it('should leave out empty sections instead of empty boxes', () => {
    const html = renderMailHtml(content('call', { calloutTitle: '', callout: '', closing: '', note: '' }), details);

    expect(html).not.toContain('border-left:4px solid');
    expect(html).toContain('Thân mến,');
  });

  it('should keep a token with no value visible and harmless', () => {
    const { content: withGap, missing } = fillTemplateSections(DEFAULT_MESSAGE_TEMPLATES.rejection_interview, {
      ...values,
      interviewDate: '',
    });

    const html = renderMailHtml(withGap, { ...details, interviewIso: null });

    expect(missing).toEqual(['{Ngày phỏng vấn}']);
    expect(html).toContain('vào ngày {Ngày phỏng vấn}.');
  });

  it('should put a one-line summary in the inbox preview', () => {
    expect(renderMailHtml(filled('interview_onsite'), details)).toContain(
      'Top Flow mời bạn tham gia phỏng vấn vị trí Nhân viên Kinh doanh lúc 09:30, THỨ NĂM 05/11/2026.',
    );
    expect(renderMailHtml(filled('rejection'), details)).toContain(
      'Cảm ơn bạn đã ứng tuyển vị trí Nhân viên Kinh doanh tại Top Flow.',
    );
  });
});

describe('renderMailText', () => {
  it.each(TEMPLATE_KEYS)('should contain every section of %s, with no markup', (key) => {
    // Arrange
    const mail = filled(key);

    // Act
    const text = renderMailText(mail, details);

    // Assert
    for (const section of [mail.body, mail.note, mail.calloutTitle, ...mail.callout.split('\n\n'), mail.closing]) {
      expect(text).toContain(section);
    }
    expect(text).toContain('Thân mến,');
    expect(text).toContain('Thuận Lê (Ms. Lee)');
    expect(text).toContain('HR GENERALIST');
    expect(text).toContain('+84 986 605 214');
    expect(text).toContain('hr@topflow.vn');
    expect(text).not.toMatch(/<[a-z/]/i);
    expect(text).not.toContain('{{');
  });

  it('should list the details of an onsite interview', () => {
    const text = renderMailText(filled('interview_onsite'), details);

    expect(text).toContain('- Thời gian: 09:30, Thứ Năm, 05/11/2026');
    expect(text).toContain(`- Địa điểm: Văn phòng Công ty Top Flow, ${MAIL_COMPANY.officeAddress}`);
    expect(text).toContain('- Người trao đổi: Quản lý bộ phận (Team Manager)');
    expect(text).toContain('- Thời lượng: 30 – 45 phút');
    expect(text).toContain('- Hình thức: Trực tiếp');
  });

  it('should list the link instead of the place of an online interview', () => {
    const text = renderMailText(filled('interview_online'), details);

    expect(text).toContain('- Link tham gia: https://meet.google.com/abc-defg-hij');
    expect(text).toContain('- Hình thức: Online');
    expect(text).not.toContain('Địa điểm');
  });

  it('should leave out a link that is not http or https', () => {
    const text = renderMailText(filled('interview_online'), { ...details, meetingUrl: 'javascript:alert(1)' });

    expect(text).not.toContain('javascript:');
  });

  it('should say there is no time yet rather than crash', () => {
    expect(renderMailText(filled('interview_onsite'), { ...details, interviewIso: null })).toContain(
      '- Thời gian: Chưa có lịch',
    );
  });

  it('should have no details list outside interview mails', () => {
    expect(renderMailText(filled('rejection'), details)).not.toContain('THÔNG TIN BUỔI PHỎNG VẤN');
  });

  it('should leave Vietnamese and special characters as typed', () => {
    const text = renderMailText(content('call', { body: 'Chào A & B <C>' }), details);

    expect(text).toContain('Chào A & B <C>');
  });
});

describe('add to calendar link', () => {
  const calendarHref = (html: string) => {
    const found = /<a href="([^"]+)"[^>]*>THÊM VÀO LỊCH<\/a>/.exec(html)?.[1] ?? '';
    return new URL(found.replaceAll('&amp;', '&'));
  };

  it('should open the interview slot of the invitation, ending when the longest duration ends', () => {
    // Act
    const url = calendarHref(renderMailHtml(filled('interview_onsite'), details));

    // Assert
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261105T023000Z/20261105T031500Z');
    expect(url.searchParams.get('text')).toBe('Phỏng vấn vị trí Nhân viên Kinh doanh – Top Flow');
    expect(url.searchParams.get('location')).toContain(MAIL_COMPANY.officeAddress);
    expect(url.searchParams.get('add')).toBeNull();
  });

  it('should put the meeting link as the place of an online interview', () => {
    const url = calendarHref(renderMailHtml(filled('interview_online'), details));

    expect(url.searchParams.get('location')).toBe(details.meetingUrl);
  });

  it('should fall back to one hour when the duration holds no number', () => {
    const url = calendarHref(renderMailHtml(filled('interview_onsite'), { ...details, duration: 'khoảng nửa buổi' }));

    expect(url.searchParams.get('dates')).toBe('20261105T023000Z/20261105T033000Z');
  });

  it('should read a duration given in hours', () => {
    const url = calendarHref(renderMailHtml(filled('interview_onsite'), { ...details, duration: '1,5 tiếng' }));

    expect(url.searchParams.get('dates')).toBe('20261105T023000Z/20261105T040000Z');
  });

  it('should offer no calendar link before there is an interview time', () => {
    const noTime = { ...details, interviewIso: null };

    expect(renderMailHtml(filled('interview_onsite'), noTime)).not.toContain('THÊM VÀO LỊCH');
    expect(renderMailText(filled('interview_onsite'), noTime)).not.toContain('Thêm vào lịch');
  });

  it('should give the same link in the plain text of an invitation', () => {
    expect(renderMailText(filled('interview_online'), details)).toContain(
      '- Thêm vào lịch: https://calendar.google.com/calendar/render?',
    );
  });

  it('should leave the calendar link out of the letters that are not invitations', () => {
    expect(renderMailHtml(filled('rejection'), details)).not.toContain('THÊM VÀO LỊCH');
    expect(renderMailText(filled('call'), details)).not.toContain('Thêm vào lịch');
  });
});

describe('footer of every letter', () => {
  it('should link the careers site and the data policy, and say why the candidate got the letter', () => {
    for (const key of TEMPLATE_KEYS) {
      // Act
      const html = renderMailHtml(filled(key), details);
      const text = renderMailText(filled(key), details);

      // Assert
      expect(html).toContain(`<a href="${MAIL_COMPANY.careersUrl}"`);
      expect(html).toContain(`<a href="${MAIL_COMPANY.privacyUrl}"`);
      expect(html).toContain('Bạn nhận thư này vì đã ứng tuyển tại Top Flow.');
      expect(html).toMatch(/Website: <a [^>]*>topflow\.vn<\/a> &nbsp;\|&nbsp; Tuyển dụng Top Flow: <a/);
      expect(text).toContain(`Tuyển dụng Top Flow: ${MAIL_COMPANY.careersSite}`);
      expect(text).toContain(MAIL_COMPANY.privacyPage);
    }
  });
});

describe('the phone call letter', () => {
  it('should show who calls from which number, the topics, duration and mode', () => {
    // Act
    const html = renderMailHtml(filled('call'), details);

    // Assert
    expect(html).toContain('THÔNG TIN CUỘC GỌI');
    expect(html).toContain('<b>Ms. Thuận Lê</b> – HR Top Flow');
    expect(html).toContain('HR sẽ gọi từ số: <b style="color:#C8102E;">0986 605 214</b>');
    expect(html).toContain('thời gian có thể nhận việc');
    expect(html).toContain('Điện thoại');
    expect(html).not.toContain('THÔNG TIN BUỔI PHỎNG VẤN');
  });

  it('should default to a short call, and take a duration HR typed', () => {
    expect(renderMailHtml(filled('call'), { ...details, duration: '' })).toContain('10 – 15 phút');
    expect(renderMailHtml(filled('call'), { ...details, duration: '20 phút' })).toContain('20 phút');
  });

  it('should leave the number out, and call nobody "Ms. Top Flow", before the HR account is filled in', () => {
    const html = renderMailHtml(filled('call'), { ...details, hrName: '', hrPhone: '' });

    expect(html).not.toContain('HR sẽ gọi từ số');
    expect(html).not.toContain('Ms. Top Flow');
  });

  it('should show the example times between the request and the Zalo line', () => {
    const html = renderMailHtml(filled('call'), details);
    const order = ['với các khung giờ', 'Thứ Tư: 9:00 – 11:00', 'Thứ Năm: sau 14:00', 'nhắn Zalo cho'];

    const positions = order.map((text) => html.indexOf(text));

    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('should send the answer button to the HR mailbox with its own title', () => {
    const html = renderMailHtml(filled('call'), details);
    const title = encodeURIComponent('Thời gian trao đổi qua điện thoại - Phạm Quốc Huy');

    expect(html).toContain(`mailto:hr@topflow.vn?subject=${title}`);
    expect(html).toContain('>GỬI THỜI GIAN THUẬN TIỆN</a>');
    expect(html).not.toContain('XÁC NHẬN THAM DỰ');
  });

  it('should keep the box of details and the example times in the plain text', () => {
    const text = renderMailText(filled('call'), details);

    expect(text).toContain('THÔNG TIN CUỘC GỌI');
    expect(text).toContain('- HR sẽ gọi từ số: 0986 605 214');
    expect(text).toContain('Ví dụ:\n- Thứ Tư: 9:00 – 11:00');
  });

  it('should not show the example box when HR empties the callout text', () => {
    expect(renderMailHtml(content('call', { callout: '' }), details)).not.toContain('Ví dụ:');
    expect(renderMailText(content('call', { callout: '' }), details)).not.toContain('Ví dụ:');
  });

  it('should bold the screening result', () => {
    expect(renderMailHtml(filled('call'), details)).toContain('<b>vượt qua vòng sàng lọc</b>');
  });
});

describe('the careers site in a letter', () => {
  it('should link both sites in the rejection letter', () => {
    const html = renderMailHtml(filled('rejection'), details);

    expect(html).toMatch(
      /tại <a href="https:\/\/topflow\.vn"[^>]*>topflow\.vn<\/a> hoặc <a href="https:\/\/www\.lee-hr\.com"/,
    );
  });

  it('should never show the careers site in a line of text without Top Flow', () => {
    for (const key of TEMPLATE_KEYS) {
      // Act
      const lines = renderMailText(filled(key), details).split('\n');
      const mentions = lines.filter((line) => line.includes('lee-hr.com'));

      // Assert
      expect(mentions.length).toBeGreaterThan(0);
      for (const line of mentions) expect(line).toMatch(/Top Flow|topflow\.vn/);
    }
  });
});

describe('a candidate name that is also a property of every object', () => {
  it.each(['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'])(
    'should render the mail for a candidate called %s, as bold text and not a link',
    (name) => {
      // Arrange
      const mail = content('call', { body: `Thân gửi bạn ${name},` });

      // Act
      const html = renderMailHtml(mail, { ...details, candidateName: name });

      // Assert
      expect(html).toContain(`Thân gửi bạn <b>${name}</b>,`);
    },
  );
});

describe('a mail that survives being copied and pasted', () => {
  const textTags = (html: string) => [...html.matchAll(/<(?:td|div|p|a|span)\b[^>]*>|<b\s[^>]*>/g)].map((m) => m[0]);

  it.each(TEMPLATE_KEYS)(
    'should carry the font on every text element of %s, as the clipboard drops the body',
    (key) => {
      // Act
      const tags = textTags(renderWithFont(filled(key), details));

      // Assert
      expect(tags.length).toBeGreaterThan(10);
      for (const tag of tags) expect(tag).toContain('Times New Roman');
    },
  );

  it.each(TEMPLATE_KEYS)('should keep each contact letter on the line of its value in %s', (key) => {
    // Act
    const html = renderMailHtml(filled(key), details);

    // Assert
    expect(html).not.toContain('inline-block;width:16px');
    expect(html).toMatch(/>M<\/b>&nbsp;&nbsp;<a /);
  });

  it('should leave the alias out of the bold of the name', () => {
    const html = renderMailHtml(filled('rejection'), details);

    expect(html).toMatch(/<b[^>]*>Thuận Lê<\/b> <span[^>]*>\(Ms\. Lee\)<\/span>/);
  });

  it('should centre the position box by attribute, which a paste keeps', () => {
    expect(renderMailHtml(filled('rejection'), details)).toMatch(
      /<table role="presentation" align="center"[^>]*margin:16px auto 0;/,
    );
  });

  it('should give the callout and footer backgrounds as attributes too', () => {
    const html = renderMailHtml(filled('rejection'), details);

    expect(html).toContain('bgcolor="#fdf3f4"');
    expect(html).toMatch(/<td[^>]*bgcolor="#C8102E"[^>]*>\s*<b/);
  });

  it('should make the footer email and website real links, so a mail app does not paint them blue', () => {
    const html = renderMailHtml(filled('rejection'), details);

    expect(html).toMatch(/Email: <a href="mailto:hr@topflow\.vn"/);
    expect(html).toMatch(/Website: <a href="https:\/\/topflow\.vn"/);
  });
});

describe('the heading of a details box', () => {
  it.each(['interview_onsite', 'interview_online', 'call'] as const)('should be readable at 14px in %s', (key) => {
    // Act
    const html = renderMailHtml(filled(key), details);

    // Assert
    expect(html).toMatch(
      /<div style="font-size:14px;font-weight:bold;[^"]*">THÔNG TIN (BUỔI PHỎNG VẤN|CUỘC GỌI)<\/div>/,
    );
  });
});
