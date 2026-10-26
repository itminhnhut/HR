import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from '../../../api/mock';
import { DEMO_HR } from '../../../api/mock-seed';
import type { ArticleEditorProps } from './editor/ArticleEditor';
import { HrNewsEditPage } from './HrNewsEditPage';

// Demo mode (no BE address): the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));

// Lexical needs a real browser; here a textarea stands in and reports one paragraph per change.
vi.mock('./editor/ArticleEditor', () => ({
  default: ({ onChange }: ArticleEditorProps) => (
    <textarea
      aria-label="Nội dung bài viết"
      onChange={(e) =>
        onChange({
          root: {
            type: 'root',
            children: [{ type: 'paragraph', children: [{ type: 'text', text: e.target.value, format: 0, style: '' }] }],
          },
        })
      }
    />
  ),
}));

const PUBLISHED_ID = '9a41d6e2-5f3b-4c87-b2d9-6e1a7c0f4b22';
const DRAFT_ID = 'e5b7c3a9-2d64-4f1e-9c38-7b5a1e2d0c33';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});
afterEach(cleanup);

/** The status picker (the side panel's; the phone bar has a copy) and one of its choices. */
async function pickStatus(user: ReturnType<typeof userEvent.setup>, label: string) {
  const [button] = await screen.findAllByRole('button', { name: /^Trạng thái: .* – bấm để đổi$/ });
  if (!button) throw new Error('no status picker');
  await user.click(button);
  const menu = screen.getByRole('menu', { name: 'Đổi trạng thái' });
  await user.click(within(menu).getByRole('menuitemradio', { name: new RegExp(`^${label}`) }));
}

