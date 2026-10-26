import type { NewsImage } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CoverField } from './fields';

const cover = (width: number): NewsImage => ({ url: 'https://img.test/a.jpg', alt: 'Văn phòng', width, height: 540 });

function renderCover(value: NewsImage) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CoverField value={value} onChange={() => undefined} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('CoverField', () => {
  it('should warn that a cover narrower than 1200px looks blurry when shared', () => {
    renderCover(cover(960));

    expect(screen.getByText(/Ảnh nhỏ hơn 1200px sẽ mờ khi chia sẻ/)).toBeTruthy();
  });

  it('should not warn for a cover wide enough for share previews', () => {
    renderCover(cover(1600));

    expect(screen.queryByText(/Ảnh nhỏ hơn 1200px/)).toBeNull();
  });
});
