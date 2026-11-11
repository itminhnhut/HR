import { describe, expect, it } from 'vitest';
import { lastName } from './format.js';
import {
  CALLOUT_TITLE_MAX,
  CONTACT_CHANNEL_LABEL,
  DEFAULT_MESSAGE_TEMPLATES,
  fillTemplate,
  fillTemplateSections,
  gmailComposeUrl,
  googleCalendarUrl,
  mailtoUrl,
  outlookComposeUrl,
  PLACEHOLDERS,
  SUBJECT_MAX,
  TEMPLATE_BODY_MAX,
  // The letters to a candidate: the payslip mail to an employee has its own tests (mail/payslip.test.ts).
  APPLICANT_TEMPLATE_KEYS as TEMPLATE_KEYS,
  TEMPLATE_LABEL,
  TEMPLATE_SECTION_MAX,
  type MessageTemplate,
  type TemplateValues,
} from './message-templates.js';
import { contactLogSchema, hrProfileSchema, messageTemplateSchema } from './validation.js';

const values: TemplateValues = {
  candidateName: 'Huy',
  jobTitle: 'Nhân viên Kinh doanh',
  interviewTime: 'Thứ Năm, 30/10 lúc 9:00',
  address: 'Gò Vấp, TP. HCM',
  meetingUrl: '',
  hrName: 'Phòng Nhân sự',
  hrPhone: '0909 000 111',
  company: 'TOP FLOW',
  interviewDate: '06/11/2026',
  interviewer: 'Team Manager',
  duration: '30 phút',
  hrTitle: 'HR Generalist',
  hrAlias: 'Ms. Lee',
};

describe('fillTemplate', () => {
  it('puts every known value in and lists the fields still empty', () => {
    const { text, missing } = fillTemplate('Chào {Tên ứng viên}, link: {Link Meet}. {Công ty}', values);
    expect(text).toBe('Chào Huy, link: {Link Meet}. TOP FLOW');
    expect(missing).toEqual(['{Link Meet}']);
  });

  it('fills a token that appears several times', () => {
    expect(fillTemplate('{Vị trí} / {Vị trí}', values).text).toBe('Nhân viên Kinh doanh / Nhân viên Kinh doanh');
  });

  it('ships default templates short enough for a Gmail link', () => {
    for (const t of Object.values(DEFAULT_MESSAGE_TEMPLATES)) expect(t.body.length).toBeLessThan(TEMPLATE_BODY_MAX);
  });

  it('should fill the new fields of the mail design', () => {
    const { text, missing } = fillTemplate(
      '{Ngày phỏng vấn} {Người trao đổi} {Thời lượng} {Chức danh HR} {Tên gọi khác}',
      values,
    );

    expect(text).toBe('06/11/2026 Team Manager 30 phút HR Generalist Ms. Lee');
    expect(missing).toEqual([]);
  });
});

describe('fillTemplateSections', () => {
  const template: MessageTemplate = {
    key: 'call',
    subject: '{Vị trí}: {Link Meet}',
    body: 'Chào {Tên ứng viên}',
    note: '{Link Meet}',
    calloutTitle: '{Công ty}',
    callout: '{Tên HR}',
    closing: '{SĐT HR} {Ngày phỏng vấn}',
  };

  it('should fill every section and list each missing field once', () => {
    // Arrange
    const noMeet: TemplateValues = { ...values, interviewDate: '' };

    // Act
    const { content, missing } = fillTemplateSections(template, noMeet);

    // Assert
    expect(content).toEqual({
      key: 'call',
      subject: 'Nhân viên Kinh doanh: {Link Meet}',
      body: 'Chào Huy',
      note: '{Link Meet}',
      calloutTitle: 'TOP FLOW',
      callout: 'Phòng Nhân sự',
      closing: '0909 000 111 {Ngày phỏng vấn}',
    });
    expect(missing).toEqual(['{Link Meet}', '{Ngày phỏng vấn}']);
  });

  it('should not change the template it was given', () => {
    const before = { ...template };

    fillTemplateSections(template, values);

    expect(template).toEqual(before);
  });
});