function open(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/hr/tin-tuc', element: <p>Danh sách</p> },
      { path: '/hr/tin-tuc/:id', element: <HrNewsEditPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('news editor page', () => {
  it('should save a new post by itself once typing pauses, then switch to its own address', async () => {
    // Arrange
    const user = userEvent.setup();
    const router = open('/hr/tin-tuc/moi');
    const title = await screen.findByLabelText('Tiêu đề');

    // Act
    await user.type(title, 'Một ngày ở TOP FLOW');
    await user.type(await screen.findByLabelText('Nội dung bài viết'), 'Đoạn đầu tiên.');

    // Assert
    expect(screen.getByText('Có thay đổi chưa lưu')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/^Đã lưu lúc \d\d:\d\d$/)).toBeTruthy(), { timeout: 4000 });
    expect(router.state.location.pathname).toMatch(/^\/hr\/tin-tuc\/[0-9a-f-]{36}$/);
    const { posts } = await mockApi.hrNews();
    expect(posts[0]).toMatchObject({ title: 'Một ngày ở TOP FLOW', status: 'draft' });
    // Still the same editor: what was typed is on screen.
    expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Một ngày ở TOP FLOW');
  });

  it('should list what blocks publishing in the confirm sheet and keep the post a draft', async () => {
    // Arrange
    const user = userEvent.setup();
    open('/hr/tin-tuc/moi');
    await user.type(await screen.findByLabelText('Tiêu đề'), 'Chưa đủ');

    // Act
    await pickStatus(user, 'Đã đăng');

    // Assert
    const sheet = screen.getByRole('dialog', { name: 'Đăng bài?' });
    const checks = within(sheet).getByRole('region', { name: 'Kiểm tra trước khi đăng' });
    for (const item of ['Đã chọn chuyên mục', 'Có ảnh bìa', 'Bài có nội dung']) {
      expect(within(checks).getByText(item).parentElement?.textContent).toContain('Phải sửa');
    }
    expect(within(sheet).getByText('Còn 3 mục phải sửa trước khi đăng.')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Đăng bài' }).hasAttribute('disabled')).toBe(true);
    expect(within(sheet).getByLabelText('Kết quả trên Google')).toBeTruthy();
    expect(within(sheet).getByLabelText('Xem trước khi chia sẻ')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Huỷ' }));
    expect(screen.getAllByRole('button', { name: /^Trạng thái: Nháp/ }).length).toBeGreaterThan(0);
  });

  it('should publish a complete draft from the footer button after the confirm sheet', async () => {
    // Arrange
    const user = userEvent.setup();
    open(`/hr/tin-tuc/${DRAFT_ID}`);
    const publish = await screen.findByRole('button', { name: 'Đăng bài' });

    // Act
    await user.click(publish);
    const sheet = screen.getByRole('dialog', { name: 'Đăng bài?' });
    await user.click(within(sheet).getByRole('button', { name: 'Đăng bài' }));

    // Assert
    expect(
      await screen.findByText(/^Đã đăng\. Bài đang hiện trên trang tin tức\./, {}, { timeout: 4000 }),
    ).toBeTruthy();
    expect((await mockApi.hrNewsPost(DRAFT_ID)).status).toBe('published');
    expect(await screen.findByRole('button', { name: 'Cập nhật bài' })).toBeTruthy();
  });

  it('should name the footer button after what it will do for the post', async () => {
    // Arrange
    const user = userEvent.setup();
    open(`/hr/tin-tuc/${PUBLISHED_ID}`);

    // Assert: published, no changes yet
    const update = await screen.findByRole('button', { name: 'Cập nhật bài' });
    expect(update.hasAttribute('disabled')).toBe(true);

    // Act: hide it
    await pickStatus(user, 'Đã ẩn');
    await user.click(
      within(screen.getByRole('dialog', { name: 'Ẩn bài viết?' })).getByRole('button', { name: 'Ẩn bài' }),
    );

    // Assert
    expect(await screen.findByRole('button', { name: 'Hiện lại' })).toBeTruthy();
  });

  it('should hide a published post after asking, then show it again', async () => {
    // Arrange
    const user = userEvent.setup();
    open(`/hr/tin-tuc/${PUBLISHED_ID}`);
    expect(await screen.findByText(/Đã khoá vì bài đã đăng/)).toBeTruthy();

    // Act: hide (with the confirm), then show again
    await pickStatus(user, 'Đã ẩn');
    const confirm = screen.getByRole('dialog', { name: 'Ẩn bài viết?' });
    await user.click(within(confirm).getByRole('button', { name: 'Ẩn bài' }));

    // Assert
    expect(await screen.findByText(/Đã ẩn bài/)).toBeTruthy();
    expect(screen.getAllByText('Đã ẩn').length).toBeGreaterThan(0);
    // Hidden, the address stays locked: links already shared keep it.
    expect(screen.getByText(/Đã khoá vì bài đã đăng/)).toBeTruthy();
    await pickStatus(user, 'Đã đăng');
    const sheet = screen.getByRole('dialog', { name: 'Hiện lại?' });
    await user.click(within(sheet).getByRole('button', { name: 'Hiện lại' }));
    expect(await screen.findByText(/Đã hiện lại/, {}, { timeout: 4000 })).toBeTruthy();
  });

  it('should keep edits to a published post off the page until HR presses "Cập nhật bài"', async () => {
    // Arrange
    const user = userEvent.setup();
    open(`/hr/tin-tuc/${PUBLISHED_ID}`);
    const title = await screen.findByLabelText('Tiêu đề');
    expect(screen.getByText(/Đang hiển thị trên trang – thay đổi chỉ lên trang khi bấm Cập nhật bài/)).toBeTruthy();

    // Act: type, then wait longer than the autosave pause
    await user.type(title, ' (sửa)');
    await new Promise((r) => setTimeout(r, 2000));

    // Assert: nothing saved yet
    expect(screen.getByText('Có thay đổi chưa cập nhật')).toBeTruthy();
    expect((await mockApi.hrNewsPost(PUBLISHED_ID)).title).not.toMatch(/\(sửa\)$/);

    // Act: update
    await user.click(screen.getByRole('button', { name: 'Cập nhật bài' }));

    // Assert
    await waitFor(() => expect(screen.getByText(/^Đã cập nhật lúc/)).toBeTruthy(), { timeout: 4000 });
    expect((await mockApi.hrNewsPost(PUBLISHED_ID)).title).toMatch(/\(sửa\)$/);
  });

  it('should not offer Nháp again for a post that was published', async () => {
    const user = userEvent.setup();
    open(`/hr/tin-tuc/${PUBLISHED_ID}`);
    const [button] = await screen.findAllByRole('button', { name: /^Trạng thái: Đã đăng/ });

    await user.click(button as HTMLElement);
    const draft = within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /Nháp/ });

    expect(draft.getAttribute('aria-disabled')).toBe('true');
    expect(draft.textContent).toMatch(/không về nháp được/);
  });

  it('should ask in the site dialog before leaving with unsaved changes', async () => {
    // Arrange
    const user = userEvent.setup();
    const router = open(`/hr/tin-tuc/${PUBLISHED_ID}`);
    await user.type(await screen.findByLabelText('Tiêu đề'), ' (sửa)');

    // Act: follow the back link, stay, then leave
    await user.click(screen.getByRole('link', { name: 'Tin tức' }));
    const dialog = screen.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
    await user.click(within(dialog).getByRole('button', { name: 'Ở lại sửa tiếp' }));

    // Assert
    expect(router.state.location.pathname).toBe(`/hr/tin-tuc/${PUBLISHED_ID}`);
    await user.click(screen.getByRole('link', { name: 'Tin tức' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' })).getByRole('button', {
        name: 'Rời trang',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/hr/tin-tuc'));
  });

  it('should show the address under the title and let HR change it', async () => {
    const user = userEvent.setup();
    open('/hr/tin-tuc/moi');
    await user.type(await screen.findByLabelText('Tiêu đề'), 'Đời sống ở xưởng');

    expect(screen.getByText(/Đường dẫn: .*\/tin-tuc\/doi-song-o-xuong/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sửa' }));
    await user.type(screen.getByLabelText('Đường dẫn riêng'), 'Bài Riêng');

    expect(screen.getByText(/Hiện tại: .*\/tin-tuc\/bai-rieng/)).toBeTruthy();
  });

  it('should save hashtags typed with # and Enter', async () => {
    const user = userEvent.setup();
    open('/hr/tin-tuc/moi');
    await user.type(await screen.findByLabelText('Tiêu đề'), 'Bài có hashtag');
    const input = screen.getByRole('combobox', { name: /Hashtag/ });

    await user.type(input, '#Kỹ sư{Enter}phỏng vấn,');

    expect(screen.getByRole('button', { name: 'Bỏ hashtag Kỹ sư' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bỏ hashtag phỏng vấn' })).toBeTruthy();
    await waitFor(async () => expect((await mockApi.hrNews()).posts[0]?.title).toBe('Bài có hashtag'), {
      timeout: 4000,
    });
    await waitFor(
      async () => {
        const saved = await mockApi.hrNewsPost((await mockApi.hrNews()).posts[0]?.id ?? '');
        expect(saved.tags).toEqual(['Kỹ sư', 'phỏng vấn']);
      },
      { timeout: 4000 },
    );
  });

  it('should not create a draft until it has a title or some text', async () => {
    // Arrange
    const user = userEvent.setup();
    const router = open('/hr/tin-tuc/moi');
    const before = (await mockApi.hrNews()).posts.length;
    const input = await screen.findByRole('combobox', { name: /Hashtag/ });

    // Act: only a hashtag, then wait longer than the autosave pause
    await user.type(input, '#Kỹ sư{Enter}');
    await new Promise((r) => setTimeout(r, 2000));

    // Assert: nothing stored, still the new-post address, and leaving is not blocked
    expect((await mockApi.hrNews()).posts).toHaveLength(before);
    expect(router.state.location.pathname).toBe('/hr/tin-tuc/moi');
    expect(screen.getByText('Gõ tiêu đề hoặc nội dung, bài sẽ tự lưu nháp')).toBeTruthy();

    // Act: a title makes it worth keeping
    await user.type(screen.getByLabelText('Tiêu đề'), 'Bài mới');

    // Assert
    await waitFor(async () => expect((await mockApi.hrNews()).posts).toHaveLength(before + 1), { timeout: 4000 });
  });
});
