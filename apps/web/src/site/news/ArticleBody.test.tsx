import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ArticleBody } from './ArticleBody';

afterEach(cleanup);

const TABLE =
  '<div class="table-wrap"><table><tbody><tr><th><p>Vị trí</p></th><th><p>Lương</p></th></tr></tbody></table></div>';

describe('article body', () => {
  it('should make a sideways-scrolling table a named region that the keyboard can reach and scroll', () => {
    // Act
    render(<ArticleBody html={`<p>Bảng lương</p>${TABLE}`} />);

    // Assert
    const region = screen.getByRole('region', { name: 'Bảng: Vị trí, Lương' });
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.querySelector('table')).not.toBeNull();
  });

  it('should label tables that arrive with new article text too', () => {
    // Arrange
    const { rerender } = render(<ArticleBody html="<p>Chưa có bảng</p>" />);

    // Act
    rerender(<ArticleBody html={TABLE} />);

    // Assert
    expect(screen.getByRole('region', { name: /^Bảng/ })).toBeTruthy();
  });
});
