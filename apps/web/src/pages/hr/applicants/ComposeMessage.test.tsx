import { DEFAULT_MESSAGE_TEMPLATES, MAIL_COMPANY, type ApplicationDetailDto, type HrMe } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { ComposeMessage, ContactHistory, hrCalendarUrl } from './ComposeMessage';

const INTERVIEW_AT = '2026-11-06T02:00:00.000Z';

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const application = (over: Partial<ApplicationDetailDto> = {}): ApplicationDetailDto => ({
  id: 'a1',
  jobId: 'j1',
  jobTitle: 'Kế toán',
  fullName: 'Nguyễn Thị Mai Anh',
  phone: '0912345678',
  status: 'seen',
  activity: [],
  rejectReason: null,
  cvGender: null,
  cvBirth: null,
  rejectNote: null,
  createdAt: '2026-10-20T03:00:00.000Z',
  hasCv: true,
  matchPercent: null,
  matchBonus: 0,
  noteLine: null,
  interviewAt: null,
  review: null,
  source: 'website',
  cvUpdatedByCandidate: false,
  reviewInfo: null,
  referrer: null,
  addedBy: null,
  consentBy: null,
  cvHistory: [],
  email: 'maianh@example.com',
  message: null,
  cvFileName: null,
  cvLink: null,
  note: null,
  noteUpdatedAt: null,
  noteUpdatedBy: null,
  interviewMode: null,
  meetingUrl: null,
  cvScore: null,
  contacts: [],
  otherApplications: [],
  ...over,
});

const fullAccount: HrMe = {
  id: 'u1',
  email: 'lan@topflow.vn',
  name: 'Lan',
  phone: '0909000111',
  contactEmail: 'lan@gmail.com',
  jobTitle: 'HR Generalist',
  alias: 'Ms. Lee',
};

/** What the server was asked to log. */
let logged: { templateKey: string; channel: string }[];
let account: HrMe;
let clipboardWrite: ReturnType<typeof vi.fn>;
let openWindow: ReturnType<typeof vi.fn>;
let clipboardItems: Record<string, Blob>[];

/** Only here to record what reaches the clipboard: jsdom has no ClipboardItem. */
class FakeClipboardItem {
  constructor(public readonly parts: Record<string, Blob>) {
    clipboardItems = [...clipboardItems, parts];
  }
}

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the blob'));
    reader.readAsText(blob);
  });

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  logged = [];
  account = fullAccount;
  clipboardItems = [];
  clipboardWrite = vi.fn(async () => undefined);
  vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  openWindow = vi.fn();
  vi.stubGlobal('open', openWindow);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/hr/me')) return reply(200, account);
      if (url.endsWith('/hr/message-templates')) {
        return reply(200, { templates: Object.values(DEFAULT_MESSAGE_TEMPLATES), customized: [] });
      }
      if (url.endsWith('/contacts')) {
        logged = [...logged, JSON.parse(String(init?.body)) as { templateKey: string; channel: string }];
        return reply(200, application());
      }
      return reply(404, { error: 'not found' });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** user-event replaces navigator.clipboard during setup, so the fake goes in afterwards. */
function setup() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write: clipboardWrite, writeText: vi.fn(async () => undefined) },
  });
  return user;
}

async function openCompose(app: ApplicationDetailDto) {
  const user = setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ComposeMessage app={app} />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Soạn thư' }));
  await screen.findByLabelText('Mẫu thư');
  await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Tên HR').value).toBe(account.name ?? ''));
  return user;
}

/** One image for the header and one for the signature, both inside the mail itself. */
function expectEmbeddedLogos(html: string) {
  const sources = [...html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1] ?? '');
  expect(sources).toHaveLength(2);
  expect(sources[0]?.startsWith('data:image/png;base64,')).toBe(true);
  expect(sources[1]?.startsWith('data:image/png;base64,')).toBe(true);
  expect(sources[0]).not.toBe(sources[1]);
}

const chosenTemplate = () => screen.getByLabelText<HTMLSelectElement>('Mẫu thư').value;
const box = (name: string) => screen.getByRole<HTMLTextAreaElement>('textbox', { name });
const preview = () => screen.getByTitle('Xem trước thư');
const copyMail = () => screen.getByRole('button', { name: 'Sao chép & mở Outlook' });

