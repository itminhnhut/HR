import { DEFAULT_MESSAGE_TEMPLATES, type HrMe, type MessageTemplate, type TemplateKey } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { HrMessagesPage } from './HrMessagesPage';

const account: HrMe = {
  id: 'u1',
  email: 'lan@topflow.vn',
  name: 'Lan',
  phone: '0909000111',
  contactEmail: null,
  jobTitle: 'HR Generalist',
  alias: null,
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A small stand-in for the server's template store. */
let saved: Partial<Record<TemplateKey, MessageTemplate>>;
let lastSave: unknown;

const stored = () => ({
  templates: Object.values(DEFAULT_MESSAGE_TEMPLATES).map((t) => saved[t.key] ?? t),
  customized: Object.keys(saved),
});

beforeEach(() => {
  saved = {};
  lastSave = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/hr/me')) return reply(200, account);
      const match = /\/hr\/message-templates\/(\w+)$/.exec(url);
      const key = match?.[1] as TemplateKey | undefined;
      if (key && init?.method === 'PUT') {
        lastSave = JSON.parse(String(init.body));
        saved = { ...saved, [key]: { key, ...(lastSave as Omit<MessageTemplate, 'key'>) } };
        return reply(200, stored());
      }
      if (key && init?.method === 'DELETE') {
        saved = Object.fromEntries(Object.entries(saved).filter(([k]) => k !== key));
        return reply(200, stored());
      }
      if (url.endsWith('/hr/message-templates')) return reply(200, stored());
      return reply(404, { error: 'not found' });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <HrMessagesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByLabelText('Tiêu đề');
}

const preview = () => screen.getByTitle('Xem trước thư');
const closing = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Đoạn kết' });

describe('Trang Mẫu thư', () => {
  it('should offer all five templates', async () => {
    // Arrange + Act
    await openPage();

    // Assert
    for (const name of [
      'Mời phỏng vấn trực tiếp',
      'Mời phỏng vấn online',
      'Từ chối hồ sơ',
      'Từ chối sau phỏng vấn',
      'Hẹn gọi điện',
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('should show every editable section, the note only on interview templates', async () => {
    // Arrange
    const user = userEvent.setup();
    await openPage();
    for (const name of [
      'Nội dung mở đầu',
      'Đoạn sau khung thông tin',
      'Tiêu đề khối nổi bật',
      'Khối nổi bật',
      'Đoạn kết',
    ]) {
      expect(screen.getByRole('textbox', { name })).toBeTruthy();
    }

    // Act
    await user.click(screen.getByRole('button', { name: 'Từ chối hồ sơ' }));

    // Assert
    expect(screen.queryByRole('textbox', { name: 'Đoạn sau khung thông tin' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Khối nổi bật' })).toBeTruthy();
  });

  it('should say that only the text can be edited', async () => {
    // Arrange + Act
    await openPage();

    // Assert
    expect(screen.getByText(/Ở đây chỉ sửa được phần chữ/)).toBeTruthy();
  });

  it('should preview the real mail with the sample candidate in a frame that can run nothing', async () => {
    // Arrange + Act
    await openPage();

    // Assert
    expect(preview().getAttribute('sandbox')).toBe('');
    expect(preview().getAttribute('srcdoc')).toContain('Minh Anh');
    expect(preview().getAttribute('srcdoc')).toContain('THƯ MỜI PHỎNG VẤN');
  });

  it('should embed both logos in the preview, not link them', async () => {
    // Arrange + Act
    await openPage();

    // Assert
    const sources = [...(preview().getAttribute('srcdoc') ?? '').matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map(
      (m) => m[1] ?? '',
    );
    expect(sources).toHaveLength(2);
    expect(sources.every((src) => src.startsWith('data:image/png;base64,'))).toBe(true);
    expect(sources[0]).not.toBe(sources[1]);
  });

  it('should follow the edits in the preview before anything is saved', async () => {
    // Arrange
    const user = userEvent.setup();
    await openPage();

    // Act
    await user.type(closing(), ' Hẹn sớm gặp bạn.');

    // Assert
    await waitFor(() => expect(preview().getAttribute('srcdoc')).toContain('Hẹn sớm gặp bạn.'));
    expect(lastSave).toBeNull();
  });

  it('should insert a placeholder where the cursor is, in the section being edited', async () => {
    // Arrange
    const user = userEvent.setup();
    await openPage();
    const box = closing();
    await user.clear(box);
    await user.type(box, 'Chào ');

    // Act
    await user.click(screen.getByRole('button', { name: '{Tên ứng viên}' }));

    // Assert
    expect(box.value).toBe('Chào {Tên ứng viên}');
  });

  it('should save every section of the template', async () => {
    // Arrange
    const user = userEvent.setup();
    await openPage();
    const defaults = DEFAULT_MESSAGE_TEMPLATES.interview_onsite;

    // Act
    await user.type(closing(), ' Thêm.');
    await user.click(screen.getByRole('button', { name: 'Lưu mẫu' }));

    // Assert
    await screen.findByText('Đã lưu mẫu thư.');
    expect(lastSave).toEqual({
      subject: defaults.subject,
      body: defaults.body,
      note: defaults.note,
      calloutTitle: defaults.calloutTitle,
      callout: defaults.callout,
      closing: `${defaults.closing} Thêm.`,
    });
  });

  it('should bring the original texts back with "Dùng lại mẫu gốc"', async () => {
    // Arrange
    const user = userEvent.setup();
    await openPage();
    await user.type(closing(), ' Thêm.');
    await user.click(screen.getByRole('button', { name: 'Lưu mẫu' }));
    await screen.findByText('Đã lưu mẫu thư.');

    // Act
    await user.click(screen.getByRole('button', { name: 'Dùng lại mẫu gốc' }));

    // Assert
    await screen.findByText('Đã dùng lại mẫu gốc.');
    expect(closing().value).toBe(DEFAULT_MESSAGE_TEMPLATES.interview_onsite.closing);
    expect(screen.queryByRole('button', { name: 'Dùng lại mẫu gốc' })).toBeNull();
    await waitFor(() => expect(preview().getAttribute('srcdoc')).not.toContain('Thêm.'));
  });
});
