import { describe, expect, it } from 'vitest';
import { lastName } from './format.js';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  fillTemplate,
  gmailComposeUrl,
  googleCalendarUrl,
  mailtoUrl,
  TEMPLATE_BODY_MAX,
  type TemplateValues,
} from './message-templates.js';

const values: TemplateValues = {
  candidateName: 'Huy',
  jobTitle: 'Nhân viên Kinh doanh',
  interviewTime: 'Thứ Năm, 30/10 lúc 9:00',
  address: 'Gò Vấp, TP. HCM',
  meetingUrl: '',
  hrName: 'Phòng Nhân sự',
  hrPhone: '0909 000 111',
  company: 'TOP FLOW',
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
});

describe('links', () => {
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