describe('choosing the template', () => {
  it('should suggest the after-interview rejection when a rejected candidate had an interview', async () => {
    // Arrange + Act
    await openCompose(application({ status: 'rejected', interviewAt: INTERVIEW_AT }));

    // Assert
    expect(chosenTemplate()).toBe('rejection_interview');
  });

  it('should suggest the application rejection when a rejected candidate had no interview', async () => {
    // Arrange + Act
    await openCompose(application({ status: 'rejected' }));

    // Assert
    expect(chosenTemplate()).toBe('rejection');
  });

  it('should suggest the online invitation for an online interview', async () => {
    // Arrange + Act
    await openCompose(application({ status: 'interview', interviewMode: 'online', interviewAt: INTERVIEW_AT }));

    // Assert
    expect(chosenTemplate()).toBe('interview_online');
  });

  it('should suggest a call for everyone else', async () => {
    // Arrange + Act
    await openCompose(application());

    // Assert
    expect(chosenTemplate()).toBe('call');
  });
});

describe('filling the mail', () => {
  it('should fill each section of the mail with the candidate and the HR account', async () => {
    // Arrange + Act
    await openCompose(application({ status: 'rejected', interviewAt: INTERVIEW_AT }));

    // Assert
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Tiêu đề' }).value).toContain('vị trí Kế toán');
    expect(box('Nội dung mở đầu').value).toContain('Thân gửi bạn Anh');
    expect(box('Nội dung mở đầu').value).toContain('06/11/2026');
    expect(box('Đoạn kết').value).toContain('Lan – 0909000111');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('should show the note box only for the templates that have one', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));
    expect(screen.queryByRole('textbox', { name: 'Đoạn sau khung thông tin' })).toBeNull();

    // Act
    await user.selectOptions(screen.getByLabelText('Mẫu thư'), 'interview_onsite');

    // Assert
    expect(box('Đoạn sau khung thông tin').value).toContain('Buổi phỏng vấn');
  });

  it('should tint the empty box and the section still holding a token when a value is missing', async () => {
    // Arrange
    account = { ...fullAccount, phone: null };

    // Act
    await openCompose(application({ status: 'rejected' }));

    // Assert
    expect(within(screen.getByRole('note')).getByText(/\{SĐT HR\}/)).toBeTruthy();
    expect(screen.getByLabelText('SĐT HR').className).toContain('bg-[#fff8db]');
    expect(box('Đoạn kết').value).toContain('{SĐT HR}');
    expect(box('Đoạn kết').className).toContain('bg-[#fff8db]');
    expect(box('Nội dung mở đầu').className).not.toContain('bg-[#fff8db]');
  });

  it('should ask for the interview time even though the text of the invitation does not mention it', async () => {
    // Arrange + Act
    await openCompose(application({ status: 'interview' }));

    // Assert
    expect(within(screen.getByRole('note')).getByText(/\{Giờ phỏng vấn\}/)).toBeTruthy();
  });

  it('should ask again for a meeting link the mail would leave out', async () => {
    // Arrange
    const user = await openCompose(
      application({ status: 'interview', interviewMode: 'online', interviewAt: INTERVIEW_AT }),
    );

    // Act
    await user.type(screen.getByLabelText('Link Meet'), 'meet.google.com/abc');

    // Assert
    expect(within(screen.getByRole('note')).getByText(/\{Link Meet\}/)).toBeTruthy();
    expect(screen.getByText(/link phải bắt đầu bằng https/)).toBeTruthy();
  });

  it('should default the interviewer, duration and address and let HR change them for this mail', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'interview', interviewAt: INTERVIEW_AT }));
    const address = screen.getByLabelText<HTMLInputElement>('Địa chỉ');
    expect(address.value).toContain('110/20/2');
    expect(screen.getByLabelText<HTMLInputElement>('Thời lượng').value).toBe('30 – 45 phút');

    // Act
    await user.clear(screen.getByLabelText('Người trao đổi'));
    await user.type(screen.getByLabelText('Người trao đổi'), 'Chị Hoa');

    // Assert
    await waitFor(() => expect(preview().getAttribute('srcdoc')).toContain('Chị Hoa'));
  });

  it('should offer to rebuild when a field changes the text after a hand edit, and keep the edit until then', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));
    await user.type(box('Đoạn kết'), ' Thêm câu riêng.');
    expect(screen.queryByText(/Bạn đã sửa tay/)).toBeNull();

    // Act
    await user.type(screen.getByLabelText('Tên HR'), ' Anh');

    // Assert
    expect(screen.getByText(/Bạn đã sửa tay/)).toBeTruthy();
    expect(box('Đoạn kết').value).toContain('Thêm câu riêng.');

    // Act
    await user.click(screen.getByRole('button', { name: 'Điền lại thông tin mới vào thư' }));

    // Assert
    expect(box('Đoạn kết').value).not.toContain('Thêm câu riêng.');
    expect(box('Đoạn kết').value).toContain('Lan Anh');
    expect(screen.queryByText(/Bạn đã sửa tay/)).toBeNull();
  });

  it('should not claim the text is behind when the change only shows in the frame of the mail', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'interview', interviewAt: INTERVIEW_AT }));
    await user.type(box('Đoạn kết'), ' Thêm câu riêng.');

    // Act
    await user.type(screen.getByLabelText('Thời lượng'), ' nhé');

    // Assert
    expect(screen.queryByText(/Bạn đã sửa tay/)).toBeNull();
    await waitFor(() => expect(preview().getAttribute('srcdoc')).toContain('45 phút nhé'));
  });
});