describe('default templates of the mail design', () => {
  const allTexts = (t: MessageTemplate) => [t.subject, t.body, t.note, t.calloutTitle, t.callout, t.closing].join('\n');

  it('should offer five templates, each with a label', () => {
    expect(TEMPLATE_KEYS).toEqual(['interview_onsite', 'interview_online', 'rejection', 'rejection_interview', 'call']);
    expect(TEMPLATE_KEYS.map((k) => DEFAULT_MESSAGE_TEMPLATES[k].key)).toEqual(TEMPLATE_KEYS);
    expect(TEMPLATE_LABEL.rejection).toBe('Từ chối hồ sơ');
    expect(TEMPLATE_LABEL.rejection_interview).toBe('Từ chối sau phỏng vấn');
    expect(CONTACT_CHANNEL_LABEL.copy_html).toBe('Sao chép thư đẹp');
  });

  it('should pass the same limits HR edits are held to', () => {
    for (const t of Object.values(DEFAULT_MESSAGE_TEMPLATES)) {
      const parsed = messageTemplateSchema.parse(t);

      expect({ ...parsed, key: t.key }).toEqual(t);
      expect(t.subject.length).toBeLessThanOrEqual(SUBJECT_MAX);
      expect(t.body.length).toBeLessThanOrEqual(TEMPLATE_BODY_MAX);
      expect(t.calloutTitle.length).toBeLessThanOrEqual(CALLOUT_TITLE_MAX);
      for (const text of [t.note, t.callout, t.closing]) expect(text.length).toBeLessThanOrEqual(TEMPLATE_SECTION_MAX);
    }
  });

  it('should only use tokens HR can fill and start with the greeting', () => {
    const known = PLACEHOLDERS.map((p) => p.token);
    for (const t of TEMPLATE_KEYS.map((key) => DEFAULT_MESSAGE_TEMPLATES[key])) {
      const tokens = allTexts(t).match(/\{[^{}]*\}/g) ?? [];

      for (const token of tokens) expect(known).toContain(token);
      expect(allTexts(t)).not.toContain('{{');
      expect(t.body.startsWith('Thân gửi bạn {Tên ứng viên},\n\n')).toBe(true);
    }
  });

  it('should use the agreed subjects', () => {
    expect(TEMPLATE_KEYS.map((k) => DEFAULT_MESSAGE_TEMPLATES[k].subject)).toEqual([
      '[Top Flow] Thư mời phỏng vấn vị trí {Vị trí}',
      '[Top Flow] Thư mời phỏng vấn online vị trí {Vị trí}',
      '[Top Flow] Phản hồi hồ sơ ứng tuyển vị trí {Vị trí}',
      '[Top Flow] Cảm ơn bạn đã tham gia phỏng vấn vị trí {Vị trí}',
      '[Top Flow] Thư hẹn trao đổi qua điện thoại vị trí {Vị trí}',
    ]);
  });

  it('should not promise to keep a CV, which the 30-day deletion policy forbids', () => {
    const { rejection, rejection_interview: afterInterview } = DEFAULT_MESSAGE_TEMPLATES;

    expect(rejection.calloutTitle).toBe('GIỮ KẾT NỐI CÙNG TOP FLOW');
    expect(rejection.callout).toBe('Nếu bạn muốn công ty giữ hồ sơ cho các vị trí sau, hãy phản hồi thư này.');
    expect(afterInterview.calloutTitle).toBe('CƠ HỘI TRONG TƯƠNG LAI');
    expect(afterInterview.callout).toBe(
      'Nếu bạn muốn công ty giữ hồ sơ cho các vị trí sau, hãy phản hồi thư này. Khi có vị trí phù hợp, chúng tôi rất mong được tiếp tục kết nối và trao đổi cùng bạn.',
    );
    for (const t of Object.values(DEFAULT_MESSAGE_TEMPLATES)) expect(allTexts(t)).not.toContain('nguồn ứng viên');
  });

  it('should name the company site beside the careers site wherever a template links to it', () => {
    for (const t of Object.values(DEFAULT_MESSAGE_TEMPLATES)) {
      for (const line of allTexts(t)
        .split('\n')
        .filter((l) => l.includes('lee-hr.com'))) {
        expect(line).toContain('topflow.vn hoặc www.lee-hr.com');
      }
    }
    expect(DEFAULT_MESSAGE_TEMPLATES.rejection.closing).toContain('www.lee-hr.com');
  });

  it('should thank without assuming the interview was at the office', () => {
    const { body } = DEFAULT_MESSAGE_TEMPLATES.rejection_interview;

    expect(body).toContain('Cảm ơn bạn đã tham gia buổi phỏng vấn vị trí {Vị trí} vào ngày {Ngày phỏng vấn}.');
    expect(body).not.toContain('đến văn phòng');
  });

  it('should thank without praising a candidate the company just turned down', () => {
    const { body } = DEFAULT_MESSAGE_TEMPLATES.rejection_interview;

    expect(body).toContain('Chúng tôi trân trọng thời gian và những chia sẻ của bạn');
    expect(body).not.toContain('chu đáo');
    expect(body).not.toContain('ấn tượng');
  });

  it('should ask for an answer within 24 hours and leave room to move the time, in both invitations', () => {
    for (const key of ['interview_onsite', 'interview_online'] as const) {
      const { callout } = DEFAULT_MESSAGE_TEMPLATES[key];

      expect(callout).toContain('phản hồi email này trong vòng 24 giờ');
      expect(callout).toContain('hoặc báo sớm nếu cần đổi giờ');
    }
  });

  it('should tell an onsite candidate who to call on arrival, and an online one that it is on Google Meet', () => {
    const { interview_onsite: onsite, interview_online: online } = DEFAULT_MESSAGE_TEMPLATES;

    expect(onsite.note).toContain('Khi đến nơi, bạn gọi Ms. {Tên HR} – {SĐT HR}');
    expect(online.body).toContain('online qua Google Meet');
  });

  it('should not promise an interview in the call template, and ask for an answer within 24 hours', () => {
    const { body, callout } = DEFAULT_MESSAGE_TEMPLATES.call;

    expect(body).toContain('vượt qua vòng sàng lọc');
    expect(body).toContain('trước khi sắp xếp buổi phỏng vấn');
    expect(body).not.toContain('phỏng vấn trực tiếp');
    expect(callout).toContain('phản hồi email này trong vòng 24 giờ');
  });

  it('should invite online candidates to a test of mic and camera, with no place to confirm', () => {
    const online = DEFAULT_MESSAGE_TEMPLATES.interview_online;

    expect(online.body).toContain('buổi trao đổi online');
    expect(online.body).not.toContain('văn phòng');
    expect(online.note).toContain('micro và camera');
    expect(online.callout).toContain('xác nhận thời gian');
    expect(online.callout).not.toContain('địa điểm');
  });

  it('should give HR contact the same way in every template', () => {
    for (const t of TEMPLATE_KEYS.map((key) => DEFAULT_MESSAGE_TEMPLATES[key])) {
      expect(`${t.callout} ${t.closing}`).toContain('Ms. {Tên HR} – {SĐT HR}');
    }
  });
});

