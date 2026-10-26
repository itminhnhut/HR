import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NEWS_FALLBACK_IMAGE, NewsImage } from '../../site/news/NewsImage';
import { pageItems } from './NewsListPage';

describe('pageItems', () => {
  it('should show every page when there are few', () => {
    expect(pageItems(2, 3)).toEqual([1, 2, 3]);
  });

  it('should keep the first, last and nearby pages with gaps between, when there are many', () => {
    expect(pageItems(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageItems(1, 12)).toEqual([1, 2, 'gap', 12]);
  });
});

describe('NewsImage', () => {
  it('should show the default image when the picture cannot load', () => {
    render(<NewsImage src="https://example.com/mat.jpg" alt="Ảnh bìa" />);
    const img = screen.getByAltText('Ảnh bìa');

    fireEvent.error(img);

    expect(img.getAttribute('src')).toBe(NEWS_FALLBACK_IMAGE);
  });

  it('should show the default image when a post has no cover', () => {
    render(<NewsImage src={null} alt="Không ảnh" />);

    expect(screen.getByAltText('Không ảnh').getAttribute('src')).toBe(NEWS_FALLBACK_IMAGE);
  });
});