describe('previewing the mail', () => {
  it('should fold the signature and the text away once they are complete', async () => {
    // Act
    await openCompose(application({ status: 'interview', interviewAt: '2026-11-05T02:30:00.000Z' }));

    // Assert
    expect(screen.getByRole('button', { name: /Người gửi/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Sửa nội dung thư' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('should not ask for a job title HR has cleared', async () => {
    // Arrange
    account = { ...fullAccount, jobTitle: null };

    // Act
    await openCompose(application());

    // Assert
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByLabelText('Chức danh HR').className).not.toContain('bg-[#fff8db]');
    expect(screen.getByRole('button', { name: /Người gửi/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('should open the signature on its own when the HR phone is missing', async () => {
    // Arrange
    account = { ...fullAccount, phone: null };

    // Act
    await openCompose(application());

    // Assert
    expect(screen.getByRole('button', { name: /Người gửi/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('should keep what HR typed when the click lands outside the drawer', async () => {
    // Arrange
    const user = await openCompose(application());
    const dialog = screen.getByRole('dialog', { name: 'Soạn thư', hidden: true });

    // Act
    await user.click(dialog);

    // Assert
    expect(screen.getByLabelText('Mẫu thư')).toBeTruthy();
  });

  it('should show the real mail in a frame that can run nothing', async () => {
    // Arrange + Act
    await openCompose(application({ status: 'interview', interviewAt: INTERVIEW_AT }));

    // Assert
    expect(preview().tagName).toBe('IFRAME');
    expect(preview().getAttribute('sandbox')).toBe('');
    expect(preview().getAttribute('srcdoc')).toContain('THƯ MỜI PHỎNG VẤN');
    expect(preview().getAttribute('srcdoc')).toContain('bạn <b>Anh</b>');
  });

  it('should embed both logos in the preview, not link them', async () => {
    // Arrange + Act
    await openCompose(application({ status: 'rejected' }));

    // Assert
    expectEmbeddedLogos(preview().getAttribute('srcdoc') ?? '');
  });

  it('should escape a candidate name holding markup', async () => {
    // Arrange + Act
    await openCompose(application({ fullName: 'Lê <script>alert(1)</script>', status: 'rejected' }));

    // Assert
    expect(preview().getAttribute('srcdoc')).not.toContain('<script>');
    expect(document.querySelector('dialog script')).toBeNull();
  });

  it('should follow what HR types into a section', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));

    // Act
    await user.type(box('Đoạn kết'), ' Câu mới của HR.');

    // Assert
    await waitFor(() => expect(preview().getAttribute('srcdoc')).toContain('Câu mới của HR.'));
  });
});

describe('Sao chép thư đẹp', () => {
  it('should put the mail on the clipboard as html and plain text, and log it once', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));

    // Act
    await user.dblClick(copyMail());

    // Assert
    await waitFor(() => expect(logged).toEqual([{ templateKey: 'rejection', channel: 'copy_html' }]));
    const parts = clipboardItems[0];
    expect(Object.keys(parts ?? {}).sort()).toEqual(['text/html', 'text/plain']);
    expect(await readBlob(parts?.['text/html'] ?? new Blob())).toContain('THƯ CẢM ƠN ỨNG TUYỂN');
    const plain = await readBlob(parts?.['text/plain'] ?? new Blob());
    expect(plain).toContain('Thân gửi bạn Anh');
    expect(plain).not.toContain('<table');
  });

  it('should embed both logos in the copied mail, not link them', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));

    // Act
    await user.click(copyMail());

    // Assert
    await waitFor(() => expect(clipboardItems).toHaveLength(1));
    expectEmbeddedLogos(await readBlob(clipboardItems[0]?.['text/html'] ?? new Blob()));
  });

  it('should open a new Outlook mail for the candidate only after the mail is on the clipboard', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));

    // Act
    await user.click(copyMail());

    // Assert
    await waitFor(() => expect(openWindow).toHaveBeenCalledTimes(1));
    expect(String(openWindow.mock.calls[0]?.[0])).toContain('deeplink/compose?to=maianh%40example.com&subject=');
    expect(clipboardItems).toHaveLength(1);
  });

  it('should not open Outlook when the browser refuses the clipboard', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));
    clipboardWrite.mockRejectedValueOnce(new Error('denied'));

    // Act
    await user.click(copyMail());

    // Assert
    await screen.findByRole('alert');
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('should show no message after a copy that worked', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));

    // Act
    await user.click(copyMail());

    // Assert
    await waitFor(() => expect(logged).toHaveLength(1));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should log again once the mail has been edited', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));
    await user.click(copyMail());
    await waitFor(() => expect(logged).toHaveLength(1));

    // Act
    await user.type(box('Đoạn kết'), ' Sửa thêm.');
    await user.click(copyMail());

    // Assert
    await waitFor(() => expect(logged).toHaveLength(2));
  });

  it('should explain and log nothing when the browser refuses the clipboard', async () => {
    // Arrange
    clipboardWrite = vi.fn(async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    });
    const user = await openCompose(application({ status: 'rejected' }));

    // Act
    await user.click(copyMail());

    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa chép được thư');
    expect(logged).toEqual([]);
  });

  it('should explain and log nothing when the browser has no rich clipboard', async () => {
    // Arrange
    vi.stubGlobal('ClipboardItem', undefined);
    const user = await openCompose(application({ status: 'rejected' }));

    // Act
    await user.click(copyMail());

    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain('Trình duyệt này chưa chép được thư đẹp');
    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(logged).toEqual([]);
  });

  it('should still copy and open Outlook for a candidate with no email', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected', email: null }));
    expect(screen.queryByRole('link', { name: /Mở Gmail/ })).toBeNull();

    // Act
    await user.click(copyMail());

    // Assert
    await waitFor(() => expect(logged).toHaveLength(1));
    expect(String(openWindow.mock.calls[0]?.[0])).toContain('deeplink/compose?subject=');
  });
});

