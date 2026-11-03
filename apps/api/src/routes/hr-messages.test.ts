import {
  DEFAULT_MESSAGE_TEMPLATES,
  type ApplicationDetailDto,
  type HrMe,
  type HrUserDto,
  type MessageTemplatesResponse,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, contactLog } from '../db/schema.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });

async function insertApplication() {
  const job = await insertJob(t);
  const [app] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: 'Phạm Quốc Huy',
      phone: '0797586611',
      email: 'huy@gmail.com',
      consentAt: t.clock.now,
      policyVersion: 'v',
    })
    .returning();
  return app;
}

describe('message templates', () => {
  it('starts from the built-in wording', async () => {
    const body = await json<MessageTemplatesResponse>(await hr('GET', '/message-templates'));
    expect(body.templates.map((x) => x.key)).toEqual([
      'interview_onsite',
      'interview_online',
      'rejection',
      'rejection_interview',
      'call',
    ]);
    expect(body.templates[0]).toEqual(DEFAULT_MESSAGE_TEMPLATES.interview_onsite);
    expect(body.customized).toEqual([]);
  });

  it('saves HR wording and goes back to the built-in text on reset', async () => {
    const saved = await json<MessageTemplatesResponse>(
      await hr('PUT', '/message-templates/rejection', { subject: ' Kết quả ', body: 'Chào {Tên ứng viên}' }),
    );
    expect(saved.templates.find((x) => x.key === 'rejection')).toEqual({
      key: 'rejection',
      subject: 'Kết quả',
      body: 'Chào {Tên ứng viên}',
      note: '',
      calloutTitle: '',
      callout: '',
      closing: '',
    });
    expect(saved.customized).toEqual(['rejection']);

    const reset = await json<MessageTemplatesResponse>(await hr('DELETE', '/message-templates/rejection'));
    expect(reset.templates.find((x) => x.key === 'rejection')).toEqual(DEFAULT_MESSAGE_TEMPLATES.rejection);
  });

  it('refuses an empty subject, a body too long for a Gmail link, and unknown templates', async () => {
    expect((await hr('PUT', '/message-templates/call', { subject: '', body: 'x' })).status).toBe(422);
    expect((await hr('PUT', '/message-templates/call', { subject: 'x', body: 'a'.repeat(1501) })).status).toBe(422);
    expect((await hr('PUT', '/message-templates/khac', { subject: 'x', body: 'y' })).status).toBe(404);
  });

  it('should save and return every section of a template', async () => {
    // Arrange
    const sections = {
      subject: 'Tiêu đề',
      body: 'Mở đầu',
      note: 'Ghi chú',
      calloutTitle: 'KHỐI NỔI BẬT',
      callout: 'Nội dung nổi bật',
      closing: 'Phần kết',
    };

    // Act
    const saved = await json<MessageTemplatesResponse>(
      await hr('PUT', '/message-templates/rejection_interview', sections),
    );

    // Assert
    expect(saved.templates.find((x) => x.key === 'rejection_interview')).toEqual({
      key: 'rejection_interview',
      ...sections,
    });
    expect(saved.customized).toEqual(['rejection_interview']);
    const listed = await json<MessageTemplatesResponse>(await hr('GET', '/message-templates'));
    expect(listed.templates.find((x) => x.key === 'rejection_interview')).toMatchObject(sections);
  });

  it('should count a template as customized when only one section differs from the built-in text', async () => {
    // Arrange
    const builtIn = DEFAULT_MESSAGE_TEMPLATES.interview_online;

    // Act
    const saved = await json<MessageTemplatesResponse>(
      await hr('PUT', '/message-templates/interview_online', { ...builtIn, closing: 'Kết khác' }),
    );

    // Assert
    expect(saved.customized).toEqual(['interview_online']);
  });

  it('should not count a template as customized when it was saved with the built-in text', async () => {
    // Act
    const saved = await json<MessageTemplatesResponse>(
      await hr('PUT', '/message-templates/call', DEFAULT_MESSAGE_TEMPLATES.call),
    );

    // Assert
    expect(saved.customized).toEqual([]);
    expect(saved.templates.find((x) => x.key === 'call')).toEqual(DEFAULT_MESSAGE_TEMPLATES.call);
  });

  it('should refuse sections over their limits', async () => {
    const base = { subject: 'x', body: 'y' };

    expect((await hr('PUT', '/message-templates/call', { ...base, note: 'a'.repeat(1001) })).status).toBe(422);
    expect((await hr('PUT', '/message-templates/call', { ...base, calloutTitle: 'a'.repeat(81) })).status).toBe(422);
  });

  it('needs an HR session', async () => {
    expect((await t.send('GET', '/api/hr/message-templates')).status).toBe(401);
  });
});

