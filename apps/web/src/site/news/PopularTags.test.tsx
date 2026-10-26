import type { NewsTagCountDto } from '@careers/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { PopularTags } from './NewsListParts';

const tags: NewsTagCountDto[] = Array.from({ length: 13 }, (_, i) => ({
  name: `Thẻ ${i + 1}`,
  slug: `the-${i + 1}`,
  postCount: 20 - i,
}));

function show(current?: string) {
  const router = createMemoryRouter([{ path: '/', element: <PopularTags tags={tags} current={current} /> }]);
  render(<RouterProvider router={router} />);
  return screen.getByRole('navigation', { name: 'Hashtag nổi bật' });
}

afterEach(cleanup);

describe('popular hashtags row', () => {
  it('should show the 8 most used hashtags and a "+5" button for the rest', () => {
    // Act
    const nav = show();

    // Assert
    expect(within(nav).getAllByRole('link')).toHaveLength(8);
    const more = within(nav).getByRole('button', { name: 'Xem thêm 5 hashtag' });
    expect(more.textContent).toBe('+5');
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });

  it('should show every hashtag after "+5" is pressed', async () => {
    // Arrange
    const nav = show();

    // Act
    await userEvent.click(within(nav).getByRole('button', { name: 'Xem thêm 5 hashtag' }));

    // Assert
    expect(within(nav).getAllByRole('link')).toHaveLength(13);
    expect(within(nav).getByRole('button', { name: 'Thu gọn hashtag' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('should keep the open hashtag visible even when it is not among the first 8', () => {
    // Act
    const nav = show('the-12');

    // Assert
    const open = within(nav).getByRole('link', { current: 'page' });
    expect(open.textContent).toContain('Thẻ 12');
  });
});