describe('the plain-text channels', () => {
  it('should open Gmail with the plain text of the same mail, and log the channel', async () => {
    // Arrange
    const user = await openCompose(application({ status: 'rejected' }));
    const gmail = screen.getByRole('link', { name: /Mở Gmail/ });

    // Act
    await user.click(gmail);

    // Assert
    const body = new URL(gmail.getAttribute('href') ?? '').searchParams.get('body');
    expect(body).toContain('Thân gửi bạn Anh');
    expect(body).toContain('E: hr@topflow.vn');
    await waitFor(() => expect(logged).toEqual([{ templateKey: 'rejection', channel: 'gmail' }]));
  });

  it('should warn instead of offering a mail app link too long to survive', async () => {
    // Arrange + Act
    const user = await openCompose(application({ status: 'rejected' }));
    await user.type(box('Đoạn kết'), 'ệ'.repeat(300));

    // Assert
    expect(screen.queryByRole('link', { name: 'Mở ứng dụng mail' })).toBeNull();
    expect(screen.getByText(/Thư dài, ứng dụng mail có thể cắt bớt/)).toBeTruthy();
  });
});

describe('ContactHistory', () => {
  it('should name the new channel and the new template', () => {
    // Arrange + Act
    render(
      <ContactHistory
        app={application({
          contacts: [
            {
              templateKey: 'rejection_interview',
              channel: 'copy_html',
              hrName: 'Lan',
              createdAt: '2026-11-03T03:00:00.000Z',
            },
          ],
        })}
      />,
    );

    // Assert
    expect(screen.getByText(/Từ chối sau phỏng vấn/)).toBeTruthy();
    expect(screen.getByText(/sao chép thư đẹp/)).toBeTruthy();
  });
});

describe('hrCalendarUrl', () => {
  it('should give the same office address as the letter to the candidate', () => {
    // Act
    const url = new URL(hrCalendarUrl(application({ interviewAt: INTERVIEW_AT, interviewMode: 'onsite' })) ?? '');

    // Assert
    expect(url.searchParams.get('location')).toBe(MAIL_COMPANY.officeAddress);
  });
});
