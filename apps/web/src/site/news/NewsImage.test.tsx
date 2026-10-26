import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NEWS_FALLBACK_IMAGE, NewsImage } from './NewsImage';

afterEach(cleanup);

describe('NewsImage', () => {
  it('should let the browser pick the smallest sharp copy', () => {
    // Arrange
    const srcset = [
      { url: 'https://img.test/a-960.webp', width: 960 },
      { url: 'https://img.test/a-480.webp', width: 480 },
    ];

    // Act
    render(<NewsImage src="https://img.test/a.jpg" alt="Đội ngũ" srcset={srcset} sizes="100vw" />);

    // Assert
    const img = screen.getByRole('img', { name: 'Đội ngũ' });
    expect(img.getAttribute('srcset')).toBe('https://img.test/a-480.webp 480w, https://img.test/a-960.webp 960w');
    expect(img.getAttribute('sizes')).toBe('100vw');
  });

  it('should show older images without copies as one file', () => {
    render(<NewsImage src="https://img.test/a.jpg" alt="Ảnh cũ" />);

    const img = screen.getByRole('img', { name: 'Ảnh cũ' });
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('sizes')).toBe(false);
  });
});

describe('NewsImage fallback', () => {
  const category = { name: 'Đời sống TOP FLOW', slug: 'doi-song-top-flow' };

  it('should show a block in the category colour with its name when the picture cannot load', () => {
    // Arrange
    render(<NewsImage src="/api/news-images/mat.jpg" alt="Cả đội" width={1200} height={675} category={category} />);

    // Act
    fireEvent.error(screen.getByRole('img', { name: 'Cả đội' }));

    // Assert
    const block = screen.getByRole('img', { name: 'Cả đội' });
    expect(block.tagName).toBe('SPAN');
    expect(block.textContent).toContain('Đời sống TOP FLOW');
    expect(block.style.backgroundImage).toContain('var(--color-cat-rose)');
    expect(block.style.aspectRatio).toBe('1200 / 675');
  });

  it('should show the block straight away for a post without a picture', () => {
    render(<NewsImage src={null} alt="Bài không ảnh" category={category} />);

    expect(screen.getByRole('img', { name: 'Bài không ảnh' }).tagName).toBe('SPAN');
  });

  it('should hide a block with no description from screen readers', () => {
    const { container } = render(<NewsImage src={null} alt="" category={category} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('Đời sống TOP FLOW');
  });

  it('should keep the default picture when the category is not known', () => {
    render(<NewsImage src="/api/news-images/mat.jpg" alt="Ảnh lỗi" />);

    fireEvent.error(screen.getByRole('img', { name: 'Ảnh lỗi' }));

    expect(screen.getByRole('img', { name: 'Ảnh lỗi' }).getAttribute('src')).toBe(NEWS_FALLBACK_IMAGE);
  });
});
