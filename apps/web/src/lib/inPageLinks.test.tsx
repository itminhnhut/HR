import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasTocBlock, scrollToInPageLink } from './inPageLinks';

const html =
  '<nav class="toc" aria-label="Mục lục"><p class="toc-title">Mục lục</p><ol><li>' +
  '<a href="#quyen-loi"><span class="toc-num">1</span>Quyền lợi</a></li></ol></nav>' +
  '<h2 id="quyen-loi">Quyền lợi</h2><p><a href="https://topflow.vn">ngoài</a></p>';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderArticle() {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  render(
    <div onClick={scrollToInPageLink}>
      <div className="article-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>,
  );
  return scroll;
}

describe('links inside an article', () => {
  it('should scroll to the heading and focus it instead of changing the page address', () => {
    const scroll = renderArticle();

    const notCancelled = fireEvent.click(screen.getByRole('link', { name: /Quyền lợi/ }));

    expect(notCancelled).toBe(false);
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Quyền lợi' }));
  });

  it('should leave links to other pages alone', () => {
    const scroll = renderArticle();

    const notCancelled = fireEvent.click(screen.getByRole('link', { name: 'ngoài' }));

    expect(notCancelled).toBe(true);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('should tell when HR placed a contents block in the text', () => {
    expect(hasTocBlock(html)).toBe(true);
    expect(hasTocBlock('<h2 id="a">A</h2>')).toBe(false);
  });
});