describe('sender details', () => {
  it('saves the name, phone and real mailbox put into messages', async () => {
    const me = await json<HrMe>(
      await hr('PATCH', '/me', { name: 'Chị Lan', phone: '0909 000 111', contactEmail: 'Lan.HR@Gmail.com' }),
    );
    expect(me).toMatchObject({ name: 'Chị Lan', phone: '0909 000 111', contactEmail: 'lan.hr@gmail.com' });
    expect(await json<HrMe>(await t.request('/api/hr/me', { headers: { cookie } }))).toMatchObject(me);
  });

  it('should save job title and alias, and show them on /me', async () => {
    // Act
    const me = await json<HrMe>(
      await hr('PATCH', '/me', {
        name: 'Thuận Lê',
        phone: '',
        contactEmail: '',
        jobTitle: ' HR Generalist ',
        alias: 'Ms. Lee',
      }),
    );

    // Assert
    expect(me).toMatchObject({ jobTitle: 'HR Generalist', alias: 'Ms. Lee' });
    expect(await json<HrMe>(await t.request('/api/hr/me', { headers: { cookie } }))).toMatchObject({
      jobTitle: 'HR Generalist',
      alias: 'Ms. Lee',
    });
  });

  it('should show job title and alias in the HR account list', async () => {
    // Arrange
    await hr('PATCH', '/me', { name: '', phone: '', contactEmail: '', jobTitle: 'HR Generalist', alias: 'Ms. Lee' });

    // Act
    const users = await json<HrUserDto[]>(await hr('GET', '/users'));

    // Assert
    expect(users[0]).toMatchObject({ jobTitle: 'HR Generalist', alias: 'Ms. Lee' });
  });

  it('should clear job title and alias with an empty value', async () => {
    // Arrange
    await hr('PATCH', '/me', { name: '', phone: '', contactEmail: '', jobTitle: 'HR Generalist', alias: 'Ms. Lee' });

    // Act
    const me = await json<HrMe>(
      await hr('PATCH', '/me', { name: '', phone: '', contactEmail: '', jobTitle: '', alias: null }),
    );

    // Assert
    expect(me).toMatchObject({ jobTitle: null, alias: null });
  });

  it('should keep job title and alias when an older client saves without them', async () => {
    // Arrange
    await hr('PATCH', '/me', { name: '', phone: '', contactEmail: '', jobTitle: 'HR Generalist', alias: 'Ms. Lee' });

    // Act
    const me = await json<HrMe>(await hr('PATCH', '/me', { name: 'Lan', phone: '', contactEmail: '' }));

    // Assert
    expect(me).toMatchObject({ name: 'Lan', jobTitle: 'HR Generalist', alias: 'Ms. Lee' });
  });

  it('should refuse a job title that is too long', async () => {
    const res = await hr('PATCH', '/me', { name: '', phone: '', contactEmail: '', jobTitle: 'a'.repeat(101) });

    expect(res.status).toBe(422);
  });

  it('refuses an invalid email', async () => {
    expect((await hr('PATCH', '/me', { name: '', phone: '', contactEmail: 'khong-phai-email' })).status).toBe(422);
  });
});

describe('interview details and contact log', () => {
  it('stores an online interview with its Meet link, and clears the link with an empty value', async () => {
    const app = await insertApplication();
    const set = await json<ApplicationDetailDto>(
      await hr('PATCH', `/applications/${app.id}`, {
        status: 'interview',
        interviewMode: 'online',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      }),
    );
    expect(set).toMatchObject({ interviewMode: 'online', meetingUrl: 'https://meet.google.com/abc-defg-hij' });
    expect((await hr('PATCH', `/applications/${app.id}`, { meetingUrl: 'javascript:alert(1)' })).status).toBe(422);
    const cleared = await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, { meetingUrl: '' }));
    expect(cleared.meetingUrl).toBeNull();
  });

  it('drops the Meet link and mode when the application leaves "Hẹn phỏng vấn"', async () => {
    const app = await insertApplication();
    await hr('PATCH', `/applications/${app.id}`, {
      status: 'interview',
      interviewAt: '2026-10-30T09:00:00+07:00',
      interviewMode: 'online',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    });
    const after = await json<ApplicationDetailDto>(
      await hr('PATCH', `/applications/${app.id}`, { status: 'rejected' }),
    );
    expect(after).toMatchObject({ interviewAt: null, interviewMode: null, meetingUrl: null });
  });

  it('records each prepared message, newest first, under the HR name', async () => {
    const app = await insertApplication();
    await hr('POST', `/applications/${app.id}/contacts`, { templateKey: 'call', channel: 'copy' });
    t.clock.now = new Date(t.clock.now.getTime() + 60_000);
    const detail = await json<ApplicationDetailDto>(
      await hr('POST', `/applications/${app.id}/contacts`, { templateKey: 'interview_onsite', channel: 'gmail' }),
    );
    expect(detail.contacts.map((c) => [c.templateKey, c.channel, c.hrName])).toEqual([
      ['interview_onsite', 'gmail', 'Phòng Nhân sự'],
      ['call', 'copy', 'Phòng Nhân sự'],
    ]);
    expect((await hr('POST', `/applications/${app.id}/contacts`, { templateKey: 'x', channel: 'gmail' })).status).toBe(
      422,
    );
  });

  it('should record the new template and the new channels', async () => {
    // Arrange
    const app = await insertApplication();

    // Act
    await hr('POST', `/applications/${app.id}/contacts`, { templateKey: 'rejection_interview', channel: 'copy_html' });
    t.clock.now = new Date(t.clock.now.getTime() + 60_000);
    const detail = await json<ApplicationDetailDto>(
      await hr('POST', `/applications/${app.id}/contacts`, { templateKey: 'rejection', channel: 'copy' }),
    );

    // Assert
    expect(detail.contacts.map((c) => [c.templateKey, c.channel])).toEqual([
      ['rejection', 'copy'],
      ['rejection_interview', 'copy_html'],
    ]);
  });

  it('deletes the contact log with the application', async () => {
    const app = await insertApplication();
    await hr('POST', `/applications/${app.id}/contacts`, { templateKey: 'rejection', channel: 'mailto' });
    await hr('DELETE', `/applications/${app.id}`);
    expect(await t.db.select().from(contactLog)).toEqual([]);
  });
});

describe('search by a caller ID', () => {
  it('finds 0797586611 from +84 797 586 611', async () => {
    const app = await insertApplication();
    const body = await json<{ applications: { id: string }[] }>(
      await hr('GET', `/applications?q=${encodeURIComponent('+84 797 586 611')}`),
    );
    expect(body.applications.map((a) => a.id)).toEqual([app.id]);
  });
});