describe('input of the mail design', () => {
  it('should let an older client save only subject and body', () => {
    expect(messageTemplateSchema.parse({ subject: 's', body: 'b' })).toEqual({
      subject: 's',
      body: 'b',
      note: '',
      calloutTitle: '',
      callout: '',
      closing: '',
    });
  });

  it('should refuse sections over their own limits', () => {
    const base = { subject: 's', body: 'b' };
    const tooLong = 'a'.repeat(TEMPLATE_SECTION_MAX + 1);

    for (const field of ['note', 'callout', 'closing']) {
      expect(messageTemplateSchema.safeParse({ ...base, [field]: tooLong }).success).toBe(false);
    }
    expect(messageTemplateSchema.safeParse({ ...base, calloutTitle: 'a'.repeat(CALLOUT_TITLE_MAX + 1) }).success).toBe(
      false,
    );
  });

  it('should log the new template and channels', () => {
    const log = (channel: string) => contactLogSchema.safeParse({ templateKey: 'rejection_interview', channel });

    expect(log('copy_html').success).toBe(true);
    expect(log('outlook').success).toBe(false);
  });

  it('should keep job title and alias apart from a client that does not send them', () => {
    const parsed = hrProfileSchema.parse({ name: '', phone: '', contactEmail: '' });

    expect(parsed.jobTitle).toBeUndefined();
    expect(parsed.alias).toBeUndefined();
  });
});

describe('links', () => {
  it('should open a new Outlook mail with recipient and subject, spaces kept as spaces', () => {
    const url = outlookComposeUrl('an@gmail.com', 'Mời phỏng vấn');

    expect(url).toContain('subject=M%E1%BB%9Di%20ph%E1%BB%8Fng%20v%E1%BA%A5n');
    expect(new URL(url).searchParams.get('to')).toBe('an@gmail.com');
    expect(new URL(url).searchParams.has('body')).toBe(false);
  });

  it('should still open a new Outlook mail for a candidate with no email', () => {
    expect(new URL(outlookComposeUrl(null, 's')).searchParams.has('to')).toBe(false);
  });

  it('opens Gmail with Vietnamese text intact', () => {
    const url = new URL(gmailComposeUrl('an@gmail.com', 'Mời phỏng vấn', 'Chào Huy\nHẹn gặp'));
    expect(url.searchParams.get('to')).toBe('an@gmail.com');
    expect(url.searchParams.get('su')).toBe('Mời phỏng vấn');
    expect(url.searchParams.get('body')).toBe('Chào Huy\nHẹn gặp');
  });

  it('opens the HR account given as sender when the browser has several', () => {
    expect(new URL(gmailComposeUrl('an@gmail.com', 's', 'b', 'lan.hr@gmail.com')).searchParams.get('authuser')).toBe(
      'lan.hr@gmail.com',
    );
  });

  it('encodes spaces as %20 for mail apps', () => {
    expect(mailtoUrl('an@gmail.com', 'Mời phỏng vấn', 'a b')).toContain('subject=M%E1%BB%9Di%20ph');
    expect(mailtoUrl('an@gmail.com', 'x', 'a b')).toContain('body=a%20b');
  });

  it('makes a one-hour Google Calendar event in UTC, with the candidate as guest when given', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'Phỏng vấn',
        startIso: '2026-10-30T09:00:00+07:00',
        details: 'x',
        location: 'Gò Vấp',
        guest: 'an@gmail.com',
      }),
    );
    expect(url.searchParams.get('dates')).toBe('20261030T020000Z/20261030T030000Z');
    expect(url.searchParams.get('add')).toBe('an@gmail.com');
  });
});

describe('lastName', () => {
  it('greets by the given name and ignores notes in brackets', () => {
    expect(lastName('Nguyễn Hồ Minh Nhựt (thử)')).toBe('Nhựt');
    expect(lastName('Trần Thị Lan')).toBe('Lan');
  });
});
