import { afterEach, describe, expect, it, vi } from 'vitest';
import { flattenForPaste } from './flattenForPaste';

const MAIL = `<!doctype html><html><body style="font-family:Georgia;color:#111;">
<div style="display:none;">Dòng xem trước</div>
<table><tr><td style="color:#333;font-size:15px;line-height:1.7;">
  <p style="margin:0 0 14px;color:#222;">Thân gửi bạn <b style="font-weight:700;">An</b>, xem <a href="https://x.example/" style="color:#C8102E;">trang này</a>.</p>
</td></tr>
<tr><td style="font-size:13px;"><b style="color:#C8102E;">M</b>&nbsp;&nbsp;<a href="tel:+84900000000" style="color:#222;">+84 900</a><br>
<b style="color:#C8102E;">E</b>&nbsp;&nbsp;<a href="mailto:a@x.example" style="color:#222;">a@x.example</a></td></tr>
<tr><td bgcolor="#C8102E"><a href="https://y.example/" style="padding:12px 30px;color:#fff;">NÚT</a></td></tr>
<tr><td style="color:#eee;">Trước khối<div style="font-size:11px;">Dòng sau khối</div></td></tr>
<tr><td><img src="data:image/png;base64,AAAA" alt="logo"></td></tr>
<tr><td>A &amp; B &lt;script&gt;alert(1)&lt;/script&gt;</td></tr>
</table></body></html>`;

function flattened(html = MAIL) {
  const holder = document.createElement('div');
  holder.innerHTML = flattenForPaste(html);
  return holder;
}

afterEach(() => vi.restoreAllMocks());

describe('the mail as it goes on the clipboard', () => {
  it('should hold every visible text inside a carrier tag', () => {
    // Act
    const mail = flattened();

    // Assert
    const walker = document.createTreeWalker(mail, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) expect(node.parentElement?.closest('abbr')).not.toBeNull();
    }
  });

  it('should keep a paragraph with its bold word and link inside one carrier', () => {
    // Act
    const carrier = [...flattened().querySelectorAll('abbr')].find((a) => a.textContent?.includes('Thân gửi'));

    // Assert
    expect(carrier?.textContent).toBe('Thân gửi bạn An, xem trang này.');
    expect(carrier?.querySelector('b')?.textContent).toBe('An');
    expect(carrier?.querySelector('a')?.getAttribute('href')).toBe('https://x.example/');
  });

  it('should leave no text style on any parent, and no paragraph', () => {
    // Act
    const mail = flattened();

    // Assert
    expect(mail.querySelector('p')).toBeNull();
    for (const element of mail.querySelectorAll<HTMLElement>('td, div, table')) {
      expect(element.style.fontSize).toBe('');
      expect(element.style.lineHeight).toBe('');
      expect(element.style.color).toBe('');
    }
  });

  it('should keep the space under a paragraph', () => {
    const block = [...flattened().querySelectorAll<HTMLElement>('div')].find((d) => d.style.marginBottom === '14px');

    expect(block?.textContent).toContain('Thân gửi');
  });

  it('should put each line after a line break in its own carrier', () => {
    const texts = [...flattened().querySelectorAll('abbr')].map((a) => a.textContent ?? '');

    expect(texts.some((text) => text.includes('+84 900'))).toBe(true);
    expect(texts.some((text) => text.includes('a@x.example'))).toBe(true);
    expect(texts.some((text) => text.includes('+84 900') && text.includes('a@x.example'))).toBe(false);
  });

  it('should drop the hidden preview line', () => {
    expect(flattened().textContent).not.toContain('Dòng xem trước');
  });

  it('should keep text and a nested block in their order', () => {
    const text = flattened().textContent ?? '';

    expect(text.indexOf('Trước khối')).toBeLessThan(text.indexOf('Dòng sau khối'));
  });

  it('should move the padding of a button to its coloured cell', () => {
    const cell = flattened().querySelector<HTMLElement>('td[bgcolor]');

    expect(cell?.style.padding).toBe('12px 30px');
  });

  it('should keep images', () => {
    expect(flattened().querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('should keep markup in a text as text', () => {
    const mail = flattened();

    expect(mail.querySelector('script')).toBeNull();
    expect(mail.textContent).toContain('A & B <script>alert(1)</script>');
  });

  it('should leave no frame behind', () => {
    flattened();

    expect(document.querySelector('iframe')).toBeNull();
  });

  it('should fall back to the mail as it is when the rewrite fails', () => {
    // Arrange
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue(null);

    // Act
    const result = flattenForPaste(MAIL);

    // Assert
    expect(result).toBe(MAIL);
  });
});
