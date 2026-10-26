import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from '../../../api/mock';
import { DEMO_HR } from '../../../api/mock-seed';
import { HrNewsListPage } from './HrNewsListPage';

// Demo mode (no BE address): the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));

const PUBLISHED_ID = '9a41d6e2-5f3b-4c87-b2d9-6e1a7c0f4b22';

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

function open(path = '/hr/tin-tuc') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/hr/tin-tuc', element: <HrNewsListPage /> }], {
    initialEntries: [path],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('HR news list', () => {
  it('should sort posts into Tất cả / Đã đăng / Nháp / Đã ẩn tabs with counts and keep the tab in the address', async () => {
    // Arrange: one of the published demo posts is hidden.
    await mockApi.hrUnpublishNews(PUBLISHED_ID);
    const user = userEvent.setup();
    const router = open();
    const tabs = await screen.findByRole('group', { name: 'Lọc theo trạng thái' });
    await screen.findAllByText('Chuyến đi thiện nguyện Vĩnh Hy 2026');

    // Act
    await user.click(within(tabs).getByRole('button', { name: /Đã ẩn/ }));

    // Assert
    expect(
      within(tabs)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Tất cả3', 'Đã đăng1', 'Nháp1', 'Đã ẩn1']);
    expect(router.state.location.search).toBe('?tab=hidden');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('Đã ẩn')).toBeTruthy();
    // Only published posts link to the public page.
    expect(within(rows[0]).queryByRole('link', { name: /trên trang/ })).toBeNull();
  });

  it('should find posts by title without accents', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText('Chuyến đi thiện nguyện Vĩnh Hy 2026');
    const tabs = screen.getByRole('group', { name: 'Lọc theo trạng thái' });
    await user.click(within(tabs).getByRole('button', { name: /Đã đăng/ }));

    await user.type(screen.getByRole('searchbox', { name: 'Tìm theo tiêu đề' }), 'phong van');

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('5 điều nên chuẩn bị trước buổi phỏng vấn');
  });

  it('should open on all posts, or on the tab named in the address', async () => {
    open('/hr/tin-tuc?tab=draft');

    await screen.findAllByText('Chuyến đi thiện nguyện Vĩnh Hy 2026');
    const tabs = screen.getByRole('group', { name: 'Lọc theo trạng thái' });

    expect(within(tabs).getByRole('button', { name: /Nháp/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
  });

  it('should say what a post lacks when publishing it from the list, with a way to the editor', async () => {
    // Arrange: a draft with a title only.
    const draft = await mockApi.hrCreateNews({
      title: 'Bài thiếu ảnh',
      slug: '',
      categoryId: null,
      summary: '',
      cover: null,
      tags: [],
      content: null,
    });
    const user = userEvent.setup();
    open('/hr/tin-tuc?tab=draft');
    const [picker] = await screen.findAllByRole('button', { name: /Trạng thái bài Bài thiếu ảnh: Nháp/ });

    // Act
    await user.click(picker as HTMLElement);
    await user.click(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /^Đã đăng/ }));

    // Assert
    const alert = await screen.findByText(/Bài "Bài thiếu ảnh" còn thiếu/);
    expect(alert.textContent).toMatch(/chuyên mục, ảnh bìa, nội dung, mở bài để bổ sung/);
    expect(within(alert).getByRole('link', { name: 'Mở bài' }).getAttribute('href')).toBe(`/hr/tin-tuc/${draft.id}`);
  });

  it('should only offer Đã đăng and Đã ẩn for a published post, Nháp being greyed out', async () => {
    const user = userEvent.setup();
    open('/hr/tin-tuc?tab=published');
    const [picker] = await screen.findAllByRole('button', { name: /: Đã đăng – bấm để đổi/ });

    await user.click(picker as HTMLElement);
    const items = within(screen.getByRole('menu')).getAllByRole('menuitemradio');

    expect(items.map((i) => [i.textContent?.slice(0, 7), i.getAttribute('aria-disabled')])).toEqual([
      ['NhápChỉ', 'true'],
      ['Đã đăng', null],
      ['Đã ẩnGỡ', null],
    ]);
  });

  it('should not offer to delete a category that still has posts, and say why', async () => {
    const user = userEvent.setup();
    open();
    await screen.findAllByText('Chuyến đi thiện nguyện Vĩnh Hy 2026');

    await user.click(screen.getByRole('button', { name: 'Chuyên mục' }));
    const dialog = screen.getByRole('dialog');
    const row = within(dialog).getByText('Đời sống TOP FLOW').closest('li') as HTMLElement;
    const remove = within(row).getByRole('button', { name: /Xoá/ }) as HTMLButtonElement;

    expect(remove.disabled).toBe(true);
    expect(within(row).getByText(/Còn 2 bài – chuyển bài sang chuyên mục khác trước/)).toBeTruthy();
  });

  it('should show 20 posts a page and move between pages', async () => {
    // Arrange: 22 drafts more than the 3 demo posts.
    for (let i = 1; i <= 22; i++) await mockApi.hrCreateNews({ ...emptyPost, title: `Nháp số ${i}` });
    const user = userEvent.setup();
    open();
    await within(await screen.findByRole('table')).findByText('Nháp số 22');

    // Assert: page 1
    expect(dataRows()).toHaveLength(20);
    const pager = screen.getByRole('navigation', { name: 'Trang danh sách bài' });
    expect(within(pager).getByText('Trang 1 / 2')).toBeTruthy();

    // Act
    await user.click(within(pager).getByRole('button', { name: 'Trang sau' }));

    // Assert: page 2
    expect(dataRows()).toHaveLength(5);
    expect(within(pager).getByText('Trang 2 / 2')).toBeTruthy();
  }, 20_000);

  it('should show the cover as a thumbnail and the status in its own column', async () => {
    // Act
    open('/hr/tin-tuc?tab=published');
    await screen.findAllByText('5 điều nên chuẩn bị trước buổi phỏng vấn tại TOP FLOW');

    // Assert
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toContain('Trạng thái');
    const [row] = dataRows();
    const cells = within(row as HTMLElement).getAllByRole('cell');
    const statusCell = cells[headers.indexOf('Trạng thái')] as HTMLElement;
    expect(within(statusCell).getByRole('button', { name: /Trạng thái bài .*: Đã đăng/ })).toBeTruthy();
    expect((row as HTMLElement).querySelector('img')?.getAttribute('src')).toMatch(/\S/);
  });

  it('should delete several drafts at once after asking, and only offer drafts for it', async () => {
    // Arrange
    await mockApi.hrCreateNews({ ...emptyPost, title: 'Nháp thử A' });
    await mockApi.hrCreateNews({ ...emptyPost, title: 'Nháp thử B' });
    const user = userEvent.setup();
    open();
    const table = await screen.findByRole('table');
    await within(table).findAllByText('Nháp thử A');
    expect(within(table).queryByRole('checkbox', { name: /5 điều nên chuẩn bị/ })).toBeNull();

    // Act
    await user.click(within(table).getByRole('checkbox', { name: 'Chọn bài Nháp thử A' }));
    await user.click(within(table).getByRole('checkbox', { name: 'Chọn bài Nháp thử B' }));
    await user.click(screen.getByRole('button', { name: 'Xoá 2 bản nháp' }));
    const confirm = screen.getByRole('dialog', { name: 'Xoá 2 bản nháp?' });
    await user.click(within(confirm).getByRole('button', { name: 'Xoá 2 bài' }));

    // Assert
    await vi.waitFor(async () => {
      const titles = (await mockApi.hrNews()).posts.map((p) => p.title);
      expect(titles).not.toContain('Nháp thử A');
      expect(titles).not.toContain('Nháp thử B');
    });
    expect(await screen.findByText('Đã xoá 2 bản nháp.')).toBeTruthy();
  });
});

const emptyPost = { title: '', slug: '', categoryId: null, summary: '', cover: null, tags: [], content: null };

/** Rows of the desktop table, without its header row. */
const dataRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
